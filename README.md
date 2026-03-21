# 智能文本助手 Chrome 插件

一个轻量的网页文本助手：选中文本后自动出现悬浮工具条，支持「翻译」与「朗读」。

## 功能说明
- 选中文本后出现悬浮按钮，顺序为：翻译、朗读
- 翻译结果展示在悬浮条下方
- 支持目标语言切换：中文 / 英文
- 朗读基于 Chrome 页面可用的 Web Speech API（浏览器内置能力）
- 支持弹窗设置页可视化填写 Kimi 配置（优先于 `config.js`）

## 目录结构
- `manifest.json`：插件清单（MV3）
- `content.js`：页面选中文本监听、悬浮 UI、朗读逻辑
- `content.css`：悬浮 UI 样式
- `background.js`：翻译请求转发与 Kimi API 调用
- `popup.html` / `popup.css` / `popup.js`：插件弹窗设置页
- `config.js`：Kimi API 配置文件（请填写）

## 配置 Kimi API（推荐使用弹窗）
1. 点击浏览器工具栏中的插件图标，打开设置弹窗
2. 填写并保存以下字段：
- `Kimi API URL`
- `Kimi API Key`
- `模型名称`
- `超时时间（毫秒）`

说明：弹窗保存后会写入浏览器本地存储，后台翻译请求会优先使用该配置。

## 备用方式：修改 `config.js`
如未在弹窗保存配置，插件会回退使用 `config.js` 默认值。可手动填写：

- `kimiApiUrl`：Kimi 接口地址（默认是 OpenAI 兼容地址）
- `kimiApiKey`：你的 API Key
- `kimiModel`：模型名（如 `moonshot-v1-8k`）
- `requestTimeoutMs`：请求超时时间（毫秒）

## 本地加载插件（开发模式）
1. 打开 Chrome，访问 `chrome://extensions/`
2. 打开右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择当前项目目录 `SmartHelper`
5. 在任意网页选中文本，验证悬浮工具条是否出现

## 使用说明
1. 在网页中选中关键词或段落
2. 点击「翻译」查看结果
3. 切换「中文 / 英文」可实时刷新翻译
4. 点击「朗读」开始播放，再次点击可暂停/继续

## 常见问题
- 提示未配置 Key：请检查 `config.js` 中 `kimiApiKey`
- 翻译失败：检查网络与 `kimiApiUrl` 是否可访问
- 某些网页无朗读：网页策略或浏览器环境可能限制语音能力
