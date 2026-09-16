.PHONY: setup dev dev-web dev-api lint typecheck test build migrate seed

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
	@echo "Run versioned migrations with the deployment migration runner."

seed:
	@echo "Seed data will be introduced with the first persistence-backed module."
