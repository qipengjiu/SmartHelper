/* global SMART_HELPER_CONFIG */

// 引入配置文件，供后台脚本读取 API 地址与 Key。
importScripts("config.js");

/**
 * 判断配置是否已正确填写。
 */
function validateConfig(config) {
  if (!config || !config.kimiApiUrl) {
    return "未找到 Kimi API 地址，请检查弹窗设置或 config.js。";
  }
  if (
    !config.kimiApiKey ||
    config.kimiApiKey.includes("请在这里填写")
  ) {
    return "未配置 Kimi API Key，请先在插件弹窗设置页中填写。";
  }
  // 当前插件按 OpenAI 兼容 Chat Completions 协议调用接口。
  // 如果填成其他站点接口（如非 Chat Completions），通常会出现返回原文或无内容。
  if (!String(config.kimiApiUrl).includes("/chat/completions")) {
    return "API URL 不是 Chat Completions 接口，请在弹窗中改为 Kimi/OpenAI 兼容地址。";
  }
  return "";
}

/**
 * 从浏览器存储读取用户配置，优先级高于 config.js。
 */
function getStoredConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["smartHelperConfig"], (res) => {
      resolve(res?.smartHelperConfig || {});
    });
  });
}

/**
 * 合并有效配置：弹窗设置优先，其次是 config.js 默认配置。
 */
async function getEffectiveConfig() {
  const stored = await getStoredConfig();
  return {
    kimiApiUrl: stored.kimiApiUrl || SMART_HELPER_CONFIG.kimiApiUrl,
    kimiApiKey: stored.kimiApiKey || SMART_HELPER_CONFIG.kimiApiKey,
    kimiModel: stored.kimiModel || SMART_HELPER_CONFIG.kimiModel || "moonshot-v1-8k",
    requestTimeoutMs:
      Number(stored.requestTimeoutMs) || SMART_HELPER_CONFIG.requestTimeoutMs || 20000
  };
}

/**
 * 调用 Kimi API 完成翻译。
 * @param {string} text 原文
 * @param {"zh"|"en"} targetLang 目标语言
 */
async function requestKimiTranslation(text, targetLang) {
  const effectiveConfig = await getEffectiveConfig();
  const configError = validateConfig(effectiveConfig);
  if (configError) {
    throw new Error(configError);
  }

  const targetDesc = targetLang === "zh" ? "中文" : "英文";
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    effectiveConfig.requestTimeoutMs || 20000
  );

  try {
    // 首次请求：常规翻译提示词。
    const first = await callTranslationApi(
      effectiveConfig,
      targetDesc,
      text,
      false,
      controller.signal
    );
    if (first && normalizeText(first) !== normalizeText(text)) {
      return first;
    }

    // 二次请求：若首次为空或与原文一致，使用更强约束提示词重试一次。
    const second = await callTranslationApi(
      effectiveConfig,
      targetDesc,
      text,
      true,
      controller.signal
    );
    if (second && normalizeText(second) !== normalizeText(text)) {
      return second;
    }

    throw new Error(
      "接口返回内容与原文一致，未得到有效翻译结果。请检查 API URL/模型，确认其支持翻译。"
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callTranslationApi(config, targetDesc, text, strictMode, signal) {
  const response = await fetch(config.kimiApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.kimiApiKey}`
    },
    body: JSON.stringify({
      model: config.kimiModel || "moonshot-v1-8k",
      temperature: strictMode ? 0 : 0.2,
      messages: buildTranslationMessages(targetDesc, text, strictMode)
    }),
    signal
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(formatApiError(response.status, raw));
  }

  const data = await response.json();
  const result = extractTextFromResponse(data);
  if (!result) {
    const shape = safeJsonPreview(data);
    throw new Error(`翻译接口返回无可用文本。响应片段：${shape}`);
  }
  return result;
}

/**
 * 统一格式化接口错误，给前端更友好的中文提示。
 */
function formatApiError(status, rawText) {
  let parsedMessage = "";
  let parsedType = "";
  try {
    const data = JSON.parse(rawText || "{}");
    parsedMessage = data?.error?.message || "";
    parsedType = data?.error?.type || "";
  } catch (e) {
    // 保持空字符串，后续走通用提示。
  }

  const merged = `${parsedType} ${parsedMessage}`.toLowerCase();

  if (
    status === 429 ||
    merged.includes("insufficient balance") ||
    merged.includes("insufficient_balance") ||
    merged.includes("quota") ||
    merged.includes("exceeded_current_quota")
  ) {
    return "翻译失败：Kimi 账号余额不足或额度已用尽（429）。请充值/调整套餐后重试。";
  }

  if (status === 401 || merged.includes("invalid api key") || merged.includes("unauthorized")) {
    return "翻译失败：API Key 无效或已过期，请在弹窗设置页更新 Key。";
  }

  if (status === 403) {
    return "翻译失败：当前 Key 无权限访问该模型或接口。";
  }

  if (status >= 500) {
    return "翻译失败：服务端暂时不可用，请稍后重试。";
  }

  return `翻译请求失败（${status}）：${rawText}`;
}

function buildTranslationMessages(targetDesc, text, strictMode) {
  if (!strictMode) {
    return [
      {
        role: "system",
        content: "你是一个专业翻译助手。只输出翻译结果本身，不要解释，不要增加前后缀。"
      },
      {
        role: "user",
        content: `请将以下内容翻译成${targetDesc}：\n${text}`
      }
    ];
  }

  return [
    {
      role: "system",
      content:
        "你是翻译引擎。必须输出目标语言译文，禁止输出原文，禁止解释，禁止加引号。"
    },
    {
      role: "user",
      content: `目标语言：${targetDesc}\n待翻译文本如下（只翻译三引号内文本）：\n"""${text}"""`
    }
  ];
}

/**
 * 从不同兼容格式中提取模型文本，提升接口兼容性。
 * 兼容场景：
 * 1) OpenAI: choices[0].message.content (string)
 * 2) 部分实现: message.content 为数组 [{type:"text", text:"..."}]
 * 3) SSE 聚合结果: choices[0].delta.content
 * 4) 其他网关: output_text / reply / data.text
 */
function extractTextFromResponse(data) {
  // 标准 OpenAI/Kimi Chat Completions：choices[0].message.content
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .join("")
      .trim();
    if (joined) {
      return joined;
    }
  }

  const delta = data?.choices?.[0]?.delta?.content;
  if (typeof delta === "string" && delta.trim()) {
    return delta.trim();
  }

  // 兼容部分实现返回 output_text / reply。
  const alt = data?.output_text || data?.reply || data?.data?.text || "";
  if (typeof alt === "string" && alt.trim()) {
    return alt.trim();
  }

  return "";
}

/**
 * 安全截断 JSON，避免错误信息过长。
 */
function safeJsonPreview(value) {
  try {
    const s = JSON.stringify(value);
    return s.length > 300 ? `${s.slice(0, 300)}...` : s;
  } catch (e) {
    return "无法序列化响应内容";
  }
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// 监听内容脚本消息，统一在后台完成翻译请求，减少页面跨域问题。
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== "translate") {
    return false;
  }

  requestKimiTranslation(message.text || "", message.targetLang || "zh")
    .then((translatedText) => {
      sendResponse({ ok: true, translatedText });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error?.name === "AbortError" ? "翻译超时，请重试。" : error.message
      });
    });

  return true;
});
