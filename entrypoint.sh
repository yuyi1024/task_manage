#!/bin/bash
set -e

echo "[entrypoint] Waiting for MariaDB at ${DB_HOST}:${DB_PORT:-3306}..."
until python - <<'EOF'
import socket, os, sys
try:
    s = socket.create_connection(
        (os.environ['DB_HOST'], int(os.environ.get('DB_PORT', 3306))),
        timeout=2
    )
    s.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
EOF
do
  echo "[entrypoint] DB not ready, retrying in 2s..."
  sleep 2
done
echo "[entrypoint] DB is ready."

echo "[entrypoint] Running migrations..."
python manage.py migrate --noinput

echo "[entrypoint] Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "[entrypoint] Starting Gunicorn..."
exec gunicorn task_manage.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS:-2}" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
