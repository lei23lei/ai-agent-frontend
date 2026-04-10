目標：從零建立 Next.js 前端專案。

技術棧：

- Next.js 15（App Router）
- TailwindCSS
- shadcn/ui（UI 元件庫）
- Axios（HTTP）
- SSE 接收串流回應

設計規格：

- 網站名稱：Open Crab
- Primary Color：#1C3568
- 支援 RWD（手機/平板/桌面）
- 支援 Dark Mode

版面結構：

- 左側 Sidebar + 右側主內容區
- Sidebar 包含：
  - Open Crab Logo / 名稱
  - New Chat 按鈕（導回首頁，不建立空 session）
  - Chat session 列表（依 updated_at 降序排列，支援重新命名/刪除）
  - 底部：跳轉到「檔案管理頁」和「設定頁」的連結

頁面清單：

- / 首頁：只有一個輸入框，送出後建立 session 並導航到 /chat/[id]
- /chat/[id]：對話頁，SSE 串流顯示，來源引用顯示在回應末尾
- /files：檔案管理，批次上傳最多 10 個檔案，顯示進度，可刪除，有 Clear All
- /settings：設定 system prompt 和 OpenAI API key

API 對接：

- Backend 在 http://localhost:8000
- 所有 endpoint 以 /api 開頭（除了 /health）
- 對話使用 SSE：POST /api/chat/{session_id}/stream

請將實作拆分成多個 Phase，每個 Phase 完成後暫停等我確認再繼續。
第一個 Phase 只需要：專案初始化、shadcn/ui 設定、Sidebar layout、Dark Mode、首頁。

實作 Artifact Panel（PDF 預覽面板）

━━━ 版面結構 ━━━

- 平常：Sidebar(260px) + Chat(全寬)
- 有 Artifact 時：Sidebar(260px) + Chat(1fr) + Artifact Panel(480px)
- 手機版（< lg）：Panel 全屏覆蓋 Chat，頂部有返回按鈕
- Panel 緊貼瀏覽器右側邊緣，無 margin / padding / rounded corner
- Panel 與 Chat 之間只有一條 border-left 分隔線

━━━ 觸發時機 ━━━

- SSE metadata 收到 {"type":"artifact","path":"result/xxx.pdf","filename":"report.pdf"} 時自動打開
- Chat 訊息中的 "📄 View Report" 按鈕點擊時重新打開對應版本

━━━ Panel UI ━━━
頂部工具列（自製，高度 48px，bg-background，底部 border-bottom）：

- 左側：📄 檔案名稱（過長時 truncate）
- 右側：版本切換（< v1 v2 v3 >）、Download 按鈕、Close(X) 按鈕

PDF 渲染（移除 iframe，改用 react-pdf）：

- 安裝：npm install react-pdf
- 使用 <Document> + <Page> 渲染所有頁面
- 白色背景，每頁 shadow-md，頁間距 8px，支援垂直捲動
- 頁面寬度用 ref 取得容器寬度後傳入 width prop 自動填滿
- Loading：skeleton 佔位元件
- Error：顯示「無法載入預覽，請直接下載」

━━━ 版本管理 ━━━

- AI 每次重新生成產生新版本（v1, v2, v3...）
- Panel 預設顯示最新版本
- 每則 Assistant 訊息對應各自的版本，點擊 "View Report" 顯示該版本

━━━ 狀態管理 ━━━

- useState 管理 artifacts: Array<{path, filename, version}>
- useState 管理 currentArtifact 與 isPanelOpen
- 僅存在 chat 頁面 state，不需要持久化

━━━ 最終視覺目標 ━━━
類似 Claude.ai Artifact Panel：
白色乾淨背景、自製工具列、PDF 呈現如真實文件，無任何瀏覽器原生 UI。

完成後暫停，我會確認視覺效果。

後端：
需求：實作 Artifact Panel 的「點擊預覽」功能，
需要在聊天記錄中永久儲存 AI 生成的文件連結，
讓使用者重新開啟舊對話時，仍能點擊 "View Report" 預覽該版本的 PDF。

需要修改 messages 資料表，新增以下欄位：

- artifact_path: TEXT | NULL → 相對路徑，例如 result/report_20260410_073551.pdf
- artifact_filename: TEXT | NULL → 顯示用的檔案名稱
- artifact_version: INT | NULL → 版本號（1, 2, 3...）

規則：

- 只有 role = 'assistant' 的訊息才會有 artifact 欄位
- role = 'user' 的訊息這三個欄位永遠為 NULL
- 前端下載 URL 拼接方式：http://localhost:8000/api/files/result/{artifact_path}
