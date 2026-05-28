# 任務記錄

本檔案記錄專案的開發歷程與決策脈絡。

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
