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

**Model hierarchy**: `Project → Module → Task → TaskImage`. All models use `ForeignKey` to `django.contrib.auth.User` for assignment (tasks have three user roles: `assign`, `support`, `pm`) and audit trail (`created_by`, `last_modified_by`).

**Frontend pattern**: Server-rendered HTML with **HTMX** for AJAX interactions and **Alpine.js** for lightweight UI state (sidebar toggle, etc.). No SPA framework — all views return either full pages or HTML partials that HTMX swaps in.

**View pattern**: All views require `@login_required`. AJAX endpoints return HTML partials (not JSON), except `image_upload` (returns JSON) and `users_api` (returns JSON user list). Task updates use `POST` to named endpoints rather than a REST API.

**Key views** (`tasks/views.py`):
- `task_list` — main view; handles filtering (project, module, status, priority, assignee, pm) and grouping (status, priority, project, assignee, pm) via query params
- `task_detail` — returns `detail_panel.html` partial for the slide-over panel
- `module_options` — returns `module_options.html` partial for dynamic module dropdown when project changes

**Static files**: WhiteNoise serves static files; `DEBUG=True` and `ALLOWED_HOSTS=['*']` are set for development. The `SECRET_KEY` is a placeholder — use an environment variable before any production deployment.

**Locale**: `LANGUAGE_CODE = 'zh-hant'`, `TIME_ZONE = 'Asia/Taipei'`.

**Task status values**: `pending`, `not_started`, `in_progress`, `unconfirm`, `done`, `pause`. `get_status_color()` and `get_priority_color()` on `Task` return hex colors used directly in templates.
