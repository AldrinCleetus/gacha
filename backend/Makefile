.PHONY: up down logs migrate test psql reset-db build lint typecheck

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose run --rm migrate

test:
	pnpm test

psql:
	docker compose exec postgres psql -U postgres -d gacha

reset-db:
	docker compose down -v
	docker compose up -d postgres
	docker compose run --rm migrate

build:
	pnpm build

lint:
	pnpm lint

typecheck:
	pnpm typecheck
