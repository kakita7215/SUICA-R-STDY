import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// 動作確認用
app.get("/", (req, res) => {
  res.send("WS server running");
});

let esp32Socket = null;

wss.on("connection", (ws) => {
  console.log("WS client connected");

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log("Invalid JSON");
      return;
    }

    console.log("recv:", data);

    // ESP32登録
    if (data.type === "esp_online") {
      esp32Socket = ws;
      console.log("ESP32 registered");
      return;
    }

    // HTML → ESP32（RFID読み取り指示）
    if (data.type === "rfid_read") {
      if (esp32Socket) {
        esp32Socket.send(JSON.stringify({
          type: "rfid_read"
        }));
      }
      return;
    }

    // ESP32 → HTML（RFID結果）
    if (data.type === "rfid_result") {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });
      return;
    }
  });

  ws.on("close", () => {
    console.log("WS client disconnected");
    if (ws === esp32Socket) {
      esp32Socket = null;
      console.log("ESP32 disconnected");
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
