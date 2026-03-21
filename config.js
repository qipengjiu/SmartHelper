/**
 * 智能文本助手插件配置文件
 * 说明：
 * 1. 请将 kimiApiKey 改为你自己的 Key
 * 2. kimiApiUrl 默认是 Kimi OpenAI 兼容接口，可按实际情况修改
 * 3. kimiModel 可按可用模型名称调整
 */
const SMART_HELPER_CONFIG = {
  kimiApiUrl: "https://api.moonshot.cn/v1/chat/completions",
  kimiApiKey: "请在这里填写你的Kimi_API_Key",
  kimiModel: "moonshot-v1-8k",
  requestTimeoutMs: 20000
};
