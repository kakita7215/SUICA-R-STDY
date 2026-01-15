import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 静的ファイル配信
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ 
  server,
  perMessageDeflate: false,
  clientTracking: true,
  maxPayload: 1024 * 1024
});

const PORT = process.env.PORT || 3000;

// ヘルスチェック用
app.get("/health", (req, res) => {
  res.type("text/plain").send("WS server running");
});

let esp32Socket = null;

function heartbeat() { 
  this.isAlive = true; 
}

wss.on("connection", (ws, req) => {
  ws.isAlive = true;
  ws.on("pong", heartbeat);
  
  const clientIP = req.socket.remoteAddress;
  console.log(`[WS] Client connected from ${clientIP}`);

  ws.on("message", (message) => {
    let data;
    try { 
      data = JSON.parse(message); 
      console.log(`[WS] Received message type: ${data.type}`);
    } catch (e) { 
      console.log("[WS] Invalid JSON received");
      return; 
    }

    // ESP32が接続したことを登録
    if (data.type === "esp_online") {
      esp32Socket = ws;
      console.log("[ESP32] Registered as ESP32");
      
      // 全クライアントにESP32接続を通知
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify({ 
            type: "esp_status", 
            status: "online" 
          }));
        }
      });
      return;
    }

    // ブラウザから読み取りリクエスト
    if (data.type === "rfid_read") {
      console.log("[RFID] Read request from browser");
      if (esp32Socket && esp32Socket.readyState === 1) {
        console.log("[RFID] Forwarding to ESP32");
        esp32Socket.send(JSON.stringify({ type: "rfid_read" }));
      } else {
        console.log("[RFID] ESP32 not connected");
        ws.send(JSON.stringify({ 
          type: "error", 
          message: "ESP32 not connected" 
        }));
      }
      return;
    }

    // ESP32からの読み取り結果
    if (data.type === "rfid_result") {
      console.log(`[RFID] Result received: ${data.count} tags`);
      // 全ブラウザクライアントに配信
      wss.clients.forEach((client) => {
        if (client !== esp32Socket && client.readyState === 1) {
          client.send(JSON.stringify(data));
          console.log("[RFID] Sent result to browser");
        }
      });
      return;
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`[WS] Client disconnected: code=${code}, reason=${reason?.toString() || 'none'}`);
    
    if (ws === esp32Socket) {
      esp32Socket = null;
      console.log("[ESP32] Unregistered");
      
      // 全クライアントにESP32切断を通知
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ 
            type: "esp_status", 
            status: "offline" 
          }));
        }
      });
    }
  });

  ws.on("error", (err) => {
    console.error("[WS] Error:", err?.message || err);
  });
});

// Ping/Pongによる接続維持
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log("[WS] Terminating inactive client");
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);

wss.on("close", () => clearInterval(interval));

// グレースフルシャットダウン
function shutdown() {
  console.log("[Server] Shutting down gracefully...");
  clearInterval(interval);
  wss.clients.forEach((ws) => ws.terminate());
  server.close(() => {
    console.log("[Server] Closed");
    process.exit(0);
  });
  setTimeout(() => {
    console.log("[Server] Force exit");
    process.exit(0);
  }, 3000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] WebSocket endpoint: ws://localhost:${PORT}/`);
});