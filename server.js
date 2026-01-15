
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 追加: public を静的配信（/ で index.html を返す）
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// 動作確認用（テキストを返すエンドポイントも残したいなら /health に）
app.get("/health", (req, res) => {
  res.type("text/plain").send("WS server running");
});

let esp32Socket = null;

function heartbeat() { this.isAlive = true; }

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", heartbeat);
  console.log("WS client connected");

  ws.on("message", (message) => {
    let data;
    try { data = JSON.parse(message); } catch { return; }

    if (data.type === "esp_online") {
      esp32Socket = ws;
      console.log("ESP32 registered");
      return;
    }

    if (data.type === "rfid_read") {
      if (esp32Socket && esp32Socket.readyState === 1) {
        esp32Socket.send(JSON.stringify({ type: "rfid_read" }));
      }
      return;
    }

    if (data.type === "rfid_result") {
      wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(JSON.stringify(data));
      });
      return;
    }
  });

  
  ws.on("close", (code, reason) => {
    console.log("WS client disconnected", { code, reason: reason?.toString() });
    if (ws === esp32Socket) esp32Socket = null;
  });
  ws.on("error", (err) => console.error("WS error:", err?.message || err));

});

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false; ws.ping(() => {});
  });
}, 30_000);

wss.on("close", () => clearInterval(interval));

function shutdown() {
  console.log("Shutting down gracefully...");
  wss.clients.forEach((ws) => ws.terminate());
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
