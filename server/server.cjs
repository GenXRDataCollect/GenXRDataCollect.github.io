// Basic Socket.IO + Express server for local testing with the web UI
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

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

  socket.on("spacebar_click", (data) => {
    console.log("server received spacebar_click:", data);

    socket.broadcast.emit("spacebar_click", data);
  });

});

server.listen(PORT, () => {
  log(`Socket.IO server listening on http://localhost:${PORT}`);
});

