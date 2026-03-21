/* global SMART_HELPER_CONFIG */

const STORAGE_KEY = "smartHelperConfig";

const apiUrlEl = document.getElementById("apiUrl");
const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const timeoutEl = document.getElementById("timeout");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");

function setStatus(text, isError) {
  statusEl.textContent = `状态：${text}`;
  statusEl.style.color = isError ? "#b91c1c" : "#4b5563";
}

function getDefaultConfig() {
  const cfg = typeof SMART_HELPER_CONFIG !== "undefined" ? SMART_HELPER_CONFIG : {};
  return {
    kimiApiUrl: cfg.kimiApiUrl || "",
    kimiApiKey: cfg.kimiApiKey || "",
    kimiModel: cfg.kimiModel || "moonshot-v1-8k",
    requestTimeoutMs: cfg.requestTimeoutMs || 20000
  };
}

function fillForm(config) {
  apiUrlEl.value = config.kimiApiUrl || "";
  apiKeyEl.value = config.kimiApiKey || "";
  modelEl.value = config.kimiModel || "";
  timeoutEl.value = Number(config.requestTimeoutMs || 20000);
}

function loadConfigToForm() {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    const defaults = getDefaultConfig();
    const stored = res?.[STORAGE_KEY] || {};
    fillForm({
      kimiApiUrl: stored.kimiApiUrl || defaults.kimiApiUrl,
      kimiApiKey: stored.kimiApiKey || defaults.kimiApiKey,
      kimiModel: stored.kimiModel || defaults.kimiModel,
      requestTimeoutMs: Number(stored.requestTimeoutMs || defaults.requestTimeoutMs || 20000)
    });
    setStatus("已加载配置", false);
  });
}

saveBtn.addEventListener("click", () => {
  const payload = {
    kimiApiUrl: apiUrlEl.value.trim(),
    kimiApiKey: apiKeyEl.value.trim(),
    kimiModel: modelEl.value.trim() || "moonshot-v1-8k",
    requestTimeoutMs: Math.max(1000, Number(timeoutEl.value || 20000))
  };

  if (!payload.kimiApiUrl) {
    setStatus("API URL 不能为空", true);
    return;
  }
  if (!payload.kimiApiKey) {
    setStatus("API Key 不能为空", true);
    return;
  }

  chrome.storage.local.set({ [STORAGE_KEY]: payload }, () => {
    if (chrome.runtime.lastError) {
      setStatus(`保存失败：${chrome.runtime.lastError.message}`, true);
      return;
    }
    setStatus("保存成功", false);
  });
});

resetBtn.addEventListener("click", () => {
  chrome.storage.local.remove([STORAGE_KEY], () => {
    if (chrome.runtime.lastError) {
      setStatus(`恢复默认失败：${chrome.runtime.lastError.message}`, true);
      return;
    }
    fillForm(getDefaultConfig());
    setStatus("已恢复默认（来源 config.js）", false);
  });
});

// 直接初始化：config.js 在 popup.html 中先于当前脚本加载。
loadConfigToForm();
