    const I18N = {
                        ko: {
        title: "SUICA R PJ Monitor",
        topHint: "ESP32가 RFID 리더에서 정보를 받아 실행합니다. (INV/RL은 안테나 1-3만, 4는 미연결)",
        controlTitle: "컨트롤",
        controlHint: "Power/Repeat/Window 값은 인벤토리 동작에 즉시 반영됩니다.",
        labelPower: "Power(dBm) 0-33",
        labelEnable: "사용",
        btnOn: "ON",
        btnOff: "OFF",
        antOffHint: "OFF는 Power=0으로 동작합니다.",
        labelRepeatAll: "Repeat(일괄 설정)",
        labelWindowAll: "Window(ms)(일괄 설정)",
        labelRepeatPer: "Repeat(ANT별)",
        labelWindowPer: "Window(ms)(ANT별)",
        btnCopyAll: "전체 값을 ANT별로 복사",
        btnApply: "Apply",
        btnFW: "FW",
        btnTEMP: "TEMP",
        btnINV: "인벤토리",
        btnRL: "반사 손실",
        btnCLEAR: "초기화",
        rlInfo: "Return Loss의 값은 안테나 매칭 지표로, RF 출력(dBm)과는 별도입니다.",
        summaryTitle: "요약",
        rlTitle: "Return Loss(안테나 상태)",
        rlDesc: "Return Loss는 안테나 매칭 지표입니다. (RF 출력과 별도)",
        statusHeader: "상태",
        rawToggle: "Raw Data (Debug JSON) 표시/숨김",
        tagTitle: "태그",
        multiNewError: "1개씩 등록해주세요.",
        newItemLabel: "신규 아이템",
        namePlaceholder: "이름 입력",
        saveLabel: "저장",
        editLabel: "수정",
        promptName: "이름을 입력해주세요",
        unnamedNewLabel: "신규",
        unnamedExistingLabel: "미등록",
        confNewLabel: "신규",
        confExistingLabel: "미등록",
        confRegisteredLabel: "등록됨",
        fwLabel: "FW",
        tempLabel: "온도",
        extTempLabel: "외부 온도",
        extHumLabel: "외부 습도",
        powerLabel: "출력",
        repeatLabel: "반복",
        windowLabel: "윈도우",
        tagsLabel: "태그",
        readMsLabel: "읽기시간",
        updatedAtLabel: "업데이트",
        serverLabel: "서버",
        espLabel: "ESP32",
        connected: "연결됨",
        disconnected: "연결 끊김",
        statusOK: "OK",
        statusNG: "NG",
        statusNC: "미연결"
      },ja: {
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
        btnFW: "FW",
        btnTEMP: "TEMP",
        btnINV: "INVENTORY",
        btnRL: "RETURN LOSS",
        btnCLEAR: "CLEAR",
        rlInfo: "※ Return Lossのvalueはアンテナ整合の指標で、RF出力(dBm)とは別の値です。",
        summaryTitle: "サマリー",
        rlTitle: "Return Loss（アンテナ状態）",
        rlDesc: "Return Lossはアンテナ整合の指標です。（RF出力とは別）",
        statusHeader: "状態",
        rawToggle: "▶ Raw Data (Debug JSON) 表示/非表示",
        tagTitle: "タグ",
        multiNewError: "1枚ずつ登録してください。",
        newItemLabel: "新規アイテム",
        namePlaceholder: "名前を入力",
        saveLabel: "Save",
        editLabel: "Edit",
        promptName: "名前を入力してください",
        unnamedNewLabel: "新規",
        unnamedExistingLabel: "未登録",
        confNewLabel: "新規",
        confExistingLabel: "未登録",
        confRegisteredLabel: "登録済",
        fwLabel: "FW",
        tempLabel: "TEMP",
        extTempLabel: "Ext Temp",
        extHumLabel: "Ext Hum",
        powerLabel: "Power",
        repeatLabel: "Repeat",
        windowLabel: "Window",
        tagsLabel: "Tags",
        readMsLabel: "readMs",
        updatedAtLabel: "updatedAt",
        serverLabel: "サーバー",
        espLabel: "ESP32",
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
      el("btnFW").textContent = t.btnFW;
      el("btnTEMP").textContent = t.btnTEMP;
      el("btnINV").textContent = t.btnINV;
      el("btnRL").textContent = t.btnRL;
      el("btnCLEAR").textContent = t.btnCLEAR;
      el("rlInfo").textContent = t.rlInfo + " " + t.antOffHint;
      el("sumTitle").textContent = t.summaryTitle;
      el("rlTitle").textContent = t.rlTitle;
      el("rlDesc").textContent = t.rlDesc;
      el("rlStatusHead").textContent = t.statusHeader;
      el("rawToggle").textContent = t.rawToggle;
      el("tagTitle").textContent = t.tagTitle;

      el("btnKo").classList.toggle("active", lang === "ko");
      el("btnJa").classList.toggle("active", lang === "ja");

      updateAntToggleUI();
      updateServerBadge(lastServerStatus);
      updateEspBadge(lastEspStatus);
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

    function updateServerBadge(status){
      const t = I18N[lang];
      const b = el("serverBadge");
      if (status === "online"){
        b.classList.remove("ng");
        b.classList.add("ok");
        b.textContent = `${t.serverLabel}: ${t.connected}`;
      } else {
        b.classList.remove("ok");
        b.classList.add("ng");
        b.textContent = `${t.serverLabel}: ${t.disconnected}`;
      }
    }

    function updateEspBadge(status){
      const t = I18N[lang];
      const b = el("espBadge");
      if (status === "online"){
        b.classList.remove("ng");
        b.classList.add("ok");
        b.textContent = `${t.espLabel}: ${t.connected}`;
      } else {
        b.classList.remove("ok");
        b.classList.add("ng");
        b.textContent = `${t.espLabel}: ${t.disconnected}`;
      }
    }

    function renderSummary(data){
      const t = I18N[lang];
      el("pillFW").textContent = `${t.fwLabel}: ` + (data.fwText ?? "-");
      el("pillTEMP").textContent = `${t.tempLabel}: ` + (data.tempText ?? "-");
      el("pillExtTemp").textContent = `${t.extTempLabel}: ` + (data.extTempText ?? "-");
      el("pillExtHum").textContent = `${t.extHumLabel}: ` + (data.extHumText ?? "-");
      el("pillPower").textContent = `${t.powerLabel}: ` + (data.power1 ?? "-") + " dBm";
      el("pillRepeat").textContent = `${t.repeatLabel}: ` + (data.repeat1 ?? "-");
      el("pillWindow").textContent = `${t.windowLabel}: ` + (data.windowMs1 ?? "-") + " ms";
      const tagCount = data.count ?? (Array.isArray(data.tags) ? data.tags.length : 0);
      el("pillTags").textContent = `${t.tagsLabel}: ` + tagCount;
      el("pillReadMs").textContent = `${t.readMsLabel}: ` + (data.readMs ?? "-");

      const dt = new Date();
      el("updatedAtText").textContent = `${t.updatedAtLabel}: ` + dt.toLocaleString();
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
      const t = I18N[lang];
      el("pillFW").textContent = `${t.fwLabel}: -`;
      el("pillTEMP").textContent = `${t.tempLabel}: -`;
      el("pillPower").textContent = `${t.powerLabel}: -`;
      el("pillRepeat").textContent = `${t.repeatLabel}: -`;
      el("pillWindow").textContent = `${t.windowLabel}: -`;
      el("pillTags").textContent = `${t.tagsLabel}: -`;
      el("pillReadMs").textContent = `${t.readMsLabel}: -`;
      el("pillExtTemp").textContent = `${t.extTempLabel}: -`;
      el("pillExtHum").textContent = `${t.extHumLabel}: -`;
      el("updatedAtText").textContent = `${t.updatedAtLabel}: -`;
      el("rawPre").textContent = "{}";
      el("tagBody").innerHTML = '<tr><td colspan="7">-</td></tr>';
      el("rlBody").innerHTML = '<tr><td colspan="4">-</td></tr>';
    }

    let lastTagData = null;

            function renderTags(data){
      const tags = Array.isArray(data.tags) ? data.tags : [];
      lastTagData = data;
      if (tags.length === 0){
        allowNewRegistration = true;
        el("tagBody").innerHTML = '<tr><td colspan="7">-</td></tr>';
        return;
      }
      const unnamedTags = tags.filter((tag) => !(tag.name && String(tag.name).trim()));
      allowNewRegistration = unnamedTags.length <= 1;
      const t = I18N[lang];
      const rows = tags.map((tag) => {
        const epc = tag.id ?? tag.epc ?? "";
        const rssi = Number(tag.rssi ?? 0);
        const dupCount = Number(tag.count ?? 1);
        const name = (tag.name && String(tag.name).trim()) ? String(tag.name).trim() : "";
        const isUnnamed = !name;
        const nameState = tag.nameState === "new" ? "new" : "existing";
        const stateLabel = isUnnamed
          ? (nameState === "new" ? t.unnamedNewLabel : t.unnamedExistingLabel)
          : "";
        const show = (v) => (Number.isFinite(v) && v !== 0 ? v : "-");
        const showCount = (v) => (Number.isFinite(v) ? v : "-");
        const nameCell = name
          ? `<div>${name}</div>
             <button class="btn" data-action="edit-name" data-id="${epc}">${t.editLabel}</button>`
          : `<div>${stateLabel || t.newItemLabel}</div>
             <input class="tag-name-input" data-id="${epc}" type="text" maxlength="40" placeholder="${t.namePlaceholder}" />
             <button class="btn" data-action="save-name" data-id="${epc}">${t.saveLabel}</button>`;
        const confText = isUnnamed
          ? (nameState === "new" ? t.confNewLabel : t.confExistingLabel)
          : `${t.confRegisteredLabel} (${showCount(dupCount)})`;
        return `
          <tr>
            <td>${epc}</td>
            <td>${nameCell}</td>
            <td>${show(rssi)}</td>
            <td>-</td>
            <td>-</td>
            <td>${show(rssi)}</td>
            <td>${confText}</td>
          </tr>
        `;
      }).join("");
      el("tagBody").innerHTML = rows;
    }

    let lastServerStatus = "offline";
    let lastEspStatus = "offline";
    let allowNewRegistration = true;
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
        updateEspBadge(lastEspStatus);
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
          const m701 = data.fwTextM701 ?? "-";
          el("pillFW").textContent = "FW: ESP32 " + esp + " / M701 " + m701;
        }
        return;
      }

      if (data.type === "temp_result"){
        const t = I18N[lang];
        el("pillTEMP").textContent = `${t.tempLabel}: ` + (data.tempText ?? "-");
        el("pillExtTemp").textContent = `${t.extTempLabel}: ` + (data.extTempText ?? "-");
        el("pillExtHum").textContent = `${t.extHumLabel}: ` + (data.extHumText ?? "-");
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
        lastServerStatus = "online";
        updateServerBadge(lastServerStatus);
      });

      ws.addEventListener("close", () => {
        lastServerStatus = "offline";
        updateServerBadge(lastServerStatus);
        lastEspStatus = "offline";
        updateEspBadge(lastEspStatus);
        setTimeout(connectWs, 3000);
      });

      ws.addEventListener("message", handleWsMessage);
    }

    setLang("ja");
    el("btnINV").addEventListener("click", sendRfidRead);
        el("btnApply").addEventListener("click", sendConfig);
    el("btnCopyAll").addEventListener("click", applyBulkToAntFields);
    el("btnFW").addEventListener("click", () => sendCommand("get_fw"));
    el("btnTEMP").addEventListener("click", () => sendCommand("get_temp"));
    el("btnRL").addEventListener("click", () => sendCommand("get_return_loss"));
    el("btnCLEAR").addEventListener("click", clearUi);
    el("tagBody").addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute("data-action");
      if (!action) return;
      if (action === "save-name" && !allowNewRegistration) {
        const t = I18N[lang];
        alert(t.multiNewError);
        return;
      }
      const id = target.getAttribute("data-id") || "";
      if (!id) return;
      if (action === "save-name") {
        const input = el("tagBody").querySelector(`.tag-name-input[data-id="${id}"]`);
        if (input && input.value.trim()) {
          sendTagName(id, input.value.trim());
        }
      }
      if (action === "edit-name") {
        const t = I18N[lang];
        const name = prompt(t.promptName, "");
        if (name && name.trim()) {
          sendTagName(id, name.trim());
        }
      }
    });
    // Copy only when the button is pressed.
    connectWs();
  





