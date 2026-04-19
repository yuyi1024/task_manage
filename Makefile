.PHONY: up down build logs shell migrate restart update

# 啟動（背景執行）
up:
	docker compose up -d

# 停止
down:
	docker compose down

# 重新 build 並啟動
build:
	docker compose up -d --build

# 查看 log（即時）
logs:
	docker compose logs -f web

# 進入 Django 容器的 shell
shell:
	docker compose exec web bash

# 手動執行 migration（entrypoint 已自動執行，僅供除錯）
migrate:
	docker compose exec web python manage.py migrate

# 重啟 web 服務
restart:
	docker compose restart web

# 更版流程：pull 最新 image → 重建 → 重啟
update:
	git pull
	docker compose up -d --build
	docker compose logs -f web
