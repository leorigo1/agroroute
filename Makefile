.PHONY: help up down logs db-reset test-back front

COMPOSE ?= docker compose

BACKEND_SERVICE ?= backend
DB_CONTAINER ?= postgres_postgis
DB_NAME ?= agro_db
DB_USER ?= postgres

help:
	@echo "Targets:"
	@echo "  make up                # sobe backend + db (docker compose up --build)"
	@echo "  make down              # derruba tudo (docker compose down)"
	@echo "  make logs              # logs (backend + db)"
	@echo "  make db-reset          # drop tables (rotas/fields/users) no Postgres do Docker"
	@echo "  make test-back         # roda testes do backend no Docker (inclui test_models.py)"
	@echo "  make front             # roda o frontend (npm run dev)"
	@echo "  make run             	# roda frontend e backend juntos (make front & make up)"

up:
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f $(BACKEND_SERVICE) db

db-reset:
	$(COMPOSE) up -d db
	docker exec -it $(DB_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME) -c "DROP TABLE IF EXISTS rotas CASCADE;"
	docker exec -it $(DB_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME) -c "DROP TABLE IF EXISTS fields CASCADE;"
	docker exec -it $(DB_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME) -c "DROP TABLE IF EXISTS users CASCADE;"

test-back:
	$(COMPOSE) up -d db
	$(COMPOSE) run --rm $(BACKEND_SERVICE) python -m pytest -q

front:
	cd frontend && npm run dev


run:
	make front & make up
	
	