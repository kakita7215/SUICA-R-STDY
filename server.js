import express from "express";
import http from "http";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 髱咏噪繝輔ぃ繧､繝ｫ驟堺ｿ｡ (public繝・ぅ繝ｬ繧ｯ繝医Μ)
app.use(express.static(path.join(__dirname, "public")));

// 繝ｫ繝ｼ繝医い繧ｯ繧ｻ繧ｹ譎ゅ↓public/index.html繧呈・遉ｺ逧・↓霑斐☆
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const server = http.createServer(app);

// WebSocket險ｭ螳壹ｒ隱ｿ謨ｴ
const wss = new WebSocketServer({ 
  server,
  perMessageDeflate: false,
  clientTracking: true,
  maxPayload: 1024 * 1024,
  // 繧ｿ繧､繝繧｢繧ｦ繝医ｒ髟ｷ繧√↓險ｭ螳・
  handshakeTimeout: 30000
});

const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const TAG_NAMES_FILE = path.join(DATA_DIR, "tag-names.json");
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

// 繝倥Ν繧ｹ繝√ぉ繝・け逕ｨ
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

    // ESP32縺梧磁邯壹＠縺溘％縺ｨ繧堤匳骭ｲ
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
      
      // 蜈ｨ繝悶Λ繧ｦ繧ｶ繧ｯ繝ｩ繧､繧｢繝ｳ繝医↓ESP32謗･邯壹ｒ騾夂衍
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
      
      // ESP32縺ｫ遒ｺ隱榊ｿ懃ｭ斐ｒ騾√ｋ
      ws.send(JSON.stringify({
        type: "esp_registered",
        status: "ok",
        timestamp: Date.now()
      }));
      
      return;
    }

    // 繝悶Λ繧ｦ繧ｶ縺九ｉ隱ｭ縺ｿ蜿悶ｊ繝ｪ繧ｯ繧ｨ繧ｹ繝・
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

    // ESP32縺九ｉ縺ｮ隱ｭ縺ｿ蜿悶ｊ邨先棡

    // ブラウザからタグ名の登録
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
    if (data.type === "rfid_result") {
      console.log(`[${new Date().toISOString()}] [RFID] Result from ESP32: ${data.count} tags`);
      
      // 繧ｿ繧ｰ隧ｳ邏ｰ繧偵Ο繧ｰ蜃ｺ蜉・
      if (data.tags && data.tags.length > 0) {
        data.tags.forEach((tag, idx) => {
          console.log(`[RFID] Tag ${idx + 1}: ID=${tag.id}, RSSI=${tag.rssi}dBm`);
        });
      }
      
      // 蜈ｨ繝悶Λ繧ｦ繧ｶ繧ｯ繝ｩ繧､繧｢繝ｳ繝医↓驟堺ｿ｡

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
  });

  ws.on("close", (code, reason) => {
    console.log(`[${new Date().toISOString()}] [WS] Client disconnected: ${clientId}`);
    console.log(`[WS] Code: ${code}, Reason: ${reason?.toString() || 'none'}`);
    
    if (ws === esp32Socket) {
      esp32Socket = null;
      console.log("[ESP32] Unregistered");
      
      // 蜈ｨ繧ｯ繝ｩ繧､繧｢繝ｳ繝医↓ESP32蛻・妙繧帝夂衍
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
  
  // 謗･邯夂｢ｺ隱阪Γ繝・そ繝ｼ繧ｸ繧帝√ｋ
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

// Ping/Pong縺ｫ繧医ｋ謗･邯夂ｶｭ謖・ｼ・0遘偵＃縺ｨ・・
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log(`[WS] Terminating inactive client: ${ws.clientId || 'unknown'}`);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 48000);

wss.on("close", () => {
  console.log("[WS] Server closing");
  clearInterval(interval);
});

// 繧ｰ繝ｬ繝ｼ繧ｹ繝輔Ν繧ｷ繝｣繝・ヨ繝繧ｦ繝ｳ
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



