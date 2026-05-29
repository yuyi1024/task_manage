# 任務記錄

本檔案記錄專案的開發歷程與決策脈絡。

## 2026-05-29 — 任務列表 UI 三項改善

**做了什麼**
- 狀態分組時 `done` 群組預設收合（template 在 `collapsed` / `display:none` 條件加上 `group.key == 'done'`）
- 狀態分組時各群組 header 顯示對應 Lucide icon（clock / circle / loader / help-circle / check-circle-2 / pause-circle）；JS `_createGroupElement` 同步支援動態建立群組時渲染 icon
- 所有表格欄位改為固定像素寬度（`--col-task` 從 `minmax(150px,1fr)` 改為 `280px`），並為每個 `.col-*` 加上 `min-width`/`max-width`，使不同螢幕寬度下每列寬度一致

**為什麼這樣做**
- Done 收合：完成的任務通常不需要展開，預設折疊減少視覺噪音
- 狀態 icon：增加辨識度，讓使用者不用讀文字也能快速辨認群組類型
- 固定欄寬：`1fr` 會隨視窗伸縮，導致不同機器/螢幕看到的欄寬不一致；固定寬度加 overflow-x scroll 更可預測

**影響範圍**
- `templates/tasks/task_list.html`、`static/js/main.js`、`static/css/main.css`

## 2026-05-29 — 初次部署 + 修復正式機圖片顯示

**做了什麼**
- 初次部署到正式機（`sv-test01.elandai.cloud/task_manage/`），建立目錄結構、git repo、docker compose
- `docker-compose-proxy.yml` 的 media volume 從 named volume 改為 bind mount（`./media:/app/media`），確保圖片檔案不依賴 Docker volume 管理
- `image_upload` view 回傳 URL 時剝掉 `URL_PREFIX`，DB 永遠只存 `/media/task_images/...`
- `editor.js` 加入 `_resolveMediaUrls()`，渲染內容時把 `/media/` 替換成 `window.MEDIA_URL`（含前綴）
- `settings.py` 補上 `django.template.context_processors.media`，讓 `{{ MEDIA_URL }}` 在 template 可用

**為什麼這樣做**
正式機透過外部 reverse proxy 只轉發 `/task_manage/` 前綴的請求，media 路徑必須帶前綴才能被路由。但 DB 不應寫死前綴（換環境就全壞），因此改為「DB 存乾淨路徑，前端渲染時補前綴」的架構。

**影響範圍**
`docker-compose-proxy.yml`、`tasks/views.py`、`static/js/editor.js`、`templates/base.html`、`task_manage/settings.py`

## 2026-05-29 — 隔離 session / CSRF cookie，修復多站台登入互蓋

**做了什麼**
`settings.py` 新增四個設定：`SESSION_COOKIE_NAME`、`SESSION_COOKIE_PATH`、`CSRF_COOKIE_NAME`、`CSRF_COOKIE_PATH`，均以 `URL_PREFIX` 動態推導 path。

**為什麼這樣做**
伺服器以 nginx 路徑切割多個 Django 站台（同一 domain/port），所有站台預設 cookie 名稱都叫 `sessionid`、path 都是 `/`，導致登入任一站台會覆蓋其他站台的 session cookie，造成互相登出。改為每站台專屬的 cookie name 後，瀏覽器不再混用同名 cookie。

**影響範圍**
`task_manage/settings.py`

## 2026-05-28 — 筆記總覽導覽 + 專案卡片 stats 重新設計

**做了什麼**
側邊導覽列新增「筆記總覽」入口，連結至 `/tasks/notes/`，可跨專案篩選（關鍵字、專案、作者、排序），HTMX filter 更新。卡片顯示所屬專案 icon + 名稱（`show_project=True`）。專案卡片 stats 區從文字連結改為 pill-chip 設計，含 icon，hover 顯示 accent 色。

**為什麼這樣做**
舊設計的文字連結緊貼在一起無視覺分隔；改成 chip 讓兩個操作入口各自獨立且有一致的互動反饋。筆記總覽複用 `note_cards.html` partial，加 `show_project` flag 控制是否顯示專案標籤。

**影響範圍**
`tasks/urls.py`、`tasks/views.py`、`templates/base.html`、`templates/tasks/all_notes_list.html`（新增）、`templates/tasks/project_list.html`、`templates/tasks/partials/note_card.html`、`static/css/main.css`

## 2026-05-28 — 新增專案筆記（ProjectNote）功能

**做了什麼**
新增 `ProjectNote` model，支援每個專案獨立的筆記列表。卡片列表頁 (`/projects/<pk>/notes/`) 提供關鍵字搜尋、作者篩選、排序，篩選條件持久化於 session。點擊卡片導頁至全文頁，使用 TipTap 富文字編輯器，失焦自動儲存；標題與摘要透過 contenteditable inline 編輯。支援置頂功能（星號 toggle）與刪除。專案卡片增加「N 篇筆記」連結入口。

**為什麼這樣做**
沿用現有 HTMX + TipTap 架構，零引入新套件。全文頁採整頁導覽而非側板，因 Notion 風格的長文筆記需要更大閱讀空間。session 持久化 filter 與既有 task_list 行為一致。

**影響範圍**
`tasks/models.py`、`tasks/admin.py`、`tasks/views.py`、`tasks/urls.py`、
`templates/tasks/note_list.html`、`templates/tasks/note_detail.html`、
`templates/tasks/partials/note_card.html`、`templates/tasks/partials/note_cards.html`、
`templates/tasks/project_list.html`、`static/css/main.css`、`static/js/main.js`、
`tasks/migrations/0006_projectnote.py`
