import express from "express";
import http from "http";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  perMessageDeflate: false,
  clientTracking: true,
  maxPayload: 1024 * 1024,
  handshakeTimeout: 30000
});

const PORT = process.env.PORT || 3000;

// タグ名の保存先（任意）:
// - TAG_NAMES_DIR: <TAG_NAMES_DIR>/tag-names.json に保存
// - TAG_NAMES_FILE: 完全パスで上書き（こちらが優先）
const DATA_DIR = process.env.TAG_NAMES_DIR || path.join(__dirname, "data");
const TAG_NAMES_FILE =
  process.env.TAG_NAMES_FILE || path.join(DATA_DIR, "tag-names.json");
let tagNames = {};

async function loadTagNames() {
  try {
    const raw = await fs.readFile(TAG_NAMES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      tagNames = parsed;
    } else {
      console.log("[Tags] tag-names.json has invalid format; starting empty");
      tagNames = {};
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[Tags] Failed to load tag names:", err?.message || err);
    }
    tagNames = {};
  }
}

async function saveTagNames() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const payload = JSON.stringify(tagNames, null, 2);
    await fs.writeFile(TAG_NAMES_FILE, payload, "utf8");
  } catch (err) {
    console.error("[Tags] Failed to save tag names:", err?.message || err);
  }
}

loadTagNames();

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

  ws.on("message", async (message) => {
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
      
      ws.send(JSON.stringify({
        type: "esp_registered",
        status: "ok",
        timestamp: Date.now()
      }));
      
      return;
    }

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

    if (data.type === "config") {
      console.log(`[${new Date().toISOString()}] [CFG] Config request from browser (${clientId})`);

      if (esp32Socket && esp32Socket.readyState === 1) {
        esp32Socket.send(JSON.stringify(data));
      } else {
        ws.send(JSON.stringify({
          type: "error",
          message: "ESP32 not connected"
        }));
      }
      return;
    }

    if (data.type === "get_fw" || data.type === "get_temp" || data.type === "get_return_loss") {
      console.log(`[${new Date().toISOString()}] [CMD] ${data.type} request from browser (${clientId})`);

      if (esp32Socket && esp32Socket.readyState === 1) {
        esp32Socket.send(JSON.stringify(data));
      } else {
        ws.send(JSON.stringify({
          type: "error",
          message: "ESP32 not connected"
        }));
      }
      return;
    }


    if (data.type === "tag_name_set") {
      const id = typeof data.id === "string" ? data.id.trim() : "";
      const name = typeof data.name === "string" ? data.name.trim() : "";

      if (!id) {
        return;
      }

      if (name) {
        tagNames[id] = name;
      } else {
        delete tagNames[id];
      }

      await saveTagNames();

      const payload = JSON.stringify({
        type: "tag_name_updated",
        id,
        name: name || null
      });

      wss.clients.forEach((client) => {
        if (client.readyState === 1 && !client.isESP32) {
          client.send(payload);
        }
      });

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
      

      if (Array.isArray(data.tags)) {
        data.tags = data.tags.map((tag) => {
          const id = typeof tag.id === "string" ? tag.id : String(tag.id || "");
          const name = id && tagNames[id] ? tagNames[id] : "";
          return { ...tag, id, name };
        });
      }
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

    if (data.type === "fw_result" || data.type === "temp_result" || data.type === "return_loss_result") {
      const payload = JSON.stringify(data);
      wss.clients.forEach((client) => {
        if (client.readyState === 1 && !client.isESP32) {
          client.send(payload);
        }
      });
      return;
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`[${new Date().toISOString()}] [WS] Client disconnected: ${clientId}`);
    console.log(`[WS] Code: ${code}, Reason: ${reason?.toString() || 'none'}`);
    
    if (ws === esp32Socket) {
      esp32Socket = null;
      console.log("[ESP32] Unregistered");
      
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
  
  setTimeout(() => {
    if (ws.readyState === 1) {
      if (!ws.isESP32) {
        ws.send(JSON.stringify({
          type: "esp_status",
          status: esp32Socket ? "online" : "offline",
          timestamp: Date.now()
        }));
      }
      ws.send(JSON.stringify({
        type: "server_hello",
        timestamp: Date.now(),
        message: "Connected to server"
      }));
    }
  }, 100);
});

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log(`[WS] Terminating inactive client: ${ws.clientId || 'unknown'}`);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 45000);

wss.on("close", () => {
  console.log("[WS] Server closing");
  clearInterval(interval);
});

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
