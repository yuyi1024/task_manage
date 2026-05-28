# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup: copy and fill in DB credentials
cp .env.example .env

# Install dependencies
pip install -r requirements.txt

# Apply migrations
python manage.py migrate

# Run development server
python manage.py runserver 8000

# Create superuser
python manage.py createsuperuser

# After model changes
python manage.py makemigrations
python manage.py migrate

# Validate configuration
python manage.py check

# Production: collect static files
python manage.py collectstatic
```

The app is at `http://127.0.0.1:8000/` (redirects to `/tasks/`), admin at `/admin/`. There is no test suite.

## Database

The default database is **MySQL/MariaDB**, not SQLite. All connection params (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) come from `.env` (see `.env.example`). Settings also reads `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` from `.env`.

## Architecture

**Single-app Django project**: `task_manage/` (project config) + `tasks/` (sole app).

**Model hierarchy**: `Project → Module → Task → TaskImage / TaskComment`. All models FK to `django.contrib.auth.User`. Tasks have three user roles: `assign`, `support`, `pm`, plus audit fields `created_by` / `last_modified_by`. `TaskComment` ordered by `created_at`. `TaskImage` stored at `MEDIA_ROOT/task_images/YYYY/MM/`.

**Frontend pattern**: Server-rendered HTML with **HTMX** for AJAX interactions and **Alpine.js** for UI state (sidebar toggle). No SPA framework — views return full pages or HTML partials that HTMX swaps in. Third-party JS (HTMX, Alpine.js, Lucide icons) loaded from CDN in `templates/base.html`.

**View pattern**: All views require `@login_required`. AJAX endpoints return HTML partials, except `image_upload` (JSON) and `users_api` (JSON). Task field updates POST to named endpoints rather than a REST API. `TaskForm` in `tasks/forms.py` exists but views do direct field assignment — `TaskForm` is not used in views.

**Key views** (`tasks/views.py`):
- `task_list` — main view; filters (project, module, status, priority, assign, pm) and grouping (status, priority, project, assign, pm) via query params; sort via `sort_by`; filters are **persisted in `request.session`** and restored on next visit; `?fresh=1` clears filters while preserving group_by/sort_by
- `task_create` — POST only; returns `task_row.html` partial
- `task_update` — POST only; clears module when project changes; returns 200 with `HX-Trigger: taskSaved`
- `task_update_description` — POST only; updates description; returns JSON `{status: ok}`
- `task_clone` — POST only; duplicates task with `（複製）` suffix; returns `task_row.html` partial with `X-Clone-Group-Key` header
- `task_delete` — POST only; returns 200 with `HX-Trigger: taskDeleted`
- `task_comment_create` — POST only; returns `comment_item.html` partial
- `task_detail` — returns `detail_panel.html` partial for the slide-over panel (includes comments)
- `task_row_partial` — GET; re-renders a single task row (called by JS after detail panel closes with changes)
- `module_options` — returns `module_options.html` partial; accepts `project_id` or `project` param
- `project_list` / `project_create` / `project_update` / `project_delete` — project CRUD; HTMX-aware
- `module_create` / `module_delete` — module CRUD

**JS layer** (`static/js/`):
- `main.js` — handles HTMX events (`taskSaved`, `taskDeleted`, `projectDeleted`), the detail slide-over panel (open/close/resize, row refresh on close), group move animation when a grouping field changes, task clone, filter helpers, and icon picker for projects. Templates expose JS globals `window.TASK_GROUP_BY`, `window.TASK_GROUP_LABELS`, `window.TASK_SORT_OPTIONS`, and `window.PROJECT_ICONS`.
- `editor.js` — TipTap rich-text editor (Notion-like) loaded lazily via dynamic ESM imports from `esm.sh`. Provides `initEditor()`, `destroyEditor()`, `preloadEditor()`. Used for `Task.description` in the detail panel; saves to `task_update_description`.

**Static files**: WhiteNoise serves static files in production (`CompressedManifestStaticFilesStorage`); in development it falls back to Django's default. `STATICFILES_DIRS = [BASE_DIR / 'static']`, `STATIC_ROOT = BASE_DIR / 'staticfiles'`.

**Locale**: `LANGUAGE_CODE = 'zh-hant'`, `TIME_ZONE = 'Asia/Taipei'`. UI labels are in Traditional Chinese.

**Task status values**: `pending`, `not_started`, `in_progress`, `unconfirm`, `done`, `pause`. `get_status_color()` and `get_priority_color()` on `Task` return hex colors used directly in templates.

**URL namespace**: `app_name = 'tasks'` — use `tasks:view_name` in `reverse()` / `{% url %}`.
