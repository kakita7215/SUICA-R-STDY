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

// WebSocket設定を調整
const wss = new WebSocketServer({ 
  server,
  perMessageDeflate: false,
  clientTracking: true,
  maxPayload: 1024 * 1024,
  // タイムアウトを長めに設定
  handshakeTimeout: 30000
});

const PORT = process.env.PORT || 3000;

// ヘルスチェック用
app.get("/health", (req, res) => {
  const status = {
    status: "running",
    clients: wss.clients.size,
    esp32Connected: esp32Socket !== null,
    uptime: process.uptime()
  };
  res.json(status);
});

let esp32Socket = null;

function heartbeat() { 
  this.isAlive = true; 
}

wss.on("connection", (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  const clientPort = req.socket.remotePort;
  const clientId = `${clientIP}:${clientPort}`;
  
  console.log(`[${new Date().toISOString()}] [WS] New connection from ${clientId}`);
  console.log(`[WS] Total clients: ${wss.clients.size}`);
  console.log(`[WS] Headers:`, req.headers);
  
  ws.isAlive = true;
  ws.clientId = clientId;
  ws.on("pong", heartbeat);

  ws.on("message", (message) => {
    let data;
    let msgStr = message.toString();
    
    console.log(`[${new Date().toISOString()}] [WS] Message from ${clientId}:`);
    console.log(`[WS] Raw: ${msgStr}`);
    
    try { 
      data = JSON.parse(msgStr);
      console.log(`[WS] Parsed type: ${data.type}`);
    } catch (e) { 
      console.log(`[WS] JSON parse error from ${clientId}:`, e.message);
      return; 
    }

    // ESP32が接続したことを登録
    if (data.type === "esp_online") {
      const oldESP32 = esp32Socket;
      esp32Socket = ws;
      ws.isESP32 = true;
      
      console.log(`[${new Date().toISOString()}] [ESP32] Registered as ESP32`);
      console.log(`[ESP32] Device: ${data.device || 'unknown'}`);
      console.log(`[ESP32] Timestamp: ${data.timestamp || 'none'}`);
      
      if (oldESP32 && oldESP32 !== ws) {
        console.log("[ESP32] Closing old ESP32 connection");
        oldESP32.close();
      }
      
      // 全ブラウザクライアントにESP32接続を通知
      let notified = 0;
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1 && !client.isESP32) {
          client.send(JSON.stringify({ 
            type: "esp_status", 
            status: "online",
            timestamp: Date.now()
          }));
          notified++;
        }
      });
      console.log(`[ESP32] Notified ${notified} browser clients`);
      
      // ESP32に確認応答を送る
      ws.send(JSON.stringify({
        type: "esp_registered",
        status: "ok",
        timestamp: Date.now()
      }));
      
      return;
    }

    // ブラウザから読み取りリクエスト
    if (data.type === "rfid_read") {
      console.log(`[${new Date().toISOString()}] [RFID] Read request from browser (${clientId})`);
      
      if (esp32Socket && esp32Socket.readyState === 1) {
        console.log("[RFID] Forwarding to ESP32");
        esp32Socket.send(JSON.stringify({ 
          type: "rfid_read",
          requestId: Date.now()
        }));
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
      console.log(`[${new Date().toISOString()}] [RFID] Result from ESP32: ${data.count} tags`);
      
      // タグ詳細をログ出力
      if (data.tags && data.tags.length > 0) {
        data.tags.forEach((tag, idx) => {
          console.log(`[RFID] Tag ${idx + 1}: ID=${tag.id}, RSSI=${tag.rssi}dBm`);
        });
      }
      
      // 全ブラウザクライアントに配信
      let sent = 0;
      wss.clients.forEach((client) => {
        if (client !== esp32Socket && client.readyState === 1 && !client.isESP32) {
          client.send(JSON.stringify(data));
          sent++;
        }
      });
      console.log(`[RFID] Sent result to ${sent} browser clients`);
      return;
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`[${new Date().toISOString()}] [WS] Client disconnected: ${clientId}`);
    console.log(`[WS] Code: ${code}, Reason: ${reason?.toString() || 'none'}`);
    
    if (ws === esp32Socket) {
      esp32Socket = null;
      console.log("[ESP32] Unregistered");
      
      // 全クライアントにESP32切断を通知
      let notified = 0;
      wss.clients.forEach((client) => {
        if (client.readyState === 1 && !client.isESP32) {
          client.send(JSON.stringify({ 
            type: "esp_status", 
            status: "offline",
            timestamp: Date.now()
          }));
          notified++;
        }
      });
      console.log(`[ESP32] Notified ${notified} clients of disconnection`);
    }
    
    console.log(`[WS] Remaining clients: ${wss.clients.size}`);
  });

  ws.on("error", (err) => {
    console.error(`[${new Date().toISOString()}] [WS] Error from ${clientId}:`, err?.message || err);
  });
  
  // 接続確認メッセージを送る
  setTimeout(() => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: "server_hello",
        timestamp: Date.now(),
        message: "Connected to server"
      }));
    }
  }, 100);
});

// Ping/Pongによる接続維持（30秒ごと）
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log(`[WS] Terminating inactive client: ${ws.clientId || 'unknown'}`);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);

wss.on("close", () => {
  console.log("[WS] Server closing");
  clearInterval(interval);
});

// グレースフルシャットダウン
function shutdown() {
  console.log(`[${new Date().toISOString()}] [Server] Shutting down gracefully...`);
  clearInterval(interval);
  
  wss.clients.forEach((ws) => {
    ws.send(JSON.stringify({
      type: "server_shutdown",
      message: "Server is shutting down"
    }));
    ws.terminate();
  });
  
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
  console.log(`[${new Date().toISOString()}] [Server] Listening on port ${PORT}`);
  console.log(`[Server] WebSocket endpoint: ws://localhost:${PORT}/`);
  console.log(`[Server] Node version: ${process.version}`);
  console.log(`[Server] Platform: ${process.platform}`);
});