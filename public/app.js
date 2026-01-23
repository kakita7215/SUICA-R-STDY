    const I18N = {
      ko: {
        title: "SUICA R PJ Monitor",
        topHint: "ESP32 reads data from the RFID reader. (INV/RL uses antennas 1-3, 4 is not connected)",
        controlTitle: "Control",
        controlHint: "Power/Repeat/Window update the inventory operation immediately.",
        labelPower: "Power(dBm) 0-33",
        labelEnable: "Enable",
        btnOn: "ON",
        btnOff: "OFF",
        antOffHint: "OFF runs with Power=0.",
        labelRepeatAll: "Repeat (all)",
        labelWindowAll: "Window(ms) (all)",
        labelRepeatPer: "Repeat (per ANT)",
        labelWindowPer: "Window(ms) (per ANT)",
        btnCopyAll: "Copy all values to each ANT",
        btnApply: "Apply",
        rlInfo: "Return Loss is an antenna matching indicator, separate from RF output (dBm).",
        summaryTitle: "Summary",
        rlTitle: "Return Loss (antenna status)",
        rlDesc: "Return Loss is an antenna matching indicator. (Separate from RF output)",
        rawToggle: "Raw Data (Debug JSON) show/hide",
        tagTitle: "Tags",
        connected: "CONNECTED",
        disconnected: "DISCONNECTED",
        statusOK: "OK",
        statusNG: "NG",
        statusNC: "Not Connected"
      },
      ja: {
        title: "SUICA R PJ Monitor",
        topHint: "ESP32がRFIDリーダーから情報を取得して実行します。（INV/RLはアンテナ1〜3のみ、4は未接続）",
        controlTitle: "コントロール",
        controlHint: "Power/Repeat/Windowはインベントリ動作に即時反映されます。",
        labelPower: "Power(dBm) 0〜33",
        labelEnable: "Enable",
        btnOn: "ON",
        btnOff: "OFF",
        antOffHint: "OFFはPower=0で動作します。",
        labelRepeatAll: "Repeat（一括設定）",
        labelWindowAll: "Window(ms)（一括設定）",
        labelRepeatPer: "Repeat（ANT別）",
        labelWindowPer: "Window(ms)（ANT別）",
        btnCopyAll: "全体値をANT別にコピー",
        btnApply: "Apply",
        rlInfo: "※ Return Lossのvalueはアンテナ整合の指標で、RF出力(dBm)とは別の値です。",
        summaryTitle: "サマリー",
        rlTitle: "Return Loss（アンテナ状態）",
        rlDesc: "Return Lossはアンテナ整合の指標です。（RF出力とは別）",
        rawToggle: "▶ Raw Data (Debug JSON) 表示/非表示",
        tagTitle: "タグ",
        connected: "CONNECTED",
        disconnected: "DISCONNECTED",
        statusOK: "OK",
        statusNG: "NG",
        statusNC: "Not Connected"
      }
    };

    let lang = "ja";
    let theme = localStorage.getItem("theme") || "light";

    const el = (id) => document.getElementById(id);

    function applyTheme(next){
      theme = next;
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
      const lightBtn = el("btnLight");
      const darkBtn = el("btnDark");
      lightBtn.classList.toggle("active", theme === "light");
      darkBtn.classList.toggle("active", theme === "dark");
    }

    function setLang(next){
      lang = next;
      const t = I18N[lang];

      el("tTitle").textContent = t.title;
      el("topHint").textContent = t.topHint;
      el("ctlTitle").textContent = t.controlTitle;
      el("ctlHint").textContent = t.controlHint;
      el("lblPower").textContent = t.labelPower;
      el("lblEnable").textContent = t.labelEnable;
      if (el("lblRepeatAll")) { el("lblRepeatAll").textContent = t.labelRepeatAll; }
      if (el("lblWindowAll")) { el("lblWindowAll").textContent = t.labelWindowAll; }
      el("lblRepeatPer").textContent = t.labelRepeatPer;
      el("lblWindowPer").textContent = t.labelWindowPer;
      if (el("btnCopyAll")) { el("btnCopyAll").textContent = t.btnCopyAll; }
      el("btnApply").textContent = t.btnApply;
      el("rlInfo").textContent = t.rlInfo + " " + t.antOffHint;
      el("sumTitle").textContent = t.summaryTitle;
      el("rlTitle").textContent = t.rlTitle;
      el("rlDesc").textContent = t.rlDesc;
      el("rawToggle").textContent = t.rawToggle;
      el("tagTitle").textContent = t.tagTitle;

      el("btnKo").classList.toggle("active", lang === "ko");
      el("btnJa").classList.toggle("active", lang === "ja");

      updateAntToggleUI();
      updateConnectionBadge(lastEspStatus);
    }

    el("btnKo").addEventListener("click", () => setLang("ko"));
    el("btnJa").addEventListener("click", () => setLang("ja"));
    el("btnLight").addEventListener("click", () => applyTheme("light"));
    el("btnDark").addEventListener("click", () => applyTheme("dark"));

    applyTheme(theme);

            const power1 = el("power1"), power2 = el("power2"), power3 = el("power3");
    const repeat1 = el("repeat1"), repeat2 = el("repeat2"), repeat3 = el("repeat3");
    const windowMs1 = el("windowMs1"), windowMs2 = el("windowMs2"), windowMs3 = el("windowMs3");
    const repeatAll = el("repeatAll"), windowAll = el("windowAll");
    const ant1Toggle = el("ant1Toggle"), ant2Toggle = el("ant2Toggle"), ant3Toggle = el("ant3Toggle");

    const antEnabled = [true, false, false];
    const powerCache = [null, null, null];

            function toggleInputDisabled(idx, disabled){
      const r = idx === 0 ? repeat1 : (idx === 1 ? repeat2 : repeat3);
      const w = idx === 0 ? windowMs1 : (idx === 1 ? windowMs2 : windowMs3);
      if (idx === 0) power1.disabled = disabled;
      if (idx === 1) power2.disabled = disabled;
      if (idx === 2) power3.disabled = disabled;
      r.disabled = disabled;
      w.disabled = disabled;
    }

    function setAntEnabled(idx, enabled){
      antEnabled[idx] = enabled;
      if (enabled){
        const cached = powerCache[idx];
        const fallback = 8;
        const restored = (cached !== null && Number.isFinite(cached)) ? cached : fallback;
        if (idx === 0) power1.value = restored;
        if (idx === 1) power2.value = restored;
        if (idx === 2) power3.value = restored;
        toggleInputDisabled(idx, false);
      } else {
        const current = idx === 0 ? Number(power1.value) : (idx === 1 ? Number(power2.value) : Number(power3.value));
        if (Number.isFinite(current) && current > 0) powerCache[idx] = current;
        if (idx === 0) power1.value = 0;
        if (idx === 1) power2.value = 0;
        if (idx === 2) power3.value = 0;
        toggleInputDisabled(idx, true);
      }
      updateAntToggleUI();
    }

    function updateAntToggleUI(){
      const t = I18N[lang];
      const buttons = [ant1Toggle, ant2Toggle, ant3Toggle];
      buttons.forEach((btn, idx)=>{
        btn.classList.toggle("on", antEnabled[idx]);
        btn.classList.toggle("off", !antEnabled[idx]);
        btn.textContent = antEnabled[idx] ? t.btnOn : t.btnOff;
      });
    }

    ant1Toggle.addEventListener("click", () => setAntEnabled(0, !antEnabled[0]));
    ant2Toggle.addEventListener("click", () => setAntEnabled(1, !antEnabled[1]));
    ant3Toggle.addEventListener("click", () => setAntEnabled(2, !antEnabled[2]));

    function normalizeNumberInput(value){
      if (typeof value !== "string") return null;
      const normalized = value.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).trim();
      if (normalized === "") return null;
      const num = Number(normalized);
      if (!Number.isFinite(num)) return null;
      return normalized;
    }

    function applyBulkToAntFields(){
      if (repeatAll.value !== "") {
        repeat1.value = repeatAll.value;
        repeat2.value = repeatAll.value;
        repeat3.value = repeatAll.value;
      }
      if (windowAll.value !== "") {
        windowMs1.value = windowAll.value;
        windowMs2.value = windowAll.value;
        windowMs3.value = windowAll.value;
      }
    }

    setAntEnabled(0, true);
    repeat1.value = 5;
    windowMs1.value = 500;
    repeat2.value = 0;
    windowMs2.value = 0;
    repeat3.value = 0;
    windowMs3.value = 0;
    setAntEnabled(1, false);
    setAntEnabled(2, false);

    function updateConnectionBadge(status){
      const t = I18N[lang];
      const b = el("connBadge");
      if (status === "online"){
        b.classList.remove("ng");
        b.classList.add("ok");
        b.textContent = t.connected;
      } else {
        b.classList.remove("ok");
        b.classList.add("ng");
        b.textContent = t.disconnected;
      }
    }

    function renderSummary(data){
      el("pillFW").textContent = "FW: " + (data.fwText ?? "-");
      el("pillTEMP").textContent = "TEMP: " + (data.tempText ?? "-");
      el("pillPower").textContent = "Power: " + (data.power1 ?? "-") + " dBm";
      el("pillRepeat").textContent = "Repeat: " + (data.repeat1 ?? "-");
      el("pillWindow").textContent = "Window: " + (data.windowMs1 ?? "-") + " ms";
      const tagCount = data.count ?? (Array.isArray(data.tags) ? data.tags.length : 0);
      el("pillTags").textContent = "Tags: " + tagCount;
      el("pillReadMs").textContent = "readMs: " + (data.readMs ?? "-");

      const dt = new Date();
      el("updatedAtText").textContent = "updatedAt: " + dt.toLocaleString();
      el("rawPre").textContent = JSON.stringify(data, null, 2);
    }

    function renderReturnLoss(items){
      if (!Array.isArray(items) || items.length === 0){
        el("rlBody").innerHTML = '<tr><td colspan="4">-</td></tr>';
        return;
      }
      const rows = items.map((item) => {
        const ant = item.ant ?? "-";
        const value = item.returnLoss ?? "-";
        const raw = item.raw ?? "-";
        return `
          <tr>
            <td>ANT${ant}</td>
            <td style="text-align:center;">-</td>
            <td>${value}</td>
            <td>${raw}</td>
          </tr>
        `;
      }).join("");
      el("rlBody").innerHTML = rows;
    }

    function clearUi(){
      el("pillFW").textContent = "FW: -";
      el("pillTEMP").textContent = "TEMP: -";
      el("pillPower").textContent = "Power: -";
      el("pillRepeat").textContent = "Repeat: -";
      el("pillWindow").textContent = "Window: -";
      el("pillTags").textContent = "Tags: -";
      el("pillReadMs").textContent = "readMs: -";
      el("pillExtTemp").textContent = "Ext Temp: -";
      el("pillExtHum").textContent = "Ext Hum: -";
      el("updatedAtText").textContent = "updatedAt: -";
      el("rawPre").textContent = "{}";
      el("tagBody").innerHTML = '<tr><td colspan="7">-</td></tr>';
      el("rlBody").innerHTML = '<tr><td colspan="4">-</td></tr>';
    }

    let lastTagData = null;

            function renderTags(data){
      const tags = Array.isArray(data.tags) ? data.tags : [];
      lastTagData = data;
      if (tags.length === 0){
        el("tagBody").innerHTML = '<tr><td colspan="7">-</td></tr>';
        return;
      }
      const rows = tags.map((tag) => {
        const epc = tag.id ?? tag.epc ?? "";
        const rssi = Number(tag.rssi ?? 0);
        const dupCount = Number(tag.count ?? 1);
        const name = (tag.name && String(tag.name).trim()) ? String(tag.name).trim() : "";
        const show = (v) => (Number.isFinite(v) && v !== 0 ? v : "-");
        const showCount = (v) => (Number.isFinite(v) ? v : "-");
        const nameCell = name
          ? `<div>${name}</div>
             <button class="btn" data-action="edit-name" data-id="${epc}">Edit</button>`
          : `<div>新規アイテム</div>
             <input class="tag-name-input" data-id="${epc}" type="text" maxlength="40" placeholder="名前を入力" />
             <button class="btn" data-action="save-name" data-id="${epc}">Save</button>`;
        return `
          <tr>
            <td>${epc}</td>
            <td>${nameCell}</td>
            <td>${show(rssi)}</td>
            <td>-</td>
            <td>-</td>
            <td>${show(rssi)}</td>
            <td>${showCount(dupCount)}</td>
          </tr>
        `;
      }).join("");
      el("tagBody").innerHTML = rows;
    }

    let lastEspStatus = "offline";
    let ws = null;

    function handleWsMessage(event){
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        return;
      }

      if (data.type === "esp_status"){
        lastEspStatus = data.status || "offline";
        updateConnectionBadge(lastEspStatus);
        return;
      }

      if (data.type === "rfid_result"){
        renderSummary(data);
        renderTags(data);
        return;
      }

      if (data.type === "fw_result"){
        if (data.fwText) {
          el("pillFW").textContent = "FW: " + data.fwText;
        } else {
          const esp = data.fwTextESP ?? "-";
          const m702 = data.fwTextM702 ?? "-";
          el("pillFW").textContent = "FW: ESP32 " + esp + " / M702 " + m702;
        }
        return;
      }

      if (data.type === "temp_result"){
        el("pillTEMP").textContent = "TEMP: " + (data.tempText ?? "-");
        el("pillExtTemp").textContent = "Ext Temp: " + (data.extTempText ?? "-");
        el("pillExtHum").textContent = "Ext Hum: " + (data.extHumText ?? "-");
        return;
      }

      if (data.type === "return_loss_result"){
        renderReturnLoss(data.items);
        return;
      }

      if (data.type === "tag_name_updated"){
        if (lastTagData && Array.isArray(lastTagData.tags)) {
          lastTagData.tags = lastTagData.tags.map((tag) => {
            if (String(tag.id) === String(data.id)) {
              return { ...tag, name: data.name || "" };
            }
            return tag;
          });
          renderTags(lastTagData);
        }
      }
    }

    function sendRfidRead(){
      if (ws && ws.readyState === WebSocket.OPEN){
        ws.send(JSON.stringify({ type: "rfid_read" }));
      }
    }

    function toNumber(value, fallback){
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    }

    function sendCommand(type){
      if (ws && ws.readyState === WebSocket.OPEN){
        ws.send(JSON.stringify({ type }));
      }
    }

    function sendConfig(){
      if (!ws || ws.readyState !== WebSocket.OPEN){
        return;
      }

                  const payload = {
        type: "config",
        power1: toNumber(power1.value, 0),
        power2: toNumber(power2.value, 0),
        power3: toNumber(power3.value, 0),
        repeat1: toNumber(repeat1.value, 0),
        repeat2: toNumber(repeat2.value, 0),
        repeat3: toNumber(repeat3.value, 0),
        windowMs1: toNumber(windowMs1.value, 0),
        windowMs2: toNumber(windowMs2.value, 0),
        windowMs3: toNumber(windowMs3.value, 0),
        ant1: antEnabled[0],
        ant2: antEnabled[1],
        ant3: antEnabled[2]
      };

      ws.send(JSON.stringify(payload));
    }

    function sendTagName(id, name){
      if (!ws || ws.readyState !== WebSocket.OPEN){
        return;
      }
      ws.send(JSON.stringify({ type: "tag_name_set", id, name }));
    }

    function connectWs(){
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${location.host}`;
      ws = new WebSocket(wsUrl);

      ws.addEventListener("open", () => {
        updateConnectionBadge(lastEspStatus);
      });

      ws.addEventListener("close", () => {
        lastEspStatus = "offline";
        updateConnectionBadge(lastEspStatus);
        setTimeout(connectWs, 3000);
      });

      ws.addEventListener("message", handleWsMessage);
    }

    setLang("ja");
    el("btnINV").addEventListener("click", sendRfidRead);
        el("btnApply").addEventListener("click", sendConfig);
    el("btnCopyAll").addEventListener("click", applyBulkToAntFields);
    repeatAll.addEventListener("input", applyBulkToAntFields);
    windowAll.addEventListener("input", applyBulkToAntFields);
    el("btnFW").addEventListener("click", () => sendCommand("get_fw"));
    el("btnTEMP").addEventListener("click", () => sendCommand("get_temp"));
    el("btnRL").addEventListener("click", () => sendCommand("get_return_loss"));
    el("btnCLEAR").addEventListener("click", clearUi);
    el("tagBody").addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute("data-action");
      if (!action) return;
      const id = target.getAttribute("data-id") || "";
      if (!id) return;
      if (action === "save-name") {
        const input = el("tagBody").querySelector(`.tag-name-input[data-id="${id}"]`);
        if (input && input.value.trim()) {
          sendTagName(id, input.value.trim());
        }
      }
      if (action === "edit-name") {
        const name = prompt("名前を入力してください", "");
        if (name && name.trim()) {
          sendTagName(id, name.trim());
        }
      }
    });
    // Copy only when the button is pressed.
    connectWs();
  


