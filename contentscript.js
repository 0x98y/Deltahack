(function () {
  if (document.getElementById("result-iframe")) {
    alert("Deltahack is already running!");
    return;
  }
  console.log("Deltahack: Initializing...");
  // ─── API PROVIDERS ────────────────────────────────────────────────────────
  const PROVIDERS = {
    openrouter: {
      label: "OpenRouter",
      apiUrl: "https://openrouter.ai/api/v1/chat/completions",
      keyStorageKey: "openrouter_api_key",
      keyPlaceholder: "sk-or-...",
      keyHint: "Get your key from",
      keyHintUrl: "https://openrouter.ai/keys",
      keyHintLabel: "openrouter.ai/keys",
      models: [
        { label: "Gemini 2.0 Flash",          value: "google/gemini-2.0-flash-001" },
        { label: "Gemini 2.0 Flash (free)",    value: "google/gemini-2.0-flash-001:free" },
        { label: "Gemini 2.5 Flash Preview",   value: "google/gemini-2.5-flash-preview-05-20" },
        { label: "Gemini 2.5 Flash (free)",    value: "google/gemini-2.5-flash:free" },
        { label: "GPT-4o Mini",                value: "openai/gpt-4o-mini" },
        { label: "GPT-4o",                     value: "openai/gpt-4o" },
        { label: "Claude 3.5 Haiku",           value: "anthropic/claude-3-5-haiku" },
        { label: "Llama 3.3 70B",              value: "meta-llama/llama-3.3-70b-instruct" },
        { label: "Custom…",                    value: "custom" },
      ],
    },
    nvidia: {
      label: "NVIDIA NIM",
      apiUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
      keyStorageKey: "nvidia_api_key",
      keyPlaceholder: "nvapi-...",
      keyHint: "Get your key from",
      keyHintUrl: "https://build.nvidia.com",
      keyHintLabel: "build.nvidia.com",
      models: [
        { label: "Llama 3.3 70B Instruct",    value: "meta/llama-3.3-70b-instruct" },
        { label: "Llama 3.1 405B Instruct",   value: "meta/llama-3.1-405b-instruct" },
        { label: "Mistral Large",             value: "mistralai/mistral-large" },
        { label: "Mixtral 8x22B Instruct",    value: "mistralai/mixtral-8x22b-instruct" },
        { label: "Gemma 3 27B IT",            value: "google/gemma-3-27b-it" },
        { label: "Phi-4",                     value: "microsoft/phi-4" },
        { label: "DeepSeek R1 (free)",        value: "deepseek-ai/deepseek-r1" },
        { label: "Qwen2.5 72B Instruct",      value: "qwen/qwen2.5-72b-instruct" },
        { label: "Custom…",                   value: "custom" },
      ],
    },
  };
  const TOKEN_PRESETS = [512, 1024, 2048, 4096, 6144, 8192];
  // ─── STATE ────────────────────────────────────────────────────────────────
  function loadState() {
    return {
      resultIframe: null,
      styleTag: null,
      rawAnswer: "",
      autoCopy:         localStorage.getItem("math_scanner_auto_copy") === "true",
      autoFill:         localStorage.getItem("math_scanner_auto_fill") !== "false", // Default to true
      autoSubmit:       localStorage.getItem("math_scanner_auto_submit") === "true", // Default to false
      maxTokens:        parseInt(localStorage.getItem("math_scanner_max_tokens")) || 4096,
      showExplanations: localStorage.getItem("math_scanner_explanations") === "true",
      hideKeybind:      localStorage.getItem("math_scanner_hide_keybind") || "ctrl+e",
      scanKeybind:      localStorage.getItem("math_scanner_scan_keybind") || "ctrl+r",
      proxyUrl:         localStorage.getItem("math_scanner_proxy_url") || "",
      temperature:      parseFloat(localStorage.getItem("math_scanner_temperature")) || 0.2,
      provider:         localStorage.getItem("math_scanner_provider") || "openrouter",
      openrouterKey:    localStorage.getItem("openrouter_api_key") || "",
      openrouterModel:  localStorage.getItem("math_scanner_openrouter_model") || "google/gemini-2.0-flash-001",
      nvidiaKey:        localStorage.getItem("nvidia_api_key") || "",
      nvidiaModel:      localStorage.getItem("math_scanner_nvidia_model") || "meta/llama-3.3-70b-instruct",
      isHidden: false,
      graphCount: 0,
      lastActions: [],
      retryCount: 0,
      lastScanContext: null
    };
  }
  let state = loadState();
  function activeProvider() { return PROVIDERS[state.provider]; }
  function activeApiKey()   { return state.provider === "openrouter" ? state.openrouterKey : state.nvidiaKey; }
  function activeModel()    { return state.provider === "openrouter" ? state.openrouterModel : state.nvidiaModel; }
  function setActiveKey(k)  { if (state.provider === "openrouter") state.openrouterKey = k; else state.nvidiaKey = k; }
  function setActiveModel(m){ if (state.provider === "openrouter") state.openrouterModel = m; else state.nvidiaModel = m; }
  // ─── UTILITIES ────────────────────────────────────────────────────────────
  function loadLucideIfNeeded() {
    if (!window.lucide) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/lucide@latest";
      script.onload = () => { if (window.lucide) window.lucide.createIcons(); };
      document.head.appendChild(script);
    } else {
      window.lucide.createIcons();
    }
  }
  async function secureType(value, elementOrSelector) {
    let el = null;
    if (elementOrSelector) {
      if (typeof elementOrSelector === "string") {
        el = document.querySelector(elementOrSelector);
        if (el && el.classList.contains("mq-editable-field")) {
          el = el.querySelector("textarea");
        }
      } else {
        el = elementOrSelector;
        if (el && el.classList.contains("mq-editable-field")) {
          el = el.querySelector("textarea");
        }
      }
    }
    
    if (!el) {
      el = document.querySelector(".mq-editable-field textarea, input[type='text'], input[type='number']");
    }
    if (!el) return console.log("No input field found.");
    
    el.focus();
    el.value = "";
    for (const char of String(value)) {
      const code = char.charCodeAt(0);
      const opts = { key: char, keyCode: code, which: code, bubbles: true };
      el.dispatchEvent(new KeyboardEvent("keydown", opts));
      el.value += char;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keyup", opts));
      await new Promise(r => setTimeout(r, Math.random() * 50 + 30));
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
  }
  async function typeMathQuill(value, el) {
    try {
      const MQ = window.MathQuill && window.MathQuill.getInterface ? window.MathQuill.getInterface(2) : null;
      if (MQ) {
        const mathField = MQ.MathField(el);
        if (mathField) {
          mathField.latex(value);
          console.log("Deltahack: Filled MathQuill using API.");
          return;
        }
      }
    } catch (e) {
      console.warn("Deltahack: MathQuill API failed, using secureType fallback.", e);
    }
    const textarea = el.querySelector("textarea");
    if (textarea) {
      await secureType(value, textarea);
    } else {
      console.error("Deltahack: MathQuill textarea not found.");
    }
  }
  async function selectMCOption(index, selector, env) {
    let btn = null;
    if (env && env.mcOptions && env.mcOptions[index]) {
      btn = env.mcOptions[index].element;
    }
    if (!btn && selector) {
      btn = document.querySelector(selector);
    }
    if (!btn) {
      const buttons = document.querySelectorAll(".choice-button, .multiple-choice-option, .mc-option, label.btn, button.btn-default");
      if (buttons[index]) {
        btn = buttons[index];
      }
    }
    if (btn) {
      btn.click();
      console.log(`Deltahack: Selected MC option index ${index}`);
      return true;
    }
    console.error(`Deltahack: MC option at index ${index} not found.`);
    return false;
  }
  function autoClickMC(answerText) {
    const buttons = document.querySelectorAll(".choice-button, .multiple-choice-option, .btn-default, label");
    let found = false;
    buttons.forEach(btn => {
      const btnText = btn.innerText.trim().toLowerCase();
      const cleanAns = answerText.trim().toLowerCase();
      if (btnText === cleanAns || (btnText.length > 0 && cleanAns.includes(btnText))) {
        btn.click(); found = true;
      }
    });
    return found;
  }
  async function selectDropdownValue(dropdownId, value, env) {
    let selectEl = null;
    if (env && env.dropdowns) {
      const dd = env.dropdowns.find(d => d.id === dropdownId);
      if (dd) selectEl = dd.element;
    }
    if (!selectEl) {
      const match = dropdownId.match(/\d+/);
      if (match) {
        const idx = parseInt(match[0]);
        const selects = document.querySelectorAll("select");
        if (selects[idx]) selectEl = selects[idx];
      }
    }
    if (selectEl) {
      let matchedOption = null;
      const cleanVal = value.trim().toLowerCase();
      for (let i = 0; i < selectEl.options.length; i++) {
        const optText = selectEl.options[i].text.trim().toLowerCase();
        const optVal = selectEl.options[i].value.trim().toLowerCase();
        if (optText === cleanVal || optVal === cleanVal || optText.includes(cleanVal)) {
          matchedOption = selectEl.options[i];
          break;
        }
      }
      if (matchedOption) {
        selectEl.value = matchedOption.value;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        console.log(`Deltahack: Selected dropdown option "${matchedOption.text}"`);
        return true;
      }
    }
    console.error(`Deltahack: Dropdown or option not found: ${dropdownId} = ${value}`);
    return false;
  }
  function evaluateMathExpressions(answer) {
    const regex = /{{(.*?)}}/g;
    return answer.replace(regex, (match, expression) => {
      try {
        let sanitized = expression.replace(/\s+/g, "");
        let testString = sanitized.replace(/Math\.sqrt/g, "").replace(/Math\.PI/g, "");
        if (/[^0-9\+\-\*\/\.\(\)\[\]\^,A-Za-z]/g.test(testString)) return "[Invalid Expression]";
        const variableCheckString = testString.replace(/(\d+(?:\.\d+)?)[eE][\+\-]?\d+/g, "");
        if (/[A-Za-z]/.test(variableCheckString)) return expression.trim();
        sanitized = sanitized.replace(/\^/g, "**").replace(/(\d)(\()/g, "$1*$2")
          .replace(/\)(\d)/g, ")*$2").replace(/\)\(/g, ")*(")
          .replace(/(\d)(Math\.sqrt)/g, "$1*$2").replace(/(\d)(Math\.PI)/g, "$1*$2");
        const result = new Function("return " + sanitized)();
        if (typeof result === "number" && result % 1 !== 0) {
          const rs = result.toString();
          if (rs.includes(".") && rs.split(".")[1].length > 4) return parseFloat(result.toFixed(4)).toString();
        }
        return result.toString();
      } catch (error) {
        return `[Calculation Error: ${expression}]`;
      }
    });
  }
  function formatAnswerForDisplay(answer) {
    const escapeHtml = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    let safe = answer.replace(/«([^»]+)»/g, "$1");
    safe = escapeHtml(safe);
    safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
    safe = safe.replace(/\^\{([^}]+)\}/g, "<sup>$1</sup>");
    safe = safe.replace(/([A-Za-z0-9\)\]])\^(-?\d+(?:\.\d+)?)/g, "$1<sup>$2</sup>");
    safe = safe.replace(/Math\.sqrt/g, "&radic;").replace(/Math\.PI/g, "&pi;");
    safe = safe.replace(/ \* /g, " &times; ").replace(/\n/g, "<br>");
    safe = safe.replace(/ {2,}/g, m => "&nbsp;".repeat(m.length));
    return safe;
  }
  function extractRawAnswer(text) {
    if (!text) return "";
    const matches = [];
    const re = /«([^»]+)»/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const part = (m[1] || "").trim();
      if (part) matches.push(part);
    }
    return matches.join("\n");
  }
  async function copyWithRetry(text, retries = 3, delay = 100) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText = "position:fixed;opacity:0";
          document.body.appendChild(ta);
          ta.focus(); ta.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(ta);
          if (!ok) throw new Error("execCommand copy failed");
        }
        return true;
      } catch (e) {
        if (attempt < retries) await new Promise(r => setTimeout(r, delay));
        else throw e;
      }
    }
  }
  function executeSandboxedJS(code, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const id = "sbx_" + Math.random().toString(36).substr(2, 12);
      let timer, iframe;
      const cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        if (iframe && iframe.parentNode) iframe.remove();
      };
      const handler = (e) => {
        if (!e.data || e.data.sbxId !== id) return;
        if (e.data.ready) { iframe.contentWindow.postMessage({ sbxId: id, code }, "*"); return; }
        cleanup();
        if (e.data.error) reject(new Error(e.data.error));
        else resolve(e.data.result);
      };
      window.addEventListener("message", handler);
      iframe = document.createElement("iframe");
      iframe.sandbox = "allow-scripts";
      iframe.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;z-index:-1";
      iframe.srcdoc = [
        "<script>",
        "window.addEventListener('message', function(e) {",
        "  if (!e.data || e.data.sbxId !== '" + id + "') return;",
        "  try {",
        "    var __fn = new Function(e.data.code);",
        "    var __r = __fn();",
        "    parent.postMessage({sbxId: '" + id + "', result: __r == null ? 'undefined' : String(__r)}, '*');",
        "  } catch(err) {",
        "    parent.postMessage({sbxId: '" + id + "', error: err.message}, '*');",
        "  }",
        "});",
        "parent.postMessage({sbxId: '" + id + "', ready: true}, '*');",
        "<\/script>",
      ].join("\n");
      document.body.appendChild(iframe);
      timer = setTimeout(() => { cleanup(); reject(new Error("Code execution timed out (" + timeout + "ms)")); }, timeout);
    });
  }
  function transpilePythonToJS(pyCode) {
    let js = pyCode;
    js = js.replace(/^\s*(import\s+math|from\s+math\s+import\s+[^;\n]*)\s*$/gm, "");
    js = js.replace(/^\s*import\s+\w+.*$/gm, "");
    js = js.replace(/^\s*from\s+\w+\s+import\s+.*$/gm, "");
    const mathMap = {
      "math.sqrt":"Math.sqrt","math.pi":"Math.PI","math.e":"Math.E","math.sin":"Math.sin",
      "math.cos":"Math.cos","math.tan":"Math.tan","math.asin":"Math.asin","math.acos":"Math.acos",
      "math.atan":"Math.atan","math.atan2":"Math.atan2","math.log10":"Math.log10","math.log2":"Math.log2",
      "math.log":"Math.log","math.floor":"Math.floor","math.ceil":"Math.ceil","math.pow":"Math.pow",
      "math.fabs":"Math.abs","math.inf":"Infinity",
    };
    for (const [py, jsFn] of Object.entries(mathMap)) js = js.split(py).join(jsFn);
    js = js.replace(/\babs\(/g, "Math.abs(");
    js = js.replace(/\bround\(([^,)]+),\s*(\d+)\)/g, "parseFloat(($1).toFixed($2))");
    js = js.replace(/\bround\(([^)]+)\)/g, "Math.round($1)");
    js = js.replace(/\bint\(/g, "Math.trunc(");
    js = js.replace(/\bfloat\(/g, "Number(");
    js = js.replace(/\bstr\(/g, "String(");
    js = js.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null");
    js = js.replace(/(\w[\w.]*)\s*\/\/\s*(\w[\w.]*)/g, "Math.floor($1 / $2)");
    js = js.replace(/(^|\s)#(.*)$/gm, "$1//$2");
    let hasPrint = /\bprint\s*\(/.test(js);
    if (hasPrint) {
      js = "var __out = [];\n" + js.replace(/\bprint\s*\(([^)]*)\)/g, "__out.push(String($1))") + '\nreturn __out.join("\\n");';
    } else if (!/\breturn\b/.test(js)) {
      let lines = js.split("\n").filter(l => l.trim());
      if (lines.length > 0) {
        let last = lines[lines.length - 1].trim();
        if (!last.startsWith("var ") && !last.startsWith("let ") && !last.startsWith("//") && !last.startsWith("}") && last !== "") {
          lines[lines.length - 1] = "return " + last;
        }
      }
      js = lines.join("\n");
    }
    return js;
  }
  async function processCodeBlocks(answer) {
    const jsBlockRegex = /\[EXEC_JS\]([\s\S]*?)\[\/EXEC_JS\]/g;
    const pyBlockRegex = /\[EXEC_PY\]([\s\S]*?)\[\/EXEC_PY\]/g;
    let result = answer;
    const blocks = [];
    let match;
    while ((match = jsBlockRegex.exec(answer)) !== null) blocks.push({ full: match[0], code: match[1].trim(), lang: "js", index: match.index });
    while ((match = pyBlockRegex.exec(answer)) !== null) blocks.push({ full: match[0], code: match[1].trim(), lang: "py", index: match.index });
    if (blocks.length === 0) return answer;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      try {
        let codeToRun = block.code;
        codeToRun = codeToRun.replace(/\\"/g, '"').replace(/\\'/g, "'");
        if (block.lang === "py") codeToRun = transpilePythonToJS(codeToRun);
        const execResult = await executeSandboxedJS(codeToRun);
        result = result.replace(block.full, execResult);
      } catch (err) {
        result = result.replace(block.full, `[Code Error: ${err.message}]`);
      }
    }
    return result;
  }
  function cleanJsonResponse(text) {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return cleaned;
  }
  async function parseAIResult(text) {
    let cleanedText = cleanJsonResponse(text);
    
    // 1. Try parsing as JSON first
    try {
      cleanedText = await processCodeBlocks(cleanedText);
      const parsed = JSON.parse(cleanedText);
      if (parsed && typeof parsed === "object") {
        parsed.thinking = parsed.thinking || "";
        parsed.actions = parsed.actions || [];
        parsed.answers_display = parsed.answers_display || [];
        parsed.confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
        return parsed;
      }
    } catch (e) {
      console.warn("Deltahack: Failed to parse AI response as JSON. Trying guillemet fallback.", e);
    }
    
    // 2. Fallback to guillemet parsing (v3 style)
    const rawText = await processCodeBlocks(text);
    const rawAnswers = [];
    const re = /«([^»]+)»/g;
    let m;
    while ((m = re.exec(rawText)) !== null) {
      const part = (m[1] || "").trim();
      if (part) rawAnswers.push(part);
    }
    
    const actions = [];
    const env = analyzePageEnvironment();
    
    if (rawAnswers.length > 0) {
      if (env.questionType === "multiple_choice") {
        rawAnswers.forEach(ans => {
          const idx = env.mcOptions.findIndex(o => o.text.trim().toLowerCase() === ans.toLowerCase() || ans.toLowerCase().includes(o.text.trim().toLowerCase()));
          if (idx !== -1) {
            actions.push({ type: "mc_select", optionIndex: idx });
          }
        });
      } else {
        rawAnswers.forEach((ans, idx) => {
          if (env.inputFields[idx]) {
            actions.push({ type: "fill", fieldId: env.inputFields[idx].id, value: ans });
          } else if (env.inputFields[0]) {
            actions.push({ type: "fill", fieldId: env.inputFields[0].id, value: ans });
          }
        });
      }
    }
    
    return {
      thinking: rawText.replace(/«([^»]+)»/g, "$1"),
      actions: actions,
      answers_display: rawAnswers,
      confidence: rawAnswers.length > 0 ? 0.8 : 0.0
    };
  }
  // ─── GRAPH ENGINE ──────────────────────────────────────────────────────────
  class GraphEngine {
    constructor(svgElement) {
      this.svg = svgElement;
      this.svgToDataX = null;
      this.svgToDataY = null;
      this.dataToSvgX = null;
      this.dataToSvgY = null;
      this.initScales();
    }
    initScales() {
      const svg = this.svg;
      
      function parseTicks(axisClass, isYAxis) {
        const ticks = [];
        svg.querySelectorAll("g." + axisClass + ".axis .tick").forEach(tick => {
          const t = tick.getAttribute("transform") || "";
          const m = isYAxis
            ? t.match(/translate\(0,\s*(-?[\d.]+)/)
            : t.match(/translate\((-?[\d.]+)/);
          if (!m) return;
          const textEl = tick.querySelector("text");
          if (!textEl) return;
          const val = parseFloat(textEl.textContent.trim());
          if (!isNaN(val)) ticks.push({ svg: parseFloat(m[1]), val });
        });
        return ticks.sort((a, b) => a.svg - b.svg);
      }
      const xTicks = parseTicks("x", false);
      const yTicks = parseTicks("y", true);
      const buildScale = (ticks) => {
        if (ticks.length < 2) return null;
        const lo = ticks[0], hi = ticks[ticks.length - 1];
        const slope = (hi.val - lo.val) / (hi.svg - lo.svg);
        
        const svgToData = svgCoord => {
          const raw = lo.val + slope * (svgCoord - lo.svg);
          return Math.round(raw * 10000) / 10000;
        };
        
        const dataToSvg = dataCoord => {
          return lo.svg + (dataCoord - lo.val) / slope;
        };
        
        return { svgToData, dataToSvg };
      };
      const xScale = buildScale(xTicks);
      const yScale = buildScale(yTicks);
      if (xScale) {
        this.svgToDataX = xScale.svgToData;
        this.dataToSvgX = xScale.dataToSvg;
      }
      if (yScale) {
        this.svgToDataY = yScale.svgToData;
        this.dataToSvgY = yScale.dataToSvg;
      }
    }
    async dispatchMouseEvent(type, sx, sy) {
      const rect = this.svg.getBoundingClientRect();
      const clientX = rect.left + sx;
      const clientY = rect.top + sy;
      
      const opts = {
        clientX: clientX,
        clientY: clientY,
        button: 0,
        buttons: 1,
        bubbles: true,
        cancelable: true,
        view: window
      };
      
      let target = this.svg;
      const overlay = this.svg.querySelector("rect[fill='none'][pointer-events='all']") || this.svg.querySelector(".delta-graph-overlay");
      if (overlay) target = overlay;
      
      target.dispatchEvent(new MouseEvent(type, opts));
      await new Promise(r => setTimeout(r, 50));
    }
    async clickAtDataCoords(x, y) {
      if (!this.dataToSvgX || !this.dataToSvgY) {
        console.error("Deltahack: Scales not initialized on GraphEngine");
        return;
      }
      const sx = this.dataToSvgX(x);
      const sy = this.dataToSvgY(y);
      console.log(`Deltahack: Plotting point (${x}, ${y}) at pixel (${sx}, ${sy})`);
      
      await this.dispatchMouseEvent("mousedown", sx, sy);
      await this.dispatchMouseEvent("mouseup", sx, sy);
      await this.dispatchMouseEvent("click", sx, sy);
    }
    async selectTool(toolName) {
      const buttons = document.querySelectorAll("button, .btn, .tool-btn, [class*='tool']");
      let targetBtn = null;
      buttons.forEach(btn => {
        const txt = btn.innerText.trim().toLowerCase();
        if (txt.includes(toolName.toLowerCase())) {
          targetBtn = btn;
        }
      });
      if (targetBtn) {
        console.log(`Deltahack: Activating tool "${toolName}"`);
        targetBtn.click();
        await new Promise(r => setTimeout(r, 200));
        return true;
      }
      console.warn(`Deltahack: Tool "${toolName}" button not found.`);
      return false;
    }
    async plotPoint(x, y) {
      await this.selectTool("point") || await this.selectTool("plot");
      await this.clickAtDataCoords(x, y);
    }
    async drawLine(x1, y1, x2, y2) {
      await this.selectTool("line");
      await this.clickAtDataCoords(x1, y1);
      await this.clickAtDataCoords(x2, y2);
    }
    async drawParabola(vx, vy, px, py) {
      await this.selectTool("parabola");
      await this.clickAtDataCoords(vx, vy);
      await this.clickAtDataCoords(px, py);
    }
  }
  // ─── GRAPH EXTRACTION ──────────────────────────────────────────────────────
  function extractGraphData(doc) {
    doc = doc || document;
    const svgs = doc.querySelectorAll("svg.delta-graph");
    if (!svgs.length) return null;
    const descriptions = [];
    svgs.forEach((svg, svgIdx) => {
      try {
        const ariaLabel = svg.getAttribute("aria-label") || "";
        function parseAxisTicks(axisClass, isY) {
          const ticks = [];
          svg.querySelectorAll("g." + axisClass + ".axis .tick").forEach(tick => {
            const t = tick.getAttribute("transform") || "";
            const m = isY
              ? t.match(/translate\(0,\s*(-?[\d.]+)/)
              : t.match(/translate\((-?[\d.]+)/);
            if (!m) return;
            const textEl = tick.querySelector("text");
            if (!textEl) return;
            const val = parseFloat(textEl.textContent.trim());
            if (!isNaN(val)) ticks.push({ svg: parseFloat(m[1]), val });
          });
          return ticks.sort((a, b) => a.svg - b.svg);
        }
        const xTicks = parseAxisTicks("x", false);
        const yTicks = parseAxisTicks("y", true);
        function buildScale(ticks) {
          if (ticks.length < 2) return null;
          const lo = ticks[0], hi = ticks[ticks.length - 1];
          const slope = (hi.val - lo.val) / (hi.svg - lo.svg);
          return svgCoord => {
            const raw = lo.val + slope * (svgCoord - lo.svg);
            return Math.round(raw * 10000) / 10000;
          };
        }
        const svgToDataX = buildScale(xTicks);
        const svgToDataY = buildScale(yTicks);
        const seenLabels = new Set();
        const labels = [];
        svg.querySelectorAll("text").forEach(el => {
          const txt = el.textContent.trim();
          if (txt.length > 2 && !/^-?[\d.]+$/.test(txt) && !seenLabels.has(txt)) {
            seenLabels.add(txt);
            labels.push(txt);
          }
        });
        const seenPoints = new Set();
        const keyPoints = [];
        svg.querySelectorAll("circle").forEach(c => {
          const r = parseFloat(c.getAttribute("r") || "0");
          if (r < 1) return;
          const cx = parseFloat(c.getAttribute("cx"));
          const cy = parseFloat(c.getAttribute("cy"));
          if (isNaN(cx) || isNaN(cy) || !svgToDataX || !svgToDataY) return;
          const dx = svgToDataX(cx);
          const dy = svgToDataY(cy);
          const key = `${dx},${dy}`;
          if (!seenPoints.has(key)) {
            seenPoints.add(key);
            const fill = (c.getAttribute("fill") || "").toLowerCase();
            keyPoints.push({ x: dx, y: dy, open: fill === "white" });
          }
        });
        const curves = [];
        svg.querySelectorAll("path.func").forEach(path => {
          if (!svgToDataX || !svgToDataY) return;
          const d = path.getAttribute("d") || "";
          if (!d) return;
          const rawCoords = [];
          const re = /[ML]\s*(-?[\d.e+\-]+),\s*(-?[\d.e+\-]+)/g;
          let m;
          while ((m = re.exec(d)) !== null) {
            rawCoords.push([parseFloat(m[1]), parseFloat(m[2])]);
          }
          if (rawCoords.length < 2) return;
          const N = 7;
          const samples = [];
          for (let i = 0; i < N; i++) {
            const idx = Math.round(i * (rawCoords.length - 1) / (N - 1));
            const [sx, sy] = rawCoords[Math.min(idx, rawCoords.length - 1)];
            samples.push([svgToDataX(sx), svgToDataY(sy)]);
          }
          const [x0, y0] = samples[0];
          const [xN, yN] = samples[N - 1];
          let isLinear = true;
          if (xN !== x0) {
            const expectedSlope = (yN - y0) / (xN - x0);
            for (let i = 1; i < samples.length - 1; i++) {
              const [xi, yi] = samples[i];
              const expectedY = y0 + expectedSlope * (xi - x0);
              if (Math.abs(yi - expectedY) > 0.5) { isLinear = false; break; }
            }
          }
          let slope = null, intercept = null;
          if (isLinear && xN !== x0) {
            slope     = Math.round((yN - y0) / (xN - x0) * 10000) / 10000;
            intercept = Math.round((y0 - slope * x0) * 10000) / 10000;
          }
          const dashArray = path.getAttribute("stroke-dasharray") || "5,0";
          const isDashed  = dashArray !== "5,0" && dashArray !== "";
          curves.push({ samples, isLinear, slope, intercept, x0, y0, xN, yN, isDashed });
        });
        const parts = [`[GRAPH ${svgIdx + 1}]`];
        if (ariaLabel) parts.push(`Description: "${ariaLabel}"`);
        if (labels.length) parts.push(`Labels: ${labels.join(" | ")}`);
        if (keyPoints.length) {
          const ptStr = keyPoints
            .map(p => `${p.open ? "○" : "●"}(${p.x}, ${p.y})`)
            .join(", ");
          parts.push(`Plotted points (●=closed, ○=open): ${ptStr}`);
        }
        curves.forEach((curve, i) => {
          const style = curve.isDashed ? " [dashed]" : "";
          const type  = curve.isLinear ? "Line" : "Curve";
          const pts   = curve.samples.map(([x, y]) => `(${x},${y})`).join(" ");
          parts.push(`${type}${i + 1}${style} — sampled points: ${pts}`);
          if (curve.isLinear && curve.slope !== null) {
            parts.push(`  → Pre-computed: slope=${curve.slope}, y-intercept=${curve.intercept}, equation: y=${curve.slope}x+(${curve.intercept})`);
          }
        });
        descriptions.push(parts.join("\n"));
      } catch (e) {
        console.error("Deltahack: Graph parse error:", e);
      }
    });
    return descriptions.length ? descriptions.join("\n\n") : null;
  }
  // ─── ENVIRONMENT ANALYSIS ──────────────────────────────────────────────────
  function analyzePageEnvironment(doc) {
    doc = doc || document;
    
    const iframe = document.querySelector("iframe.tool_launch");
    if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
      doc = iframe.contentDocument;
    }
    
    let questionEl = doc.querySelector(".problem-text, .question-text, [class*='question-container'], [class*='problem-container']");
    if (!questionEl) {
      questionEl = doc.querySelector("#problem-container") || doc.querySelector(".question") || doc.body;
    }
    
    let cleanHTML = "";
    if (questionEl) {
      const clone = questionEl.cloneNode(true);
      clone.querySelectorAll("script, style, iframe, button, svg.delta-graph").forEach(el => el.remove());
      cleanHTML = clone.innerHTML.trim();
    }
    
    const questionText = questionEl ? questionEl.innerText.trim() : doc.body.innerText.trim();
    
    const inputFields = [];
    let fieldIdx = 0;
    
    const mqFields = doc.querySelectorAll(".mq-editable-field, .mq-root-block");
    mqFields.forEach((el, idx) => {
      if (inputFields.some(f => f.element === el || f.element.contains(el))) return;
      
      let label = el.getAttribute("aria-label") || "";
      if (!label) {
        const prev = el.previousSibling;
        if (prev && prev.nodeType === Node.TEXT_NODE) {
          label = prev.textContent.trim();
        } else if (el.previousElementSibling) {
          label = el.previousElementSibling.innerText.trim();
        }
      }
      
      const selector = `.mq-editable-field:nth-of-type(${idx + 1})`;
      inputFields.push({
        id: `field_${fieldIdx++}`,
        type: "mathquill",
        label: label || `Math Input ${idx + 1}`,
        selector: selector,
        element: el,
        currentValue: el.innerText.trim()
      });
    });
    
    const inputs = doc.querySelectorAll("input[type='text'], input[type='number'], textarea");
    inputs.forEach((el, idx) => {
      if (el.closest(".mq-editable-field")) return;
      
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || el.type === "hidden") return;
      
      let label = el.placeholder || el.getAttribute("aria-label") || "";
      if (!label && el.id) {
        const lblEl = doc.querySelector(`label[for="${el.id}"]`);
        if (lblEl) label = lblEl.innerText.trim();
      }
      if (!label && el.previousElementSibling) {
        label = el.previousElementSibling.innerText.trim();
      }
      
      const selector = `input[type='text']:nth-of-type(${idx + 1}), input[type='number']:nth-of-type(${idx + 1}), textarea:nth-of-type(${idx + 1})`;
      inputFields.push({
        id: `field_${fieldIdx++}`,
        type: "text",
        label: label || `Input ${idx + 1}`,
        selector: selector,
        element: el,
        currentValue: el.value
      });
    });
    
    const mcOptions = [];
    const choiceButtons = doc.querySelectorAll(".choice-button, .multiple-choice-option, .mc-option, label.btn, button.btn-default");
    choiceButtons.forEach((el, idx) => {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return;
      
      mcOptions.push({
        index: idx,
        text: el.innerText.trim(),
        selector: `.choice-button:nth-of-type(${idx + 1}), .multiple-choice-option:nth-of-type(${idx + 1}), .mc-option:nth-of-type(${idx + 1}), label.btn:nth-of-type(${idx + 1}), button.btn-default:nth-of-type(${idx + 1})`,
        element: el
      });
    });
    
    const dropdowns = [];
    const selects = doc.querySelectorAll("select");
    selects.forEach((el, idx) => {
      const options = Array.from(el.options).map(o => o.text.trim()).filter(t => t !== "");
      let label = el.getAttribute("aria-label") || "";
      if (!label && el.previousElementSibling) {
        label = el.previousElementSibling.innerText.trim();
      }
      
      dropdowns.push({
        id: `dd_${idx}`,
        label: label || `Dropdown ${idx + 1}`,
        options: options,
        selector: `select:nth-of-type(${idx + 1})`,
        element: el
      });
    });
    
    let graphCanvas = null;
    const svgGraph = doc.querySelector("svg.delta-graph, .graph-container, canvas, [class*='graph']");
    if (svgGraph) {
      const descriptions = extractGraphData(doc);
      const availableTools = [];
      doc.querySelectorAll("button, .btn, .tool-btn, [class*='tool']").forEach(btn => {
        const txt = btn.innerText.trim().toLowerCase();
        if (txt.includes("point") || txt.includes("plot")) availableTools.push("point");
        if (txt.includes("line")) availableTools.push("line");
        if (txt.includes("parabola") || txt.includes("curve")) availableTools.push("parabola");
        if (txt.includes("segment")) availableTools.push("segment");
        if (txt.includes("ray")) availableTools.push("ray");
      });
      
      graphCanvas = {
        present: true,
        element: svgGraph,
        descriptions: descriptions,
        availableTools: [...new Set(availableTools)],
        xRange: [-10, 10],
        yRange: [-10, 10]
      };
    }
    
    let questionType = "free_response";
    if (mcOptions.length > 0) {
      questionType = "multiple_choice";
    } else if (graphCanvas && graphCanvas.present) {
      questionType = "graphing";
    } else if (dropdowns.length > 0) {
      questionType = "dropdown";
    } else if (inputFields.length > 1) {
      questionType = "multi_part";
    }
    
    return {
      questionType,
      questionHTML: cleanHTML,
      questionText,
      inputFields,
      mcOptions,
      dropdowns,
      graphCanvas,
      doc
    };
  }
  function buildAIContext(env) {
    let context = `QUESTION TEXT:\n${env.questionText}\n\n`;
    context += `QUESTION TYPE: ${env.questionType}\n\n`;
    
    if (env.inputFields.length > 0) {
      context += `INPUT FIELDS:\n`;
      env.inputFields.forEach(f => {
        context += `  - ID: ${f.id}, Label: "${f.label}", Type: ${f.type}, Current Value: "${f.currentValue}"\n`;
      });
      context += `\n`;
    }
    
    if (env.mcOptions.length > 0) {
      context += `MULTIPLE CHOICE OPTIONS:\n`;
      env.mcOptions.forEach(o => {
        context += `  - Option Index: ${o.index}, Text: "${o.text}"\n`;
      });
      context += `\n`;
    }
    
    if (env.dropdowns.length > 0) {
      context += `DROPDOWNS:\n`;
      env.dropdowns.forEach(d => {
        context += `  - ID: ${d.id}, Label: "${d.label}", Options: ${JSON.stringify(d.options)}\n`;
      });
      context += `\n`;
    }
    
    if (env.graphCanvas && env.graphCanvas.present) {
      context += `GRAPH CANVAS DATA:\n`;
      context += `  - Available Tools: ${JSON.stringify(env.graphCanvas.availableTools)}\n`;
      if (env.graphCanvas.descriptions) {
        context += `${env.graphCanvas.descriptions}\n`;
      } else {
        context += `  - No pre-plotted elements found.\n`;
      }
      context += `\n`;
    }
    
    return context;
  }
  async function executeActions(actions, env) {
    if (!actions || actions.length === 0) return;
    
    const updateProgress = (text) => {
      const fillBtn = document.querySelector(".auto-fill-btn");
      if (fillBtn) {
        fillBtn.innerHTML = `<i data-lucide="loader-2"></i> <span style="font-size:11px;margin-left:4px">${text}</span>`;
        loadLucideIfNeeded();
      }
      console.log(`Deltahack Progress: ${text}`);
    };
    updateProgress("Starting GraphEngine...");
    let graphEngine = null;
    if (env.graphCanvas && env.graphCanvas.present) {
      graphEngine = new GraphEngine(env.graphCanvas.element);
    }
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const stepNum = `${i + 1}/${actions.length}`;
      
      try {
        if (action.type === "fill") {
          updateProgress(`Filling ${stepNum}...`);
          const field = env.inputFields.find(f => f.id === action.fieldId);
          if (field) {
            if (field.type === "mathquill") {
              await typeMathQuill(action.value, field.element);
            } else {
              await secureType(action.value, field.element);
            }
          } else {
            await secureType(action.value);
          }
        }
        else if (action.type === "mc_select") {
          updateProgress(`Selecting MC ${stepNum}...`);
          const opt = env.mcOptions[action.optionIndex];
          await selectMCOption(action.optionIndex, opt ? opt.selector : null, env);
        }
        else if (action.type === "dropdown") {
          updateProgress(`Selecting dropdown ${stepNum}...`);
          await selectDropdownValue(action.dropdownId, action.value, env);
        }
        else if (action.type === "graph_point") {
          updateProgress(`Plotting point ${stepNum}...`);
          if (graphEngine) {
            await graphEngine.plotPoint(action.x, action.y);
          } else {
            console.error("No graph element found for graph_point action");
          }
        }
        else if (action.type === "graph_line") {
          updateProgress(`Drawing line ${stepNum}...`);
          if (graphEngine) {
            await graphEngine.drawLine(action.x1, action.y1, action.x2, action.y2);
          } else {
            console.error("No graph element found for graph_line action");
          }
        }
        else if (action.type === "graph_parabola") {
          updateProgress(`Drawing curve ${stepNum}...`);
          if (graphEngine) {
            const vx = action.vertex[0];
            const vy = action.vertex[1];
            const px = action.point[0];
            const py = action.point[1];
            await graphEngine.drawParabola(vx, vy, px, py);
          } else {
            console.error("No graph element found for graph_parabola action");
          }
        }
        
        await new Promise(r => setTimeout(r, 300));
        
      } catch (e) {
        console.error(`Error executing action at step ${stepNum}:`, e);
      }
    }
    
    updateProgress("All filled!");
    
    if (state.autoSubmit) {
      updateProgress("Submitting...");
      await new Promise(r => setTimeout(r, 500));
      const submitBtn = env.doc.querySelector(".submit-btn, button[type='submit'], [class*='submit'], [class*='check']");
      if (submitBtn) {
        submitBtn.click();
        console.log("Deltahack: Submitted answer automatically.");
      }
    }
  }
  // ─── STYLES ───────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("math-scanner-style")) return;
    const style = document.createElement("style");
    style.id = "math-scanner-style";
    style.textContent = `
      @keyframes fadeIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
      @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
      @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      #result-iframe{position:fixed;top:20px;right:20px;background:#13151f;border:1px solid #252836;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.6);z-index:1000000;min-width:460px;min-height:120px;max-width:530px;max-height:calc(100vh - 40px);display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
      #result-iframe.animate-in{animation:fadeIn 0.25s ease-out}
      .result-header{background:linear-gradient(135deg,#1e2235 0%,#181b27 100%);color:#dde1ef;padding:11px 14px;cursor:move;display:flex;justify-content:space-between;align-items:center;font-weight:700;border-radius:14px 14px 0 0;font-size:13px;letter-spacing:0.02em;border-bottom:1px solid #252836;gap:8px}
      .header-left{display:flex;align-items:center;gap:8px;flex:1;min-width:0}
      .header-title{white-space:nowrap}
      .provider-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:0.04em;white-space:nowrap;flex-shrink:0}
      .provider-pill.openrouter{background:#1a3a2a;color:#4ade80;border:1px solid #2a5a3a}
      .provider-pill.nvidia{background:#1a2e40;color:#22d3ee;border:1px solid #1e4a60}
      .provider-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
      .provider-pill.openrouter .provider-dot{background:#4ade80}
      .provider-pill.nvidia .provider-dot{background:#22d3ee}
      /* ── NEW: Confidence badge and Action Log ── */
      .confidence-badge {display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:0.03em;white-space:nowrap;flex-shrink:0}
      .confidence-badge.high {background:#1a3a2a;color:#4ade80;border:1px solid #2a5a3a}
      .confidence-badge.medium {background:#3a2e1a;color:#fbbf24;border:1px solid #5a4a2a}
      .confidence-badge.low {background:#3a1a1a;color:#f87171;border:1px solid #5a2a2a}
      .action-log-container {margin-top:10px;border:1px solid #252836;border-radius:8px;background:#0b0d14;overflow:hidden;text-align:left}
      .action-log-header {background:#1e2235;padding:6px 10px;font-size:11px;font-weight:600;color:#8a90a8;cursor:pointer;display:flex;justify-content:space-between;align-items:center}
      .action-log-body {padding:8px;font-size:12px;color:#dde1ef;max-height:120px;overflow-y:auto;display:none}
      .action-log-item {display:flex;align-items:center;gap:6px;margin-bottom:4px}
      .action-log-item:last-child {margin-bottom:0}
      .action-log-icon {width:12px;height:12px;flex-shrink:0}
      .graph-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:0.03em;white-space:nowrap;flex-shrink:0;background:#2a1a3a;color:#c084fc;border:1px solid #4a2a6a}
      .graph-badge svg{width:11px;height:11px}
      .result-actions{display:flex;gap:6px;align-items:center;flex-shrink:0}
      .result-actions button{border:none;cursor:pointer;border-radius:7px;font-size:12px;height:27px;padding:0 9px;font-weight:500;transition:all 0.18s;display:flex;align-items:center;gap:5px}
      .result-actions button svg{width:13px;height:13px;stroke-width:2}
      .scan-btn{background:#2a3a55;color:#c5d5f0}
      .scan-btn:hover:not(:disabled){background:#3a4a65;transform:translateY(-1px)}
      .scan-btn:disabled{background:#1e2535;color:#4a5470;cursor:not-allowed;transform:none}
      .scan-btn:disabled svg{animation:spin 1s linear infinite}
      .auto-fill-btn{background:#263a5a;color:#7ab4f0}
      .auto-fill-btn:hover:not(:disabled){background:#2e4468;color:#dde1ef}
      .auto-fill-btn:disabled{opacity:0.4;cursor:not-allowed}
      .close-result-btn{background:none;color:#5a607a;font-size:17px;line-height:17px;padding:0 7px}
      .close-result-btn:hover{background:rgba(255,255,255,0.07);color:#dde1ef}
      .result-content{padding:16px;font-size:14px;line-height:1.7;white-space:pre-wrap;word-wrap:break-word;max-height:420px;overflow-y:auto;color:#dde1ef}
      .result-content code{background:#0b0d14;color:#7dd3fc;padding:2px 6px;border-radius:4px;font-family:'Consolas','Monaco','Courier New',monospace;font-size:12px;border:1px solid #1e2535}
      .result-content::-webkit-scrollbar{width:7px}
      .result-content::-webkit-scrollbar-track{background:#0b0d14;border-radius:7px}
      .result-content::-webkit-scrollbar-thumb{background:#252836;border-radius:7px}
      .result-content::-webkit-scrollbar-thumb:hover{background:#30354a}
      .loading{text-align:center;color:#5a607a;animation:pulse 1.5s ease-in-out infinite}
      .error{color:#f87171;animation:slideIn 0.25s ease-out}
      .ready-msg{text-align:center;padding:20px;color:#5a607a;font-size:13px}
      .result-footer{background:#0f1120;color:#3a4060;padding:6px 14px;text-align:center;font-size:11px;border-radius:0 0 14px 14px;border-top:1px solid #1a1d2a}
      .result-footer a{color:#5a607a;text-decoration:none;cursor:pointer}
      .result-footer a:hover{color:#8a90a8}
      .api-key-section{padding:18px}
      .api-key-section label{display:block;margin-bottom:7px;font-weight:600;color:#8a90a8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em}
      .api-key-section input{width:100%;padding:10px 12px;border:1px solid #252836;background:#0b0d14;color:#dde1ef;border-radius:8px;margin-bottom:10px;box-sizing:border-box;font-size:13px;transition:border-color 0.2s;font-family:'Consolas','Monaco','Courier New',monospace}
      .api-key-section input:focus{outline:none;border-color:#3a4060}
      .api-key-section button{width:100%;padding:10px;background:linear-gradient(135deg,#2a3a55 0%,#1e2d44 100%);color:#c5d5f0;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;transition:all 0.2s}
      .api-key-section button:hover{background:linear-gradient(135deg,#3a4a65 0%,#2a3d54 100%);transform:translateY(-1px)}
      .api-key-section small{color:#3a4060;font-size:11px}
      .api-key-section small a{color:#5a7ab0;text-decoration:none}
      .api-key-section small a:hover{text-decoration:underline}
      .settings-btn{background:#1e2535;color:#8a90a8}
      .settings-btn:hover{background:#2a3045;color:#dde1ef}
      .settings-container{padding:16px;max-height:calc(100vh - 120px);overflow-y:auto;overscroll-behavior:contain;text-align:left}
      .settings-container::-webkit-scrollbar{width:7px}
      .settings-container::-webkit-scrollbar-track{background:#0b0d14;border-radius:7px}
      .settings-container::-webkit-scrollbar-thumb{background:#252836;border-radius:7px}
      .settings-container::-webkit-scrollbar-thumb:hover{background:#30354a}
      .settings-section{margin-bottom:18px}
      .settings-section-title{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#3a4060;margin-bottom:10px;padding:0 2px}
      .setting-item{display:flex;flex-direction:column;padding:13px 14px;margin-bottom:10px;background:#0b0d14;border:1px solid #252836;border-radius:9px;gap:10px;animation:slideIn 0.25s ease-out}
      .setting-item:last-child{margin-bottom:0}
      .setting-item-row{display:flex;justify-content:space-between;align-items:center;gap:14px}
      .setting-label{flex:1;text-align:left}
      .setting-label-title{font-weight:600;color:#dde1ef;font-size:13px;margin-bottom:3px}
      .setting-label-desc{color:#5a607a;font-size:11px}
      .setting-control{flex-shrink:0}
      .setting-control input[type="text"],.setting-control input[type="password"],.setting-control input[type="number"]{padding:7px 10px;border:1px solid #252836;background:#13151f;color:#dde1ef;border-radius:6px;font-size:12px;width:190px;transition:border-color 0.2s;font-family:'Consolas','Monaco','Courier New',monospace}
      .setting-control input:focus{outline:none;border-color:#3a4060}
      .setting-toggle{width:46px;height:25px;background:#1e2535;border-radius:13px;position:relative;cursor:pointer;transition:background 0.2s}
      .setting-toggle.active{background:#263a5a}
      .setting-toggle-slider{position:absolute;top:3px;left:3px;width:19px;height:19px;background:#dde1ef;border-radius:50%;transition:transform 0.2s}
      .setting-toggle.active .setting-toggle-slider{transform:translateX(21px)}
      .provider-switcher{display:flex;gap:0;background:#0b0d14;border:1px solid #252836;border-radius:9px;overflow:hidden;margin-bottom:14px}
      .provider-switch-btn{flex:1;padding:9px 10px;border:none;cursor:pointer;font-size:12px;font-weight:600;letter-spacing:0.03em;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:6px}
      .provider-switch-btn svg{width:12px;height:12px}
      .provider-switch-btn.openrouter{background:transparent;color:#5a607a;border-right:1px solid #252836}
      .provider-switch-btn.openrouter.active{background:#1a3a2a;color:#4ade80}
      .provider-switch-btn.nvidia{background:transparent;color:#5a607a}
      .provider-switch-btn.nvidia.active{background:#1a2e40;color:#22d3ee}
      .token-slider-container{width:100%}
      .token-slider{width:100%;height:5px;background:#1e2535;border-radius:3px;outline:none;-webkit-appearance:none;appearance:none;cursor:pointer;border:none}
      .token-slider::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;background:#2a3a55;border-radius:50%;cursor:pointer;transition:all 0.2s;border:none}
      .token-slider::-webkit-slider-thumb:hover{background:#3a4a65;transform:scale(1.1)}
      .token-slider-labels{display:flex;justify-content:space-between;margin-top:7px;font-size:10px;color:#3a4060}
      .token-slider-value{text-align:center;color:#dde1ef;font-weight:600;font-size:13px;margin-bottom:7px}
      .model-preset-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;width:100%}
      .model-preset-btn{padding:7px 9px;background:#13151f;border:1px solid #252836;color:#8a90a8;border-radius:7px;cursor:pointer;font-size:11px;font-weight:500;text-align:left;transition:all 0.2s;line-height:1.3}
      .model-preset-btn:hover{background:#1e2535;color:#dde1ef;border-color:#30354a}
      .model-preset-btn.active.openrouter{background:#1a3a2a;border-color:#2a5a3a;color:#4ade80}
      .model-preset-btn.active.nvidia{background:#1a2e40;border-color:#1e4a60;color:#22d3ee}
      .model-custom-input{width:100%;padding:7px 10px;border:1px solid #252836;background:#13151f;color:#dde1ef;border-radius:6px;font-size:12px;box-sizing:border-box;transition:border-color 0.2s;font-family:'Consolas','Monaco','Courier New',monospace;margin-top:7px}
      .model-custom-input:focus{outline:none;border-color:#3a4060}
      .model-current-badge{display:inline-block;background:#0b0d14;border:1px solid #252836;color:#5a7ab0;border-radius:4px;padding:2px 7px;font-size:10px;font-family:'Consolas','Monaco','Courier New',monospace;margin-top:6px;word-break:break-all}
      .settings-buttons{display:flex;gap:10px;margin-top:14px}
      .back-settings-btn{width:42px;min-width:42px;height:42px;min-height:42px;padding:0;background:#1e2535;color:#8a90a8;border:none;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.2s;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .back-settings-btn:hover{background:#2a3045;color:#dde1ef;transform:translateY(-1px)}
      .back-settings-btn svg{width:17px;height:17px}
      .save-settings-btn-row{flex:1;height:42px;min-height:42px;padding:0 14px;display:flex;align-items:center;justify-content:center;gap:7px;background:linear-gradient(135deg,#2a3a55 0%,#1e2d44 100%);color:#c5d5f0;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;transition:all 0.2s}
      .save-settings-btn-row:hover{background:linear-gradient(135deg,#3a4a65 0%,#2a3d54 100%);transform:translateY(-1px)}
      .save-settings-btn-row svg{width:15px;height:15px}
    `;
    document.head.appendChild(style);
    state.styleTag = style;
  }
  // ─── DRAG ─────────────────────────────────────────────────────────────────
  function makeDraggable(element, handle) {
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0;
    handle.onmousedown = (e) => {
      e.preventDefault();
      p3 = e.clientX; p4 = e.clientY;
      document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
      document.onmousemove = (e) => {
        e.preventDefault();
        p1 = p3 - e.clientX; p2 = p4 - e.clientY;
        p3 = e.clientX; p4 = e.clientY;
        element.style.top = element.offsetTop - p2 + "px";
        element.style.left = element.offsetLeft - p1 + "px";
        element.style.right = "auto"; element.style.bottom = "auto";
      };
    };
  }
  function savedPosition() {
    if (!state.resultIframe) return null;
    return { top: state.resultIframe.style.top, left: state.resultIframe.style.left, right: state.resultIframe.style.right, bottom: state.resultIframe.style.bottom };
  }
  function restorePosition(div, pos) {
    if (!pos) return;
    if (pos.top)    div.style.top    = pos.top;
    if (pos.left)   div.style.left   = pos.left;
    if (pos.right)  div.style.right  = pos.right;
    if (pos.bottom) div.style.bottom = pos.bottom;
  }
  function removePanel() {
    if (state.resultIframe) { state.resultIframe.remove(); state.resultIframe = null; }
  }
  // ─── HEADER PILLS ─────────────────────────────────────────────────────────
  function providerPillHTML() {
    const p = state.provider;
    const label = PROVIDERS[p].label;
    return `<span class="provider-pill ${p}"><span class="provider-dot"></span>${label}</span>`;
  }
  function graphBadgeHTML() {
    if (!state.graphCount) return "";
    return `<span class="graph-badge"><i data-lucide="bar-chart-2"></i>${state.graphCount} graph${state.graphCount > 1 ? "s" : ""}</span>`;
  }
  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  function showSettings() {
    const pos = savedPosition();
    removePanel();
    const resultDiv = document.createElement("div");
    resultDiv.id = "result-iframe";
    restorePosition(resultDiv, pos);
    const tokenIndex = Math.max(0, TOKEN_PRESETS.findIndex(v => v >= state.maxTokens));
    function modelGridHTML(providerKey) {
      const prov = PROVIDERS[providerKey];
      const currentModel = providerKey === "openrouter" ? state.openrouterModel : state.nvidiaModel;
      const isCustom = !prov.models.find(m => m.value !== "custom" && m.value === currentModel);
      return prov.models.map(m => {
        const isActive = m.value === "custom" ? isCustom : m.value === currentModel;
        return `<button class="model-preset-btn${isActive ? " active " + providerKey : ""}" data-model="${m.value}" data-provider="${providerKey}">${m.label}</button>`;
      }).join("");
    }
    resultDiv.innerHTML = `
      <div class="result-header">
        <div class="header-left">
          <span class="header-title">Settings</span>
        </div>
        <div class="result-actions">
          <button class="close-result-btn" title="Close">×</button>
        </div>
      </div>
      <div class="settings-container">
        <div class="settings-section">
          <div class="settings-section-title">API Provider</div>
          <div class="provider-switcher">
            <button class="provider-switch-btn openrouter${state.provider === "openrouter" ? " active" : ""}" data-p="openrouter">
              <i data-lucide="zap"></i> OpenRouter
            </button>
            <button class="provider-switch-btn nvidia${state.provider === "nvidia" ? " active" : ""}" data-p="nvidia">
              <i data-lucide="cpu"></i> NVIDIA NIM
            </button>
          </div>
        </div>
        <div class="settings-section" id="section-openrouter" style="display:${state.provider === "openrouter" ? "block" : "none"}">
          <div class="settings-section-title">OpenRouter</div>
          <div class="setting-item">
            <div class="setting-item-row">
              <div class="setting-label">
                <div class="setting-label-title">API Key</div>
                <div class="setting-label-desc">Your OpenRouter key</div>
              </div>
              <div class="setting-control">
                <input type="password" id="settings-or-key" placeholder="sk-or-..." value="${state.openrouterKey}">
              </div>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <div class="setting-label-title">Model</div>
              <div class="setting-label-desc">Pick a preset or enter a custom OpenRouter model ID</div>
            </div>
            <div class="model-preset-grid" id="or-model-grid">${modelGridHTML("openrouter")}</div>
            <input type="text" class="model-custom-input" id="or-model-custom"
              placeholder="e.g. google/gemini-2.5-flash-preview-05-20"
              value="${state.openrouterModel}"
              style="display:${(!PROVIDERS.openrouter.models.find(m => m.value !== "custom" && m.value === state.openrouterModel)) ? "block" : "none"}">
            <div class="model-current-badge" id="or-model-badge">${state.openrouterModel}</div>
          </div>
        </div>
        <div class="settings-section" id="section-nvidia" style="display:${state.provider === "nvidia" ? "block" : "none"}">
          <div class="settings-section-title">NVIDIA NIM</div>
          <div class="setting-item">
            <div class="setting-item-row">
              <div class="setting-label">
                <div class="setting-label-title">API Key</div>
                <div class="setting-label-desc">Your NVIDIA NIM key</div>
              </div>
              <div class="setting-control">
                <input type="password" id="settings-nv-key" placeholder="nvapi-..." value="${state.nvidiaKey}">
              </div>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <div class="setting-label-title">Model</div>
              <div class="setting-label-desc">Pick a preset or enter a custom NVIDIA NIM model ID</div>
            </div>
            <div class="model-preset-grid" id="nv-model-grid">${modelGridHTML("nvidia")}</div>
            <input type="text" class="model-custom-input" id="nv-model-custom"
              placeholder="e.g. meta/llama-3.1-405b-instruct"
              value="${state.nvidiaModel}"
              style="display:${(!PROVIDERS.nvidia.models.find(m => m.value !== "custom" && m.value === state.nvidiaModel)) ? "block" : "none"}">
            <div class="model-current-badge" id="nv-model-badge">${state.nvidiaModel}</div>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-title">General</div>
          <div class="setting-item">
            <div class="setting-label">
              <div class="setting-label-title">Max Tokens</div>
              <div class="setting-label-desc">Higher values allow harder problems; uses quota faster</div>
            </div>
            <div class="token-slider-container">
              <div class="token-slider-value" id="token-value">${TOKEN_PRESETS[tokenIndex]}</div>
              <input type="range" class="token-slider" id="settings-max-tokens" min="0" max="${TOKEN_PRESETS.length - 1}" step="1" value="${tokenIndex}">
              <div class="token-slider-labels">${TOKEN_PRESETS.map(v => `<span>${v}</span>`).join("")}</div>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-item-row">
              <div class="setting-label">
                <div class="setting-label-title">Temperature</div>
                <div class="setting-label-desc">0.0 = deterministic · 2.0 = very creative</div>
              </div>
              <div class="setting-control">
                <input type="number" id="settings-temperature" min="0" max="2" step="0.1" value="${state.temperature}" style="width:80px">
              </div>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-item-row">
              <div class="setting-label">
                <div class="setting-label-title">Show Explanations</div>
                <div class="setting-label-desc">Include step-by-step reasoning</div>
              </div>
              <div class="setting-control">
                <div class="setting-toggle ${state.showExplanations ? "active" : ""}" id="settings-explanations">
                  <div class="setting-toggle-slider"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-item-row">
              <div class="setting-label">
                <div class="setting-label-title">Auto-Fill Answers</div>
                <div class="setting-label-desc">Automatically fill answers after scanning</div>
              </div>
              <div class="setting-control">
                <div class="setting-toggle ${state.autoFill ? "active" : ""}" id="settings-autofill">
                  <div class="setting-toggle-slider"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-item-row">
              <div class="setting-label">
                <div class="setting-label-title">Auto-Submit</div>
                <div class="setting-label-desc">Submit answers automatically after filling</div>
              </div>
              <div class="setting-control">
                <div class="setting-toggle ${state.autoSubmit ? "active" : ""}" id="settings-autosubmit">
                  <div class="setting-toggle-slider"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-item-row">
              <div class="setting-label">
                <div class="setting-label-title">Hide Keybind</div>
                <div class="setting-label-desc">Quick hide/show panel</div>
              </div>
              <div class="setting-control">
                <input type="text" id="settings-keybind" placeholder="ctrl+e" value="${state.hideKeybind}">
              </div>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-item-row">
              <div class="setting-label">
                <div class="setting-label-title">Scan Keybind</div>
                <div class="setting-label-desc">Quick scan shortcut</div>
              </div>
              <div class="setting-control">
                <input type="text" id="settings-scan-keybind" placeholder="ctrl+r" value="${state.scanKeybind}">
              </div>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-item-row">
              <div class="setting-label">
                <div class="setting-label-title">Proxy URL</div>
                <div class="setting-label-desc">Route API calls through a proxy to bypass CSP (optional)</div>
              </div>
              <div class="setting-control">
                <input type="text" id="settings-proxy-url" placeholder="https://your-proxy.workers.dev" value="${state.proxyUrl}">
              </div>
            </div>
          </div>
        </div>
        <div class="settings-buttons">
          <button class="back-settings-btn" id="back-settings" title="Go back"><i data-lucide="chevron-left"></i></button>
          <button class="save-settings-btn-row" id="save-settings"><i data-lucide="save"></i><span>Save Settings</span></button>
        </div>
      </div>
      <div class="result-footer">
        <span>Made by dio061779 on cord · <a id="discord-link">discord.gg/unblocking</a></span>
      </div>`;
    let localProvider  = state.provider;
    let orModel        = state.openrouterModel;
    let nvModel        = state.nvidiaModel;
    resultDiv.querySelectorAll(".provider-switch-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        localProvider = btn.dataset.p;
        resultDiv.querySelectorAll(".provider-switch-btn").forEach(b => {
          b.classList.toggle("active", b.dataset.p === localProvider);
        });
        resultDiv.querySelector("#section-openrouter").style.display = localProvider === "openrouter" ? "block" : "none";
        resultDiv.querySelector("#section-nvidia").style.display     = localProvider === "nvidia"     ? "block" : "none";
      });
    });
    function wireModelGrid(gridId, customInputId, badgeId, providerKey, modelSetter) {
      const grid = resultDiv.querySelector(gridId);
      const customInput = resultDiv.querySelector(customInputId);
      const badge = resultDiv.querySelector(badgeId);
      grid.addEventListener("click", (e) => {
        const btn = e.target.closest(".model-preset-btn");
        if (!btn || btn.dataset.provider !== providerKey) return;
        const val = btn.dataset.model;
        grid.querySelectorAll(".model-preset-btn").forEach(b => b.classList.remove("active", "openrouter", "nvidia"));
        btn.classList.add("active", providerKey);
        if (val === "custom") {
          customInput.style.display = "block";
          customInput.focus();
          modelSetter(customInput.value.trim() || "");
        } else {
          customInput.style.display = "none";
          modelSetter(val);
          badge.textContent = val;
        }
      });
      customInput.addEventListener("input", () => {
        modelSetter(customInput.value.trim());
        badge.textContent = customInput.value.trim() || "(none)";
      });
    }
    wireModelGrid("#or-model-grid", "#or-model-custom", "#or-model-badge", "openrouter", v => { orModel = v; });
    wireModelGrid("#nv-model-grid", "#nv-model-custom", "#nv-model-badge", "nvidia",     v => { nvModel = v; });
    const tokenSlider  = resultDiv.querySelector("#settings-max-tokens");
    const tokenDisplay = resultDiv.querySelector("#token-value");
    tokenSlider.addEventListener("input", () => { tokenDisplay.textContent = TOKEN_PRESETS[parseInt(tokenSlider.value)]; });
    const explToggle = resultDiv.querySelector("#settings-explanations");
    explToggle.addEventListener("click", () => explToggle.classList.toggle("active"));
    const fillToggle = resultDiv.querySelector("#settings-autofill");
    fillToggle.addEventListener("click", () => fillToggle.classList.toggle("active"));
    const submitToggle = resultDiv.querySelector("#settings-autosubmit");
    submitToggle.addEventListener("click", () => submitToggle.classList.toggle("active"));
    resultDiv.querySelector("#save-settings").addEventListener("click", () => {
      state.provider = localProvider;
      localStorage.setItem("math_scanner_provider", localProvider);
      const orKey = resultDiv.querySelector("#settings-or-key").value.trim();
      if (orKey) { state.openrouterKey = orKey; localStorage.setItem("openrouter_api_key", orKey); }
      if (orModel) { state.openrouterModel = orModel; localStorage.setItem("math_scanner_openrouter_model", orModel); }
      const nvKey = resultDiv.querySelector("#settings-nv-key").value.trim();
      if (nvKey) { state.nvidiaKey = nvKey; localStorage.setItem("nvidia_api_key", nvKey); }
      if (nvModel) { state.nvidiaModel = nvModel; localStorage.setItem("math_scanner_nvidia_model", nvModel); }
      state.maxTokens = TOKEN_PRESETS[parseInt(tokenSlider.value)];
      localStorage.setItem("math_scanner_max_tokens", state.maxTokens.toString());
      const temp = parseFloat(resultDiv.querySelector("#settings-temperature").value);
      if (!isNaN(temp) && temp >= 0 && temp <= 2) { state.temperature = temp; localStorage.setItem("math_scanner_temperature", temp.toString()); }
      state.showExplanations = explToggle.classList.contains("active");
      localStorage.setItem("math_scanner_explanations", state.showExplanations.toString());
      state.autoFill = fillToggle.classList.contains("active");
      localStorage.setItem("math_scanner_auto_fill", state.autoFill.toString());
      state.autoSubmit = submitToggle.classList.contains("active");
      localStorage.setItem("math_scanner_auto_submit", state.autoSubmit.toString());
      const hk = resultDiv.querySelector("#settings-keybind").value.trim();
      if (hk) { state.hideKeybind = hk; localStorage.setItem("math_scanner_hide_keybind", hk); }
      const sk = resultDiv.querySelector("#settings-scan-keybind").value.trim();
      if (sk) { state.scanKeybind = sk; localStorage.setItem("math_scanner_scan_keybind", sk); }
      state.proxyUrl = resultDiv.querySelector("#settings-proxy-url").value.trim();
      localStorage.setItem("math_scanner_proxy_url", state.proxyUrl);
      showResult("Ready to scan", false, true, true);
    });
    resultDiv.querySelector("#back-settings").addEventListener("click", () => {
      showResult("Ready to scan", false, true, true);
    });
    resultDiv.querySelector(".close-result-btn").addEventListener("click", () => {
      resultDiv.remove(); state.resultIframe = null;
    });
    const discordLink = resultDiv.querySelector("#discord-link");
    if (discordLink) discordLink.addEventListener("click", e => { e.preventDefault(); window.open("https://discord.gg/unblocking", "_blank"); });
    document.body.appendChild(resultDiv);
    state.resultIframe = resultDiv;
    makeDraggable(resultDiv, resultDiv.querySelector(".result-header"));
    loadLucideIfNeeded();
  }
  // ─── SCAN ─────────────────────────────────────────────────────────────────
  async function scanPage() {
    const scanBtn = document.querySelector(".scan-btn");
    if (scanBtn) { scanBtn.disabled = true; scanBtn.innerHTML = `<i data-lucide="loader-2"></i>`; loadLucideIfNeeded(); }
    try {
      const env = analyzePageEnvironment();
      if (!env.questionText || env.questionText.trim() === "") {
        throw new Error("Could not extract question content from the page.");
      }
      state.graphCount = env.graphCanvas ? 1 : 0;
      await sendToAI(env);
    } catch (error) {
      showResult({ error: error.message }, true);
    }
  }
  async function sendToAI(env) {
    const key = activeApiKey();
    if (!key) { showResult("Error: API key not set for " + activeProvider().label, true); return; }
    showResult("Loading...", false);
    const prov   = activeProvider();
    const apiUrl = state.proxyUrl || prov.apiUrl;
    const model  = activeModel();
    const systemPrompt = `Solve the math problem from this DeltaMath page. You will receive a structured representation of the page, including the question text, the available inputs, multiple choice options, dropdowns, and graph canvas details.
You must solve the problem and output your reasoning and actions as a valid JSON object.
CRITICAL RULE — MANDATORY CODE EXECUTION:
- You MUST perform ALL numerical calculations using [EXEC_JS]...[/EXEC_JS] blocks in your reasoning/explanation, but NOT in the action values themselves.
- If you use code blocks, they will be pre-executed before parsing the actions, so write standard expressions or numbers directly in the action values or wrap the entire JSON in [EXEC_JS] if needed. For example, you can wrap calculations in [EXEC_JS] blocks inside your JSON string values: "value": "[EXEC_JS]return Math.round(5000 * Math.pow(1.05, 12) * 100) / 100;[/EXEC_JS]"
Required JSON structure:
{
  "thinking": "Concise step-by-step reasoning explaining the mathematical steps.",
  "actions": [
    // Array of actions to solve the question. Execute in sequence.
    // ACTION TYPES:
    // 1. Fill a text/math field:
    //    { "type": "fill", "fieldId": "field_0", "value": "42" }
    // 2. Select a multiple choice option by its index (0-based):
    //    { "type": "mc_select", "optionIndex": 2 }
    // 3. Select a dropdown option:
    //    { "type": "dropdown", "dropdownId": "dd_0", "value": "decreases" }
    // 4. Plot a point on a graph:
    //    { "type": "graph_point", "x": 3, "y": -5 }
    // 5. Draw a line on a graph (needs 2 points):
    //    { "type": "graph_line", "x1": -2, "y1": 1, "x2": 4, "y2": 7 }
    // 6. Draw a parabola (needs vertex and another point on the curve):
    //    { "type": "graph_parabola", "vertex": [2, -3], "point": [4, 1] }
  ],
  "answers_display": ["x = 42"], // List of user-readable answers to display in the UI
  "confidence": 0.95 // Confidence score between 0.0 and 1.0
}
Ensure the response contains ONLY the valid JSON block (optionally containing [EXEC_JS] blocks). Do not wrap the JSON in Markdown backticks or any other text.
If you cannot solve the problem, return:
{
  "thinking": "Cannot solve this problem.",
  "actions": [],
  "answers_display": ["Cannot solve"],
  "confidence": 0.0
}
`.trim();
    let historyContext = "";
    if (state.retryCount > 0 && state.lastScanContext) {
      historyContext = `[ATTENTION] The previous attempt with these actions: ${JSON.stringify(state.lastScanContext.actions)} was marked INCORRECT. Please re-evaluate the problem, recalculate carefully, and do not repeat the same incorrect answer/action.\n\n`;
    }
    const fullPrompt = systemPrompt + "\n\n" + historyContext + buildAIContext(env);
    try {
      const body = {
        model,
        messages: [{ role: "user", content: fullPrompt }],
        max_tokens: state.maxTokens,
        temperature: state.temperature,
      };
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch (e) { throw new Error(`API request failed (${response.status}): ${errorText}`); }
        throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
      }
      const data = await response.json();
      if (data.choices?.[0]?.finish_reason === "content_filter") throw new Error("Response blocked by content filter. Try again.");
      if (!data.choices?.[0]?.message?.content) {
        const fr = data.choices?.[0]?.finish_reason;
        throw new Error(fr && fr !== "stop" ? `Response blocked: ${fr}` : "No answer received.");
      }
      const rawAnswer = data.choices[0].message.content;
      const parsedResult = await parseAIResult(rawAnswer);
      showResult(parsedResult, false, false, true);
    } catch (error) {
      console.error("Deltahack: API error:", error);
      showResult({ error: error.message }, true);
    }
  }
  // ─── SHOW RESULT ──────────────────────────────────────────────────────────
  function showResult(resultData, isError = false, isReady = false, shouldAnimate = false) {
    const pos = savedPosition();
    removePanel();
    const resultDiv = document.createElement("div");
    resultDiv.id = "result-iframe";
    if (shouldAnimate) resultDiv.classList.add("animate-in");
    restorePosition(resultDiv, pos);
    state.isHidden = false;
    const isLoading = resultData === "Loading...";
    
    if (isLoading) {
      state.lastActions = [];
    }
    let thinkingHtml = "";
    let confidence = 0;
    let actions = [];
    let displayAnswers = [];
    if (isError) {
      thinkingHtml = typeof resultData === "string" ? resultData : resultData.error || "Unknown error";
    } else if (isLoading) {
      thinkingHtml = "Loading...";
    } else if (isReady) {
      thinkingHtml = "";
    } else {
      thinkingHtml = formatAnswerForDisplay(resultData.thinking || "");
      confidence = resultData.confidence || 0;
      actions = resultData.actions || [];
      displayAnswers = resultData.answers_display || [];
      state.lastActions = actions;
    }
    const confidenceLabel = confidence >= 0.8 ? "High" : confidence >= 0.5 ? "Medium" : "Low";
    const confidenceClass = confidenceLabel.toLowerCase();
    const confidenceBadge = (!isError && !isLoading && !isReady)
      ? `<span class="confidence-badge ${confidenceClass}" title="AI Confidence: ${(confidence * 100).toFixed(0)}%">${confidenceLabel} (${(confidence * 100).toFixed(0)}%)</span>`
      : "";
    const graphBadge = state.graphCount
      ? `<span class="graph-badge"><i data-lucide="bar-chart-2"></i>${state.graphCount} graph${state.graphCount > 1 ? "s" : ""}</span>`
      : "";
    const autoFillBtnHtml = (!isError && !isLoading && !isReady && actions.length > 0)
      ? `<button class="auto-fill-btn" title="Auto-fill answer"><i data-lucide="zap"></i><span>Auto-Fill</span></button>`
      : "";
    resultDiv.innerHTML = `
      <div class="result-header">
        <div class="header-left">
          <span class="header-title">Deltahack v4</span>
          ${providerPillHTML()}
          ${confidenceBadge}
          ${graphBadge}
        </div>
        <div class="result-actions">
          <button class="scan-btn" title="Scan page"><i data-lucide="play"></i></button>
          ${autoFillBtnHtml}
          <button class="settings-btn" title="Settings"><i data-lucide="settings"></i></button>
          <button class="close-result-btn" title="Close">×</button>
        </div>
      </div>
      <div class="result-content ${isError ? "error" : isLoading ? "loading" : ""}">
        ${isReady ? `<div class="ready-msg">Deltahack ready · ${activeProvider().label} · <code style="font-size:11px">${activeModel()}</code></div>` : ""}
      </div>
      <div class="result-footer">
        <span>Made by dio061779 on cord · <a id="retry-btn" style="margin-left: 10px; text-decoration: underline; display: none;">Retry with context</a></span>
      </div>`;
    const contentEl   = resultDiv.querySelector(".result-content");
    const scanBtn     = resultDiv.querySelector(".scan-btn");
    const autoFillBtn = resultDiv.querySelector(".auto-fill-btn");
    const settingsBtn = resultDiv.querySelector(".settings-btn");
    const closeButton = resultDiv.querySelector(".close-result-btn");
    const retryBtn    = resultDiv.querySelector("#retry-btn");
    if (retryBtn && !isError && !isLoading && !isReady) {
      retryBtn.style.display = "inline";
      retryBtn.addEventListener("click", () => {
        state.retryCount++;
        scanPage();
      });
    }
    if (isError) {
      if (scanBtn) { scanBtn.disabled = false; scanBtn.innerHTML = `<i data-lucide="play"></i>`; }
      contentEl.innerText = thinkingHtml;
    } else if (isLoading) {
      if (scanBtn) { scanBtn.disabled = true; scanBtn.innerHTML = `<i data-lucide="loader-2"></i>`; }
      contentEl.innerText = "Loading...";
    } else if (!isReady) {
      let contentHtml = "";
      
      if (displayAnswers.length > 0) {
        contentHtml += `<div style="font-weight: 700; color: #4ade80; margin-bottom: 10px; font-size: 15px;">Answer: ${displayAnswers.join(", ")}</div>`;
      }
      
      if (thinkingHtml) {
        contentHtml += `<div style="margin-bottom: 15px; border-left: 2px solid #2a3a55; padding-left: 10px;">${thinkingHtml}</div>`;
      }
      if (actions.length > 0) {
        contentHtml += `
          <div class="action-log-container">
            <div class="action-log-header">
              <span>Actions Detected (${actions.length})</span>
              <i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i>
            </div>
            <div class="action-log-body">
              ${actions.map(act => {
                let icon = "edit-3";
                let desc = "";
                if (act.type === "fill") { desc = `Fill ${act.fieldId} with "${act.value}"`; }
                else if (act.type === "mc_select") { icon = "check-square"; desc = `Select choice at index ${act.optionIndex}`; }
                else if (act.type === "dropdown") { icon = "list"; desc = `Select dropdown ${act.dropdownId} = "${act.value}"`; }
                else if (act.type === "graph_point") { icon = "map-pin"; desc = `Plot point at (${act.x}, ${act.y})`; }
                else if (act.type === "graph_line") { icon = "trending-up"; desc = `Draw line from (${act.x1}, ${act.y1}) to (${act.x2}, ${act.y2})`; }
                else if (act.type === "graph_parabola") { icon = "activity"; desc = `Draw parabola: vertex (${act.vertex[0]}, ${act.vertex[1]}), point (${act.point[0]}, ${act.point[1]})`; }
                return `
                  <div class="action-log-item">
                    <i data-lucide="${icon}" class="action-log-icon"></i>
                    <span>${desc}</span>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      }
      contentEl.innerHTML = contentHtml;
      
      const logHeader = contentEl.querySelector(".action-log-header");
      const logBody = contentEl.querySelector(".action-log-body");
      if (logHeader && logBody) {
        logHeader.addEventListener("click", () => {
          const isCollapsed = logBody.style.display === "block";
          logBody.style.display = isCollapsed ? "none" : "block";
          const icon = logHeader.querySelector("i");
          if (icon) {
            icon.setAttribute("data-lucide", isCollapsed ? "chevron-right" : "chevron-down");
            loadLucideIfNeeded();
          }
        });
      }
    }
    if (scanBtn) {
      scanBtn.addEventListener("mousedown", e => e.stopPropagation());
      scanBtn.addEventListener("click", () => {
        state.retryCount = 0;
        scanPage();
      });
      if (!isError && !isReady) { scanBtn.innerHTML = `<i data-lucide="play"></i>`; scanBtn.disabled = false; }
    }
    if (settingsBtn) {
      settingsBtn.addEventListener("mousedown", e => e.stopPropagation());
      settingsBtn.addEventListener("click", showSettings);
    }
    if (autoFillBtn) {
      autoFillBtn.addEventListener("mousedown", e => e.stopPropagation());
      autoFillBtn.addEventListener("click", async () => {
        if (actions.length === 0) return;
        const env = analyzePageEnvironment();
        state.lastScanContext = { env, actions };
        await executeActions(actions, env);
        autoFillBtn.innerHTML = `<i data-lucide="check"></i> <span>Filled</span>`;
        loadLucideIfNeeded();
        setTimeout(() => { showResult(resultData, isError, isReady, false); }, 2000);
      });
    }
    if (closeButton) {
      closeButton.addEventListener("mousedown", e => e.stopPropagation());
      closeButton.addEventListener("click", () => { resultDiv.remove(); state.resultIframe = null; });
    }
    document.body.appendChild(resultDiv);
    state.resultIframe = resultDiv;
    makeDraggable(resultDiv, resultDiv.querySelector(".result-header"));
    loadLucideIfNeeded();
    if (!isError && !isLoading && !isReady && state.autoFill && actions.length > 0) {
      setTimeout(async () => {
        const env = analyzePageEnvironment();
        state.lastScanContext = { env, actions };
        await executeActions(actions, env);
      }, 500);
    }
  }
  // ─── KEYBINDS ─────────────────────────────────────────────────────────────
  function matchKeybind(e, kb) {
    const parts = kb.toLowerCase().split("+");
    const key = parts[parts.length - 1];
    const needsCtrl  = parts.includes("ctrl");
    const needsAlt   = parts.includes("alt");
    const needsShift = parts.includes("shift");
    return e.key.toLowerCase() === key &&
      (needsCtrl  ? e.ctrlKey  : !e.ctrlKey)  &&
      (needsAlt   ? e.altKey   : !e.altKey)   &&
      (needsShift ? e.shiftKey : !e.shiftKey);
  }
  document.addEventListener("keydown", (e) => {
    if (!state.resultIframe) return;
    if (matchKeybind(e, state.hideKeybind)) {
      e.preventDefault(); e.stopPropagation();
      state.isHidden = !state.isHidden;
      state.resultIframe.style.display = state.isHidden ? "none" : "flex";
      return;
    }
    if (matchKeybind(e, state.scanKeybind)) {
      e.preventDefault(); e.stopPropagation();
      const btn = document.querySelector(".scan-btn");
      if (btn && !btn.disabled) scanPage();
      return;
    }
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault(); e.stopPropagation();
      const btn = document.querySelector(".auto-fill-btn");
      if (btn && !btn.disabled) btn.click();
    }
  });
  // ─── INIT ─────────────────────────────────────────────────────────────────
  injectStyles();
  if (!state.openrouterKey && !state.nvidiaKey) {
    showSettings();
  } else {
    showResult("Ready to scan", false, true, true);
  }
})();
