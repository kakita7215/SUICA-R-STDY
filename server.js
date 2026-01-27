import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: "256kb" }));
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
const TAG_EDIT_PASSWORD = process.env.TAG_EDIT_PASSWORD || "";
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

async function ensureTagExists(id) {
  if (!pool || !id) return;
  if (Object.prototype.hasOwnProperty.call(tagNames, id)) return;
  try {
    await upsertTagName(id, "");
    tagNames[id] = "";
  } catch (err) {
    console.error("[Tags] Failed to insert empty name:", err?.message || err);
  }
}

app.get("/health", (req, res) => {
  const status = {
    status: "running",
    clients: wss.clients.size,
    esp32Connected: esp32Socket !== null,
    uptime: process.uptime()
  };
  res.json(status);
});

function requireTagEditAuth(req, res) {
  if (!TAG_EDIT_PASSWORD) {
    res.status(500).json({ error: "TAG_EDIT_PASSWORD not set" });
    return false;
  }
  const token = req.get("x-edit-token") || "";
  if (token !== TAG_EDIT_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

app.get("/tags", async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: "DATABASE_URL not set" });
    return;
  }
  try {
    const result = await pool.query("SELECT id, name, updated_at FROM tag_names ORDER BY updated_at DESC");
    if (req.query.format === "text") {
      const pad = (v, w) => String(v ?? "").padEnd(w, " ");
      const lines = [
        `${pad("No.", 4)}${pad("Tag ID", 26)}NAME`,
        ...result.rows.map((row, idx) =>
          `${pad(idx + 1, 4)}${pad(row.id, 26)}${row.name ?? ""}`
        )
      ];
      res.type("text/plain").send(lines.join("\n"));
      return;
    }
    if (req.query.format === "json") {
      res.json({ count: result.rows.length, rows: result.rows });
      return;
    }
    res.type("text/html").send(`<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Tag Names Editor</title>
    <style>
      body{font-family:system-ui,Segoe UI,Meiryo,sans-serif;background:#0f1115;color:#e9edf5;margin:0;padding:24px;}
      h1{margin:0 0 12px 0;font-size:22px;}
      .row{display:grid;gap:8px;margin-bottom:12px;grid-template-columns:70px 320px 200px 110px 90px;align-items:center;}
      .row.small{grid-template-columns:1fr auto;}
      input,button{font-size:14px;padding:8px 10px;border-radius:8px;border:1px solid #2a2f3a;background:#171a21;color:#e9edf5;}
      input{width:100%;}
      button{white-space:nowrap;}
      input.col-no{max-width:70px;}
      .col-id{max-width:320px;}
      .col-name{max-width:200px;}
      button{cursor:pointer;}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px;}
      th,td{border-top:1px solid #2a2f3a;padding:8px;text-align:left;}
      th{color:#a1a6b3;}
      .muted{color:#a1a6b3;font-size:12px;}
    </style>
  </head>
  <body>
    <h1>Tag Names Editor</h1>
    <div class="row small">
      <input id="token" type="password" placeholder="編集パスワード" />
      <button id="btnLoad">読み込み</button>
    </div>
    <div class="row">
      <input id="tagNo" class="col-no" type="number" min="1" placeholder="No." />
      <input id="tagId" class="col-id" type="text" placeholder="Tag ID" />
      <input id="tagName" class="col-name" type="text" placeholder="Name" />
      <button id="btnSave">保存/更新</button>
      <button id="btnDelete">削除</button>
    </div>
    <div class="muted">※保存/削除はパスワード必須</div>
    <table>
      <colgroup>
        <col style="width:70px" />
        <col style="width:320px" />
        <col style="width:200px" />
        <col style="width:110px" />
        <col />
      </colgroup>
      <thead><tr><th>No.</th><th>Tag ID</th><th>NAME</th><th>状態</th><th>更新日時</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
    <script>
      const rowsEl = document.getElementById("rows");
      const tokenEl = document.getElementById("token");
      const noEl = document.getElementById("tagNo");
      const idEl = document.getElementById("tagId");
      const nameEl = document.getElementById("tagName");
      let lastRows = [];

      async function fetchTags() {
        const token = tokenEl.value || "";
        const res = await fetch("/api/tags", {
          headers: { "x-edit-token": token }
        });
        if (!res.ok) {
          alert("読み込み失敗: " + res.status);
          return;
        }
        const data = await res.json();
        lastRows = data.rows || [];
        rowsEl.innerHTML = lastRows.map((r, i) => \`
          <tr>
            <td>\${i + 1}</td>
            <td>\${r.id}</td>
            <td>\${r.name ?? ""}</td>
            <td>\${r.name ? "登録済み" : "未登録"}</td>
            <td>\${r.updated_at ?? ""}</td>
          </tr>\`).join("");
      }

      function resolveId() {
        const id = idEl.value.trim();
        if (id) return id;
        const no = Number(noEl.value);
        if (Number.isFinite(no) && no >= 1 && no <= lastRows.length) {
          return String(lastRows[no - 1].id || "");
        }
        return "";
      }

      async function saveTag() {
        const token = tokenEl.value || "";
        const id = resolveId();
        const name = nameEl.value.trim();
        if (!id) { alert("Tag ID を入力してください"); return; }
        const res = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-edit-token": token },
          body: JSON.stringify({ id, name })
        });
        if (!res.ok) { alert("保存失敗: " + res.status); return; }
        await fetchTags();
      }

      async function deleteTag() {
        const token = tokenEl.value || "";
        const id = resolveId();
        if (!id) { alert("Tag ID を入力してください"); return; }
        const res = await fetch("/api/tags/" + encodeURIComponent(id), {
          method: "DELETE",
          headers: { "x-edit-token": token }
        });
        if (!res.ok) { alert("削除失敗: " + res.status); return; }
        await fetchTags();
      }

      document.getElementById("btnLoad").addEventListener("click", fetchTags);
      document.getElementById("btnSave").addEventListener("click", saveTag);
      document.getElementById("btnDelete").addEventListener("click", deleteTag);
    </script>
  </body>
</html>`);
  } catch (err) {
    res.status(500).json({ error: err?.message || "DB error" });
  }
});

