# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
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
```

There is no test suite configured. The app can be accessed at `http://127.0.0.1:8000/` (redirects to `/tasks/`), admin at `/admin/`.

## Architecture

**Single-app Django project**: `task_manage/` (project config) + `tasks/` (sole app).

**Model hierarchy**: `Project → Module → Task → TaskImage / TaskComment`. All models use `ForeignKey` to `django.contrib.auth.User`. Tasks have three user roles: `assign`, `support`, `pm`, plus audit fields `created_by` / `last_modified_by`. `TaskComment` stores per-task comments (ordered by `created_at`).

**Frontend pattern**: Server-rendered HTML with **HTMX** for AJAX interactions and **Alpine.js** for lightweight UI state (sidebar toggle, etc.). No SPA framework — all views return either full pages or HTML partials that HTMX swaps in.

**View pattern**: All views require `@login_required`. AJAX endpoints return HTML partials (not JSON), except `image_upload` (JSON) and `users_api` (JSON user list). Task updates use `POST` to named endpoints rather than a REST API.

**Key views** (`tasks/views.py`):
- `task_list` — main view; filtering (project, module, status, priority, assign, pm) and grouping (status, priority, project, assign, pm) via query params; sort via `sort_by` param (order, priority_desc, priority_asc, start_date, end_date, created_at)
- `task_create` — POST only; returns `task_row.html` partial
- `task_update` — POST only; handles simple fields, nullable date fields, and FK fields; clears module when project changes; returns 200 with `HX-Trigger: taskSaved`
- `task_update_description` — POST only; updates description field; returns JSON `{status: ok}`
- `task_clone` — POST only; duplicates task with `（複製）` suffix; returns `task_row.html` partial with `X-Clone-Group-Key` header
- `task_delete` — POST only; returns 200 with `HX-Trigger: taskDeleted`
- `task_comment_create` — POST only; returns `comment_item.html` partial
- `task_detail` — returns `detail_panel.html` partial for the slide-over panel (includes comments)
- `module_options` — returns `module_options.html` partial; accepts `project_id` or `project` param
- `project_list` / `project_create` / `project_update` / `project_delete` — project CRUD; HTMX-aware (returns partials on HX-Request)
- `module_create` / `module_delete` — module CRUD under project management page

**Static files**: WhiteNoise serves static files; `DEBUG=True` and `ALLOWED_HOSTS=['*']` are set for development. The `SECRET_KEY` is a placeholder — use an environment variable before any production deployment.

**Locale**: `LANGUAGE_CODE = 'zh-hant'`, `TIME_ZONE = 'Asia/Taipei'`.

**Task status values**: `pending`, `not_started`, `in_progress`, `unconfirm`, `done`, `pause`. `get_status_color()` and `get_priority_color()` on `Task` return hex colors used directly in templates.

**URL namespace**: `app_name = 'tasks'` — use `tasks:view_name` in `reverse()` / `{% url %}`.
