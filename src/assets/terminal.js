class Terminal {
  constructor(opts = {}) {
    this.opts = {
      title: "Terminal",
      ...opts,
    };

    this._active = false;
    this._controller = null;
    this._lastFocused = null;

    this._argument = null;

    this._history = [];
    this._historyIndex = -1;

    this.runningFromFile = window.location.protocol === "file:";

    // ---- reusable events ----
    this.enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true
    });

    this.escEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      which: 27,
      bubbles: true
    });

    // ---- colors ----
    this.colorBlue="#3f9cff";
    this.colorBrown="#a07c4f";
    this.colorOrange="#f59e0b";
    this.colorPink="#ec4899";
    this.colorGray="#94a3b8"; 
    this.colorGreen="#4cb56f";
    this.colorRed="#ef4444";
  }

  async openAndRun(req) {
    this.open(req);
    
    try { await this.httpRequest(req); } 
    catch (e) {
      // errors already printed by run(); rethrow if you want
    }
  }

  open(req) {
    if (!this.overlay) {
      this._ensureDom();
      this._printHelp();
    }
    
    if (this._active) return;
    this._active = true;

    this._lastFocused = document.activeElement;

    this.overlay.classList.remove("hidden");
    this.dialog.classList.remove("hidden");

    this.title.textContent = `Discovery: ${req.refId}`;

    this.input.value = `request -X ${req.method} ${req.url}`;
    this.input.focus();

    // prevent background scroll
    this._prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
  }

  show(input) {
    if (!this.overlay) {
      this._ensureDom();
      this._printHelp();
    }
    
    if (this._active) return;
    this._active = true;

    this._lastFocused = document.activeElement;

    this.overlay.classList.remove("hidden");
    this.dialog.classList.remove("hidden");

    this.title.textContent = `Discovery: ${input.refId}`;

    this._argument = input.argument;

    this.input.value = `${input.command}`;
    this.input.focus();

    if (input.run) {
      this.input.dispatchEvent(this.enterEvent);
    }

    // prevent background scroll
    this._prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
  }

  close() {
    if (!this._active) return;
    this._active = false;

    this.abort("Modal closed");

    this.overlay.classList.add("hidden");
    this.dialog.classList.add("hidden");

    document.documentElement.style.overflow = this._prevOverflow || "";

    // restore focus to trigger
    if (this._lastFocused && typeof this._lastFocused.focus === "function") {
      this._lastFocused.focus();
    }
  }

  abort(reason = "Aborted") {
    if (this._controller) {
      try { this._controller.abort(reason); } catch {}
    }
    this._controller = null;
    this._setBusy(false);
  }

  async httpRequest(req) {
    const normalized = this._normalizeReq(req);
    this._resetTerminal();

    const cmd = `$ request ${this._getReqArgs(normalized)}`;
    this._addHistory(cmd)

    this._printLine("");
    this._printColoredLine(cmd, this.colorBlue);
    this._printLine("");

    this._setBusy(true);

    const t0 = performance.now();
    const controller = new AbortController();
    this._controller = controller;

    // Timeout: use AbortSignal.timeout() if available; else manual.
    let timeoutId = null;
    const timeoutMs = normalized.timeoutMs;

    let signal = controller.signal;
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" && timeoutMs > 0) {
      // combine signals: abort either manual or timeout
      signal = this._anySignal([controller.signal, AbortSignal.timeout(timeoutMs)]);
    } else if (timeoutMs > 0) {
      timeoutId = setTimeout(() => controller.abort("Timeout"), timeoutMs);
    }

    try {
      const fetchInit = {
        method: normalized.method,
        headers: {
          ...normalized.headers,
          "X-N42-Client-Version": `v${this.opts.pkgVersion}`,
        },
        body: normalized.body,
        signal,
        credentials: normalized.credentials,
        redirect: normalized.redirect,
        cache: "no-store",
        mode: normalized.mode,
      };

      this._printLine(`> ${normalized.method} ${normalized.url}`);
      for (const [k, v] of Object.entries(normalized.headers || {})) {
        this._printLine(`> ${k}: ${v}`);
      }
      if (normalized.body) this._printLine(`> (body ${this._byteLen(normalized.body)} bytes)`);
      this._printLine("");

      //this.title.textContent = `Request: ${normalized.method}`;

      const res = await fetch(normalized.url, fetchInit);

      const dt = (performance.now() - t0);
      this._printColoredLine(`< HTTP ${res.status} ${res.statusText} (${dt.toFixed(0)} ms)`, this.colorBrown);

      res.headers.forEach((v, k) => this._printColoredLine(`< ${k}: ${v}`, this.colorBrown));
      this._printLine("");

      const { text, truncated, bytesRead } = await this._readTextWithLimit(res, normalized.maxBytes);
      if (truncated) {
        this._printLine(`... [truncated after ${bytesRead} bytes (maxBytes=${normalized.maxBytes})] ...`);
        this._printLine("");
      }
      this._printRaw(text);

      this._printLine("");
      this._printColoredLine(`[done]`, this.colorGreen);

      this._setBusy(false);

      return { status: res.status, headers: res.headers, body: text, truncated };
    } 
    catch (err) {
      //console.log(err);

      //const name = err?.name || "error";
      const msg = err?.message || String(err);

      this._printColoredLine(`[error]: ${msg}`, this.colorRed);
      this._printLine("");
      this._printLine("Use the arrow keys to reselect the URL, then click the top-right button to open it in a browser tab instead.");
      
      this._setBusy(false);
       
      return { status: 0, headers: new Headers(), body: "", error: msg };
    } 
    finally {
      if (timeoutId) clearTimeout(timeoutId);
      this._controller = null;
    }
  }

  // ---------------- private ----------------

  _normalizeReq(req) {
    if (!req || typeof req.url !== "string") throw new Error("Missing url");

    const method = (req.method || "GET").toUpperCase();
    const headers = { ...(req.headers || {}) };

    // If body is object, default JSON
    let body = req.body ?? null;
    if (body && typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob)) {
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
      body = JSON.stringify(body);
    }

    return {
      url: req.url,
      method,
      headers,
      body,
      timeoutMs: Number.isFinite(req.timeoutMs) ? req.timeoutMs : 15000,
      maxBytes: Number.isFinite(req.maxBytes) ? req.maxBytes : 500_000,
      credentials: req.credentials || "same-origin", // set "include" if cookies are needed
      redirect: req.redirect || "follow",
      mode: req.mode || "cors",
    };
  }

  _addHistory(cmd) {
    cmd = cmd.replace("$", "");
    cmd = cmd.replace(/'/g, "");
  
    // push to history
    this._history.push(cmd.trim());
    this._historyIndex = this._history.length;
  }

  _jsonHighlight(json) {
    if (typeof json !== "string") {
      json = JSON.stringify(json, null, 2);
    }

    const esc = json
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return esc.replace(
      /"(step)"(\s*:\s*)"([^"]+)"|("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?)/g,
      (match, stepKey, colon, stepValue) => {

        // Special case: only color the VALUE of step
        if (stepKey) {
          return `<span class="cm-json-key">"${stepKey}"</span>${colon}<span class="cm-json-step">"${stepValue}"</span>`;
        }

        let cls = "number";

        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "key" : "string";
        } else if (/true|false/.test(match)) {
          cls = "boolean";
        } else if (/null/.test(match)) {
          cls = "null";
        }

        return `<span class="cm-json-${cls}">${match}</span>`;
      }
    );
  }

  _handleCommand(cmd) {
    if (cmd === "clear") {
      this._addHistory(cmd);
      this._resetTerminal();
      return;
    }

    if (cmd === "help") {
      this._addHistory(cmd);
      this._printHelp();
      return;
    }

    if (cmd.startsWith("parse ")) {
      const cmdParts = cmd.trim().split(/\s+/);
      if (cmdParts.length < 2) {
        this._printLine("");
        this._printColoredLine("[error]: Unknown item.", this.colorRed);
        return;
      }

      const item = cmdParts[1].trim();
      if (item) {
        switch(item) {
          case "naptr": {
              const parts = this._argument.split(".");
              const hash = parts[0];
              const scheme = parts[1];
              const env = parts[2];
              const smlDomain = parts.slice(3).join(".");

              this._printLine("");
              this._printColoredLine("$ parse NAPTR domain", this.colorBlue);
              this._printLine("");
              
              this._printColoredLine(`Environment        : ${env === "acc" ? "TEST" : "PROD"}`, this.colorPink);
              this._printLine(`Participant scheme : ${scheme}`);
              this._printLine(`Identifier hash    : ${hash}`);
              this._printLine(`${env === "acc" ? "SMK" : "SML"} domain         : ${smlDomain}`);
              break;
          }
        }
      }
      return;
    }
    
    if (cmd.startsWith("request ")) {
      if (this.runningFromFile) {
        this._addHistory(cmd);

        this._printLine("");
        this._printColoredLine(`$ ${cmd}`, this.colorBlue);

        this._printLine("");
        this._printColoredLine("[error]: CORS has blocked this request (the script is running from file://).", this.colorRed);
        this._printLine("");

        this._printLine("Use the arrow keys to reselect the URL, then click the top-right button to open it in a browser tab instead.");

        return;
      }
      // Parse: request [METHOD] <url>
      const m = cmd.match(/^request\s+(?:-X\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+)?(https?:\/\/\S+)$/i);

      if (m) {
        const method = m[1] ? m[1].toUpperCase() : "GET";
        const url = m[2];

        this.openAndRun({ url, method });
        return;
      }
    }

    if (cmd === "trace") {
      this._addHistory(cmd);
      
      if (discoveryTrace) {
        this._printLine("");
        this._printColoredLine("$ trace", this.colorBlue);
        this._printLine("");
        
        this._printLine(this._jsonHighlight(discoveryTrace));
      } 
      else {
        this._printColoredLine("[error]: Discovery trace missing", this.colorRed);
      }
      return;
    }
    
    this._printColoredLine("[error]: Unknown command", this.colorRed);  
  }

  _createImgEl(src, size, alt) {
    const img = document.createElement("img");
    img.src = src;
    img.width = size;
    img.height = size;
    img.alt = alt;
    return img;
  }

  _toggleTheme() {
    const themeLink = document.getElementById("terminal-style");

    // Check current theme file
    const isLight = themeLink.getAttribute("href").includes("terminal-light.css");

    if (isLight) {
      themeLink.setAttribute("href", "../../assets/terminal-dark.css");

      // Invert all icons for dark background
      //icons.forEach(icon => { icon.style.filter = "invert(100%) hue-rotate(180deg)"; });
    } 
    else {
      themeLink.setAttribute("href", "../../assets/terminal-light.css");
      
      // Reset icon colors to normal
      //icons.forEach(icon => { icon.style.filter = "none"; });
    }
  }

  _ensureDom() {
    if (this.overlay) return;

    const theme = this.opts.theme;
    const themeLink = document.getElementById("terminal-style");

    themeLink.setAttribute("href", `../../assets/terminal-${theme}.css`);

    // Overlay
    const overlay = document.createElement("div");
    overlay.className = "cm-overlay";
    overlay.hidden = true;

    // Dialog
    const dialog = document.createElement("div");
    dialog.className = "cm-dialog";
    dialog.hidden = true;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true"); // per aria-modal guidance
    dialog.setAttribute("aria-label", this.opts.title);

    // Input row (terminal prompt)
    const inputRow = document.createElement("div");
    inputRow.className = "cm-input-row";

    const prompt = document.createElement("span");
    prompt.className = "cm-prompt";
    prompt.textContent = ">";

    const input = document.createElement("input");
    input.className = "cm-input";
    input.placeholder = "type command...";
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const cmd = input.value.trim();
        input.value = "";

        if (!cmd) return;

        this._handleCommand(cmd);
      }

      // ---- HISTORY NAVIGATION ----
      if (e.key === "ArrowUp") {
        e.preventDefault();

        if (this._history.length === 0) return;

        this._historyIndex = Math.max(0, this._historyIndex - 1);
        input.value = this._history[this._historyIndex];
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();

        if (this._history.length === 0) return;

        this._historyIndex = Math.min(
          this._history.length,
          this._historyIndex + 1
        );

        input.value =
          this._historyIndex < this._history.length
            ? this._history[this._historyIndex]
            : "";
        return;
      }
    });

    inputRow.append(prompt, input);

    // Header
    const head = document.createElement("div");
    head.className = "cm-head";

    const title = document.createElement("div");
    title.id = "terminal-title";
    title.className = "cm-title";
    title.textContent = this.opts.title;

    const spacer = document.createElement("div");
    spacer.className = "cm-spacer";

    const copyImg = this._createImgEl("../../assets/copy-light.svg", 24, "Copy");
    const btnCopy = document.createElement("button");
    btnCopy.className = "cm-btn copy";
    btnCopy.type = "button";
    btnCopy.title = "Copy";
    btnCopy.prepend(copyImg); 
    btnCopy.addEventListener("click", () => this._copy());

    const downloadImg = this._createImgEl("../../assets/download-light.svg", 24, "Download");
    const btnDownload = document.createElement("button");
    btnDownload.className = "cm-btn";
    btnDownload.type = "button";
    btnDownload.title = "Download";
    btnDownload.prepend(downloadImg); 
    btnDownload.addEventListener("click", () => this._download());

    const openUrlImg = this._createImgEl("../../assets/open-external-light.svg", 24, "Open");
    const btnOpenUrl = document.createElement("button");
    btnOpenUrl.className = "cm-btn";
    btnOpenUrl.type = "button";
    btnOpenUrl.title = "Open URL";
    btnOpenUrl.prepend(openUrlImg);
    btnOpenUrl.addEventListener("click", () => this._openUrl());

    const themeImg = this._createImgEl("../../assets/theme-light.svg", 24, "Theme");
    const btnTheme = document.createElement("button");
    btnTheme.className = "cm-btn";
    btnTheme.type = "button";
    btnTheme.title = "Theme";
    btnTheme.prepend(themeImg);
    btnTheme.addEventListener("click", () => this._toggleTheme());

    head.append(title, spacer, btnTheme, btnCopy, btnDownload, btnOpenUrl);

    // Body
    const body = document.createElement("div");
    body.className = "cm-body";

    const term = document.createElement("div");
    term.className = "cm-term";
    term.setAttribute("role", "log");
    term.setAttribute("aria-live", "polite");

    body.appendChild(term);

    // Footer
    const foot = document.createElement("div");
    foot.className = "cm-foot";

    const status = document.createElement("div");
    status.className = "cm-status";
    status.textContent = "Ready";

    const hint = document.createElement("div");
    hint.className = "cm-spacer";
    hint.textContent = "";

    const kbdEsc = document.createElement("span");
    kbdEsc.className = "cm-kbd";
    kbdEsc.textContent = "ESC";

    const hint2 = document.createElement("div");
    hint2.style.opacity = ".75";
    hint2.style.fontSize = "12px";
    hint2.textContent = "to close";

    foot.append(status, hint, kbdEsc, hint2);

    dialog.append(head, body, inputRow, foot);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Store refs
    this.overlay = overlay;
    this.dialog = dialog;
    this.title = title;
    this.input = input;
    this.term = term;
    this.statusEl = status;

    this.btnCopy = btnCopy;
    this.btnDownload = btnDownload;
    this.btnOpenUrl = btnOpenUrl;
    this.btnTheme = btnTheme;

    // Close when clicking outside (optional)
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.close();
    });

    // Key handling + focus trap
    document.addEventListener("keydown", (e) => {
      if (!this._active) return;

      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
        return;
      }

      if (e.key === "Tab") {
        this._trapTab(e);
      }
    });
  }

  _trapTab(e) {
    // Basic focus trap: keep tabbing inside dialog controls.
    const focusables = this.dialog.querySelectorAll(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    const list = Array.from(focusables).filter(el => !el.disabled && el.offsetParent !== null);
    if (list.length === 0) return;

    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  _setBusy(isBusy) {
    this.statusEl.textContent = isBusy ? "Running…" : "Ready";
  }

  _openUrl() {
    if (input.value && this.input.value.length > 0) {
      const url = this.input.value.replace(/^.*?(?=https?:\/\/)/, "")
      window.open(url, '_blank');
    }
    else {
      this._printLine("");
      this._printColoredLine(`[error]: No URL selected`, this.colorRed);
      this._printLine("");
      this._printLine("Use the arrow keys to reselect the URL, then click the top-right button to open it in a browser tab instead.");
    }
  }

  _resetTerminal() {
    this.term.textContent = "";
  }

  _printHelp() {
    this._resetTerminal();

    this._printLine("Node42 Interactive Terminal (basic emulator)");
    this._printLine("--------------------------------------------------");
    this._printLine("This is a minimal command runner used inside the");
    this._printLine("interactive SVG to test and follow discovery links.");
    this._printLine("Only a small subset of commands is supported.");
    this._printLine("");

    this._printLine("Available commands:");
    this._printLine("  request [-X METHOD] &lturl&gt  – send HTTP request to a URL");
    this._printLine("  trace                      – output discovery trace");
    this._printLine("  clear                      – clear terminal output");
    this._printLine("  help                       – show this help text");
    this._printLine("");

    this._printLine("Keyboard support:");
    this._printLine("  • ENTER       – execute current command");
    this._printLine("  • ARROW UP    – previous command in history");
    this._printLine("  • ARROW DOWN  – next command in history");
    this._printLine("");

    this._printLine("Notes:");
    this._printLine("  • Output is read-only");
    this._printLine("  • No shell features (pipes, variables, etc.)");
    this._printLine("  • Designed only for quick API testing from diagrams");
    this._printLine("");

    this._printLine("Examples:");
    this._printLine("  request https://api.node42.dev/health");
    this._printLine("  request -X POST https://api.node42.dev/health");
  }

  _printLine(s) {
    const html = s.replace(/\r?\n/g, "<br>");
    this.term.innerHTML += `${html}<br>`;
    this._scrollToBottom();
  }

  _printColoredLine(s, color="#111827") {
    const html = this.term.innerHTML;
    this.term.innerHTML = `${html}<span style="color:${color};">${s}</span><br>`;
    this._scrollToBottom();
  }

  _printHtml(s) {
    this.term.innerHTML = s;
    this._scrollToBottom();
  }

  _printRaw(s) {
    // Detect if this is HTML content
    const isHtml = /^\s*</.test(s);

    let output;

    if (isHtml) {
      // Escape HTML so it is shown as text
      output = s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\r?\n/g, "<br>");
    } else {
      // Normal text handling
      output = s.replace(/\r?\n/g, "<br>");
    }

    this.term.innerHTML += output;

    if (!s.endsWith("\n")) {
      this.term.innerHTML += "<br>";
    }

    this._scrollToBottom();
  }

  _scrollToBottom() {
    const body = this.term.parentElement;
    body.scrollTop = body.scrollHeight;
  }

  async _copy() {
    const text = this.term.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      this.statusEl.textContent = "Copied";
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); this.statusEl.textContent = "Copied"; }
      catch { this.statusEl.textContent = "Copy failed"; }
      ta.remove();
    }
    setTimeout(() => (this.statusEl.textContent = "Ready"), 900);
  }

  _download() {
    const text = this.term.textContent || "";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `request-output-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  _getReqArgs(req) {
    // Presentational: escapes minimally for display (not execution-safe for all shells).
    const parts = [];
    parts.push(`-X ${req.method}`);
    for (const [k, v] of Object.entries(req.headers || {})) {
      parts.push(`-H ${this._shQuote(`${k}: ${v}`)}`);
    }
    if (req.body) parts.push(`--data ${this._shQuote(typeof req.body === "string" ? req.body : String(req.body))}`);
    parts.push(this._shQuote(req.url));
    return parts.join(" ");
  }

  _shQuote(s) {
    // single-quote shell style: ' -> '"'"'
    const str = String(s);
    return `'${str.replace(/'/g, `'"'"'`)}'`;
  }

  _byteLen(s) {
    if (typeof s !== "string") s = String(s);
    return new TextEncoder().encode(s).length;
  }

  async _readTextWithLimit(res, maxBytes) {
    // Reads response body safely with byte limit.
    // If no stream support, fall back to res.text() then truncate.
    const bytesLimit = Math.max(0, maxBytes | 0);

    if (!res.body || !res.body.getReader) {
      const full = await res.text();
      const enc = new TextEncoder().encode(full);
      if (enc.length <= bytesLimit) return { text: full, truncated: false, bytesRead: enc.length };
      // truncate bytes -> decode
      const cut = enc.slice(0, bytesLimit);
      return { text: new TextDecoder().decode(cut), truncated: true, bytesRead: bytesLimit };
    }

    const reader = res.body.getReader();
    const chunks = [];
    let bytesRead = 0;
    let truncated = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      if (bytesRead + value.byteLength > bytesLimit) {
        const allowed = bytesLimit - bytesRead;
        if (allowed > 0) chunks.push(value.slice(0, allowed));
        truncated = true;
        bytesRead = bytesLimit;
        try { reader.cancel("maxBytes reached"); } catch {}
        break;
      }

      chunks.push(value);
      bytesRead += value.byteLength;
    }

    const merged = this._concatU8(chunks, bytesRead);
    const text = new TextDecoder().decode(merged);
    return { text, truncated, bytesRead };
  }

  _concatU8(chunks, total) {
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.byteLength;
      if (offset >= total) break;
    }
    return out;
  }

  _anySignal(signals) {
    // Combine multiple AbortSignals into one.
    const controller = new AbortController();
    const onAbort = (sig) => {
      if (controller.signal.aborted) return;
      controller.abort(sig.reason || "Aborted");
    };
    for (const sig of signals) {
      if (!sig) continue;
      if (sig.aborted) {
        onAbort(sig);
        break;
      }
      sig.addEventListener("abort", () => onAbort(sig), { once: true });
    }
    return controller.signal;
  }
}