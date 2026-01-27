import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import pg from "pg";

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

// タグ名はPostgreSQLに保存します（Render PostgreSQL想定）。
// 接続先は DATABASE_URL を使用します。
const DATABASE_URL = process.env.DATABASE_URL || "";
const pool = DATABASE_URL
  ? new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

let tagNames = {};

async function initTagNames() {
  if (!pool) {
    console.warn("[Tags] DATABASE_URL not set; tag names will not persist");
    tagNames = {};
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tag_names (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.error("[Tags] Failed to create table:", err?.message || err);
  }

  try {
    const result = await pool.query("SELECT id, name FROM tag_names");
    tagNames = {};
    result.rows.forEach((row) => {
      if (row?.id) {
        tagNames[row.id] = row.name || "";
      }
    });
    console.log(`[Tags] Loaded ${Object.keys(tagNames).length} tag names`);
  } catch (err) {
    console.error("[Tags] Failed to load tag names:", err?.message || err);
    tagNames = {};
  }
}

async function upsertTagName(id, name) {
  if (!pool) return;
  await pool.query(
    `INSERT INTO tag_names (id, name, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO UPDATE
     SET name = EXCLUDED.name, updated_at = NOW()`,
    [id, name]
  );
}

async function deleteTagName(id) {
  if (!pool) return;
  await pool.query("DELETE FROM tag_names WHERE id = $1", [id]);
}

initTagNames();

app.get("/health", (req, res) => {
  const status = {
    status: "running",
    clients: wss.clients.size,
    esp32Connected: esp32Socket !== null,
    uptime: process.uptime()
  };
  res.json(status);
});

app.get("/tags", async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: "DATABASE_URL not set" });
    return;
  }
  try {
    const result = await pool.query("SELECT id, name, updated_at FROM tag_names ORDER BY updated_at DESC");
    if (req.query.format === "text") {
      const lines = result.rows.map((row) => `${row.id}\t${row.name ?? ""}`);
      res.type("text/plain").send(lines.join("\n"));
      return;
    }
    res.json({ count: result.rows.length, rows: result.rows });
  } catch (err) {
    res.status(500).json({ error: err?.message || "DB error" });
  }
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
        await upsertTagName(id, name);
      } else {
        delete tagNames[id];
        await deleteTagName(id);
      }

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
    // ESP32縺九ｉ縺ｮ隱ｭ縺ｿ蜿悶ｊ邨先棡
    if (data.type === "rfid_result") {
      console.log(`[${new Date().toISOString()}] [RFID] Result from ESP32: ${data.count} tags`);
      
      // 繧ｿ繧ｰ隧ｳ邏ｰ繧偵Ο繧ｰ蜃ｺ蜉・
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

