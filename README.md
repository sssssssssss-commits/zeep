# Rail Sync — Amazfit Active 2 高铁行程 MVP

手机网页导入 12306 订单截图 → OCR/人工校对 → 配对码 → Zepp Side Service 拉数 → BLE 同步到手表 → `localStorage` 离线查看。

**不**开发独立 Android APK；**不**收集 12306 账号/密码/Cookie；原图识别后立即删除。

## 目录

| 路径 | 作用 |
|------|------|
| `server/` | FastAPI + SQLite；OCR、配对、行程同步；托管手机网页 |
| `web/` | 手机导入页（打开 12306、选图、校对、配对码） |
| `watch-app/` | Zepp OS 小程序（Device + Settings + Side Service） |

## 1. 启动同步服务

```bash
cd server
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
# 可选 OCR：pip install paddlepaddle paddleocr
# PowerShell: $env:OCR_ENGINE="paddle"
uvicorn app.main:app --host 0.0.0.0 --port 8787
```

手机浏览器打开 `http://<电脑局域网IP>:8787/`。

自检：

```bash
cd server
python tests/test_parse.py
```

## 2. 手机导入

1. 打开网页 → 记下 **配对码**。
2. 「打开 12306」登录看订单后截图，或直接「从相册选择」。
3. 校对字段 → 确认保存。可重复导入多趟。

## 3. 手表小程序

```bash
cd watch-app
npm install
# 用 Zeus CLI / Zepp 开发者工具打开本目录并安装到 Active 2
# 请在 app.json 换成你自己的 appId
```

在 Zepp App 小程序设置中：

1. **配对码**：填网页上的 6 位码。
2. **同步服务地址**：填 `http://<电脑局域网IP>:8787`（不要用 `127.0.0.1`，Side Service 走手机网络）。
3. 手表打开「高铁行程」点 **刷新**。

断蓝牙 / 退 Zepp / 重启手表后应仍能看到上次成功同步的行程。卸载小程序会清本地缓存。

## 4. 实机验收清单

见 [ACCEPTANCE.md](ACCEPTANCE.md)。

## 参考实现

未发现功能完全相同且成熟的 Zepp OS 高铁订单应用。本项目沿用这些官方模式：

- [Zepp OS TodoList](https://github.com/zepp-health/zeppos-samples/tree/main/application/4.0/todo-list)：Device App、Settings App、Side Service 通信结构。
- [Zepp OS FetchAPI](https://github.com/zepp-health/zeppos-samples/tree/main/application/4.0/fetch-api)：Side Service 网络请求。
- [ZML](https://github.com/zepp-health/zml)：Device App 与 Side Service 的 BLE 消息封装。
- [LocalStorage 文档](https://docs.zepp.com/docs/reference/device-app-api/newAPI/storage/localStorage/)：手表离线缓存。
- [Awesome Zepp OS](https://github.com/zepp-health/awesome-zeppos)：社区项目索引。

## 合规边界

- 仅用户自有截图 + 人工确认。
- 后端不存截图、不存 12306 凭证。
- 同步失败保留手表旧缓存，不空刷。
- 当前服务面向可信局域网 MVP。暴露到公网前应配置 HTTPS、反向代理限流和访问控制。
