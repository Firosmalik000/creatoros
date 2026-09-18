.PHONY: setup dev dev-web dev-api lint typecheck test build migrate migrate-down seed

setup:
	npm install

dev:
	docker compose up --build

dev-web:
	npm run dev:web

dev-api:
	cd apps/api && go run ./cmd/server

lint:
	npm run lint
	cd apps/api && go vet ./...

typecheck:
	npm run typecheck

test:
	npm run test
	cd apps/api && go test ./...

build:
	npm run build
	cd apps/api && go build ./cmd/server

migrate:
	cd apps/api && go run ./cmd/migrate -dir ./migrations

migrate-down:
	cd apps/api && go run ./cmd/migrate -direction down -steps 1 -dir ./migrations

seed:
	@echo "Seed data will be introduced with the first persistence-backed module."
