(function () {
  // 当前选中文本缓存，供翻译和朗读复用。
  let currentSelectedText = "";
  let readingState = "idle"; // idle | speaking | paused

  // 创建根容器。
  const panel = document.createElement("div");
  panel.id = "smart-helper-panel";

  // 工具条：按钮顺序严格为“翻译、朗读”。
  const toolbar = document.createElement("div");
  toolbar.className = "smart-helper-toolbar";

  const translateBtn = document.createElement("button");
  translateBtn.className = "smart-helper-btn primary";
  translateBtn.textContent = "翻译";

  const readBtn = document.createElement("button");
  readBtn.className = "smart-helper-btn";
  readBtn.textContent = "朗读";

  toolbar.appendChild(translateBtn);
  toolbar.appendChild(readBtn);

  // 翻译结果卡片。
  const card = document.createElement("div");
  card.className = "smart-helper-card";

  const langWrap = document.createElement("div");
  langWrap.className = "smart-helper-lang";
  langWrap.innerHTML = `
    <span>目标语言：</span>
    <label><input type="radio" name="smart-helper-lang" value="zh" checked /> 中文</label>
    <label><input type="radio" name="smart-helper-lang" value="en" /> 英文</label>
  `;

  const result = document.createElement("div");
  result.className = "smart-helper-result";
  result.textContent = "这里显示翻译结果…";

  const status = document.createElement("div");
  status.className = "smart-helper-status";
  status.textContent = "状态：等待操作";

  card.appendChild(langWrap);
  card.appendChild(result);
  card.appendChild(status);

  panel.appendChild(toolbar);
  panel.appendChild(card);
  document.documentElement.appendChild(panel);

  /**
   * 判断文本中是否包含中文字符。
   */
  function hasChinese(text) {
    return /[\u4e00-\u9fa5]/.test(text);
  }

  /**
   * 获取当前目标语言。
   */
  function getTargetLang() {
    const checked = panel.querySelector('input[name="smart-helper-lang"]:checked');
    return checked ? checked.value : "zh";
  }

  /**
   * 设置默认目标语言：中文内容默认翻英文，英文内容默认翻中文。
   */
  function setDefaultLangByText(text) {
    const target = hasChinese(text) ? "en" : "zh";
    const radio = panel.querySelector(`input[name="smart-helper-lang"][value="${target}"]`);
    if (radio) {
      radio.checked = true;
    }
  }

  /**
   * 安全显示面板位置，避免超出视口。
   */
  function showPanelAt(x, y) {
    panel.style.display = "block";
    panel.style.left = "0px";
    panel.style.top = "0px";

    const panelRect = panel.getBoundingClientRect();
    const margin = 8;
    let left = x;
    let top = y - panelRect.height - 10;

    if (left + panelRect.width > window.innerWidth - margin) {
      left = window.innerWidth - panelRect.width - margin;
    }
    if (left < margin) {
      left = margin;
    }
    if (top < margin) {
      top = y + 14;
    }
    if (top + panelRect.height > window.innerHeight - margin) {
      top = window.innerHeight - panelRect.height - margin;
    }

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  /**
   * 重置翻译区域展示状态。
   */
  function resetCard() {
    card.style.display = "none";
    result.textContent = "这里显示翻译结果…";
    status.textContent = "状态：等待操作";
  }

  /**
   * 发送翻译请求到后台脚本。
   */
  function doTranslate() {
    if (!currentSelectedText.trim()) {
      status.textContent = "状态：请选择有效文本";
      return;
    }

    card.style.display = "block";
    status.textContent = "状态：正在翻译…";
    result.textContent = "";

    // 扩展刚重载时，旧页面中的 content script 可能失效，调用 runtime 会抛错。
    // 这里兜底提示用户刷新页面，避免控制台出现未捕获异常。
    try {
      if (!chrome?.runtime?.id) {
        status.textContent = "状态：插件上下文已失效，请刷新当前页面后重试";
        result.textContent = "Extension context invalidated";
        return;
      }

      chrome.runtime.sendMessage(
        {
          action: "translate",
          text: currentSelectedText,
          targetLang: getTargetLang()
        },
        (resp) => {
          if (chrome.runtime.lastError) {
            status.textContent = "状态：翻译失败，请刷新页面后重试";
            result.textContent = chrome.runtime.lastError.message || "";
            return;
          }
          if (!resp?.ok) {
            status.textContent = "状态：翻译失败";
            result.textContent = resp?.error || "未知错误";
            return;
          }
          result.textContent = resp.translatedText;
          status.textContent = "状态：翻译完成";
        }
      );
    } catch (error) {
      status.textContent = "状态：插件上下文已失效，请刷新当前页面后重试";
      result.textContent = error?.message || "Extension context invalidated";
    }
  }

  /**
   * 控制朗读：首次点击开始，再次点击暂停/继续。
   */
  function toggleRead() {
    if (!("speechSynthesis" in window)) {
      status.textContent = "状态：当前页面不支持朗读";
      return;
    }
    if (!currentSelectedText.trim()) {
      status.textContent = "状态：请选择有效文本";
      return;
    }

    if (readingState === "speaking") {
      window.speechSynthesis.pause();
      readingState = "paused";
      readBtn.textContent = "继续";
      status.textContent = "状态：已暂停";
      return;
    }

    if (readingState === "paused") {
      window.speechSynthesis.resume();
      readingState = "speaking";
      readBtn.textContent = "朗读中…";
      status.textContent = "状态：朗读中…";
      return;
    }

    // 新建一次朗读任务前，先清理旧任务，避免多段文本重叠播放。
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(currentSelectedText);
    utter.lang = hasChinese(currentSelectedText) ? "zh-CN" : "en-US";
    utter.onstart = () => {
      readingState = "speaking";
      readBtn.textContent = "朗读中…";
      status.textContent = "状态：朗读中…";
    };
    utter.onend = () => {
      readingState = "idle";
      readBtn.textContent = "朗读";
      status.textContent = "状态：朗读结束";
    };
    utter.onerror = () => {
      readingState = "idle";
      readBtn.textContent = "朗读";
      status.textContent = "状态：朗读失败，请重试";
    };
    window.speechSynthesis.speak(utter);
  }

  // 监听文本选择动作，展示悬浮工具条。
  function onSelectionChange() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 1) {
      panel.style.display = "none";
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      panel.style.display = "none";
      return;
    }

    currentSelectedText = text;
    setDefaultLangByText(text);
    resetCard();
    // 悬浮层使用 fixed 定位，直接使用视口坐标即可。
    showPanelAt(rect.left, rect.top);
  }

  translateBtn.addEventListener("click", doTranslate);
  readBtn.addEventListener("click", toggleRead);

  // 切换目标语言后，若卡片已展开则立即重新翻译，减少用户点击次数。
  langWrap.addEventListener("change", () => {
    if (card.style.display === "block" && currentSelectedText.trim()) {
      doTranslate();
    }
  });

  document.addEventListener("mouseup", (e) => {
    // 点击插件面板内部（如翻译按钮、语言切换）时，不重算选区，
    // 否则可能因选区丢失导致面板提前隐藏，按钮点击无法生效。
    if (panel.contains(e.target)) {
      return;
    }
    // 使用微任务延迟，确保 selection 已更新。
    setTimeout(onSelectionChange, 0);
  });

  document.addEventListener("keyup", (e) => {
    // 支持键盘选择文本后的触发（如 Shift + 方向键）。
    if (e.key.includes("Arrow") || e.key === "Shift" || e.key === "Control") {
      setTimeout(onSelectionChange, 0);
    }
  });

  // 点击面板外区域时隐藏卡片，不打断已开始的朗读。
  document.addEventListener("mousedown", (e) => {
    if (!panel.contains(e.target)) {
      panel.style.display = "none";
    }
  });
})();