app.get("/api/tags", async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: "DATABASE_URL not set" });
    return;
  }
  if (!requireTagEditAuth(req, res)) return;
  try {
    const result = await pool.query("SELECT id, name, updated_at FROM tag_names ORDER BY updated_at DESC");
    res.json({ count: result.rows.length, rows: result.rows });
  } catch (err) {
    res.status(500).json({ error: err?.message || "DB error" });
  }
});

app.post("/api/tags", async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: "DATABASE_URL not set" });
    return;
  }
  if (!requireTagEditAuth(req, res)) return;
  const id = typeof req.body?.id === "string" ? req.body.id.trim() : "";
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }
  try {
    await upsertTagName(id, name || "");
    tagNames[id] = name || "";
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err?.message || "DB error" });
  }
});

app.delete("/api/tags/:id", async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: "DATABASE_URL not set" });
    return;
  }
  if (!requireTagEditAuth(req, res)) return;
  const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }
  try {
    await deleteTagName(id);
    delete tagNames[id];
    res.json({ ok: true });
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
        const uniqueIds = new Set();
        data.tags.forEach((tag) => {
          const id = typeof tag.id === "string" ? tag.id : String(tag.id || "");
          if (id) uniqueIds.add(id);
        });
        const nameStateById = {};
        for (const id of uniqueIds) {
          const hasEntry = Object.prototype.hasOwnProperty.call(tagNames, id);
          nameStateById[id] = hasEntry ? "existing" : "new";
          if (!hasEntry) {
            await ensureTagExists(id);
          }
        }
        data.tags = data.tags.map((tag) => {
          const id = typeof tag.id === "string" ? tag.id : String(tag.id || "");
          const name = id && tagNames[id] ? tagNames[id] : "";
          const nameState = nameStateById[id] || "existing";
          return { ...tag, id, name, nameState };
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

