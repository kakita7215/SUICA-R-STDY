
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const server = createServer(app);

// --- 安定化オプション（必要に応じてON） ---
// 直後切断(1005)が出る環境では perMessageDeflate を切ると安定するケースが多い。
// BTSでは明示OFFにしていないが、相性問題の切り分け用にここではOFFを推奨。
// あとで挙動が安定したら true に戻してもよい。
const wss = new WebSocketServer({
  server,
  perMessageDeflate: false, // ← まずはOFFで様子見。BTS互換にしたいなら true でも可
  clientTracking: true
});

// Keep-alive の余裕（BTSには無いが安定化のため追加）
server.keepAliveTimeout = 75_000;
server.headersTimeout  = 80_000;

const PORT = process.env.PORT || 10000;

// /health は Render のヘルスチェック用（BTSは静的配信。必要なら app.use(express.static(...)) も可）
app.get('/health', (_req, res) => res.type('text/plain').send('WS server running'));

// 接続管理: BTS同様のモデル
const clients = {
  esp32: null,
  browsers: new Set()
};

// WS接続
wss.on('connection', (ws, req) => {
  // まずはブラウザとして扱う（BTSと同様）
  clients.browsers.add(ws);
  console.log('[WS] Connected from:', req.socket.remoteAddress);
  console.log(`[Browser] Total browsers: ${clients.browsers.size}`);

  ws.on('message', (data) => {
    const raw = data.toString();
    // console.log('[WS] Raw:', raw);
    let msg;
    try { msg = JSON.parse(raw); }
    catch (e) {
      console.warn('[WS] JSON parse error:', e);
      return;
    }

    const type = msg?.type;
    // --- ESP32 登録（BTS: "esp32"、UHF: "esp_online" の両対応） ---
    if (type === 'esp32' || type === 'esp_online') {
      if (clients.esp32) {
        console.log('[ESP32] Closing previous connection');
        try { clients.esp32.close(); } catch {}
      }
      clients.browsers.delete(ws);
      clients.esp32 = ws;
      console.log('[ESP32] Registered');

      // BTS 互換の登録確認（ブラウザ側に影響しないよう軽量に）
      try {
        ws.send(JSON.stringify({ type: 'registered', message: 'ESP32 registered' }));
      } catch {}
      return;
    }

    // --- ルーティング ---
    // A) ブラウザ → ESP32: "rfid_read"
    if (type === 'rfid_read') {
      if (clients.esp32 && clients.esp32.readyState === 1) {
        clients.esp32.send(JSON.stringify({ type: 'rfid_read' }));
      } else {
        // 必要ならブラウザへ通知
        if (clients.browsers.has(ws)) {
          ws.send(JSON.stringify({ type: 'error', message: 'ESP32 not connected' }));
        }
      }
      return;
    }

    // B) ESP32 → ブラウザ: "rfid_result"
    if (type === 'rfid_result') {
      let sent = 0;
      clients.browsers.forEach(bw => {
        if (bw.readyState === 1) { try { bw.send(JSON.stringify(msg)); sent++; } catch {} }
      });
      // console.log(`[RFID] Sent to ${sent} browser(s)`);
      return;
    }

    // そのほかはログのみ（BTS同様の挙動）
    console.log('[WS] Unknown type:', type);
  });

  ws.on('close', (code, reason) => {
    // BTSはコードを出していないが、UHF切断解析のため出す
    console.log('WS client disconnected', { code, reason: reason?.toString() });
    if (clients.esp32 === ws) {
      clients.esp32 = null;
      console.log('[ESP32] Disconnected');
    } else {
      clients.browsers.delete(ws);
      console.log(`[Browser] Disconnected. Remaining: ${clients.browsers.size}`);
    }
  });

  ws.on('error', (err) => {
    console.error('[WS] error:', err?.message || err);
  });
});

// サーバ起動
server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] Health: http://localhost:${PORT}/health`);
});
