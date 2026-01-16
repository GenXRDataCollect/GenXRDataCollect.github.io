// Basic Socket.IO + Express server for local testing with the web UI
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

app.post("/api/azure-token", async (req, res) => {
  try {
    if (!AZURE_WEB_PUBSUB_CONNECTION_STRING) {
      log("ERROR: AZURE_WEB_PUBSUB_CONNECTION_STRING is not set!");
      return res.status(500).json({ error: "AZURE_WEB_PUBSUB_CONNECTION_STRING not configured on server" });
    }
    
    log("Creating Azure Web PubSub token...");
    const serviceClient = new WebPubSubServiceClient(
      AZURE_WEB_PUBSUB_CONNECTION_STRING,
      AZURE_WEB_PUBSUB_HUB
    );
    
    // Generate a client access token with a unique user ID
    const userId = req.body?.userId || `user-${Date.now()}`;
    const token = await serviceClient.getClientAccessToken({
      userId: userId,
      roles: ['webpubsub.sendToGroup', 'webpubsub.joinLeaveGroup']
    });
    
    log("Azure Web PubSub token created successfully");
    res.json({
      url: token.url,
      token: token.token,
      userId: userId
    });
  } catch (error) {
    log("Error creating Azure token", error);
    res.status(500).json({ error: "Failed to create token" });
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
