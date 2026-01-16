// Basic Socket.IO + Express server with Azure Web PubSub
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { WebPubSubServiceClient } = require('@azure/web-pubsub');

require('dotenv').config();

const AZURE_WEB_PUBSUB_CONNECTION_STRING = process.env.AZURE_WEB_PUBSUB_CONNECTION_STRING;
const AZURE_WEB_PUBSUB_HUB = process.env.AZURE_WEB_PUBSUB_HUB || 'socket-hub';
const PORT = process.env.PORT || 3001;

const CONTROL_EVENTS = {
  START: "control:start",
  STOP: "control:stop",
  START_ANIMATION_PREVIEW: "control:start-animation-preview",
  START_PLAY_AND_RECORD: "control:start-play-record",
  STOP_RECORDING: "control:stop-recording",
};

function log(message, extra) {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[${ts}] ${message}`, extra ?? "");
}

const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  log(`Client connected: ${socket.id}`);

  socket.emit("hello", "world");

  const forwardControlEvent = (event) => (payload) => {
    log(`Received ${event} from ${socket.id}`, payload);
    // broadcast to all clients (including sender) so everyone stays in sync
    io.emit(event, payload);
  };

  Object.values(CONTROL_EVENTS).forEach((event) => {
    socket.on(event, forwardControlEvent(event));
  });

  socket.on("disconnect", (reason) => {
    log(`Client disconnected: ${socket.id} (${reason})`);
  });
});

// Azure Web PubSub token endpoint
app.post("/api/azure-token", async (req, res) => {
  try {
    if (!AZURE_WEB_PUBSUB_CONNECTION_STRING) {
      log("ERROR: AZURE_WEB_PUBSUB_CONNECTION_STRING is not set!");
      return res.status(500).json({ error: "Azure Web PubSub connection string not configured" });
    }
    
    // ADD THIS: Log the connection string (masked)
    const masked = AZURE_WEB_PUBSUB_CONNECTION_STRING.replace(/AccessKey=([^;]+)/, 'AccessKey=***');
    log("Connection string:", masked);
    log("Hub name:", AZURE_WEB_PUBSUB_HUB);
    console.log('Using hub:', AZURE_WEB_PUBSUB_HUB);
    const serviceClient = new WebPubSubServiceClient(
      AZURE_WEB_PUBSUB_CONNECTION_STRING,
      AZURE_WEB_PUBSUB_HUB
    );
    
    const userId = req.body?.userId || `user-${Date.now()}`;
    
    // ADD THIS: Log the token generation
    log("Generating token for user:", userId);
    
    const token = await serviceClient.getClientAccessToken({
      userId: userId,
      roles: ['webpubsub.sendToGroup', 'webpubsub.joinLeaveGroup']
    });
    
    log("Token generated successfully");
    log("Token URL:", token.url);
    
    res.json({ url: token.url });
  } catch (error) {
    log("Error creating Azure Web PubSub token", error);
    res.status(500).json({ error: error.message || "Failed to create token" });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const iface of Object.values(networkInterfaces)) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        addresses.push(alias.address);
      }
    }
  }
  
  log(`Socket.IO server listening on:`);
  log(`  Local:   http://localhost:${PORT}`);
  addresses.forEach(addr => log(`  Network: http://${addr}:${PORT}`));
});