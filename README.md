## AgroRouting

Monorepo com:
- `backend-fastapi/`: API (FastAPI) + Postgres/PostGIS
- `frontend/`: app web (Next.js)

## Ferramentas / Pré-requisitos

- Docker + Docker Compose (recomendado para rodar back + db)
- Node.js + npm (para rodar o front localmente)
- Python 3 (se for rodar o backend fora do Docker)
- DB manager opcional: DBeaver

## Rodar com Docker (recomendado)

Na raiz do repo:
- `docker-compose up --build`

Serviços:
- API: `http://localhost:8000` (Swagger em `http://localhost:8000/docs`)
- Postgres/PostGIS: `localhost:5432` (`agro_db`, user `postgres`, pass `postgres`)

## Backend (FastAPI)

Pasta: `backend-fastapi/`

### Stack
- FastAPI + Uvicorn
- SQLAlchemy
- Postgres + PostGIS (`postgis/postgis`)
- GeoAlchemy2 (tipos `Geometry`)

### Variáveis de ambiente

- `DATABASE_URL` (no `docker-compose.yml`: `postgresql://postgres:postgres@db:5432/agro_db`)
- `SECRET_KEY` (default: `supersecretkey123`)

### Endpoints principais

- `GET /` (health)
- `GET /about`
- `POST /auth/register`
- `POST /auth/login`
- `POST /fields/` (auth) cria talhão
- `GET /fields/` (auth) lista talhões
- `GET /fields/{field_id}` (auth) detalhe
- `POST /fields/{field_id}/calculate` (auth) gera/salva rota
- `GET /fields/{field_id}/route` (auth) busca rota salva

### Algoritmo de cobertura

Implementação em `backend-fastapi/app/services/algorithm.py`:
- reprojeção EPSG:4326 ↔ EPSG:32722 (metros)
- geração de faixas paralelas (Boustrophedon)
- ordenação (Nearest Neighbor + 2-opt)
- métricas (distância, tempo, combustível)

## Frontend (Next.js)

Pasta: `frontend/`

### Rodar em desenvolvimento

- `cd frontend`
- `npm install`
- `npm run dev`
- abrir `http://localhost:3000`

### Configurar URL do backend

Por padrão usa `http://localhost:8000`.

Para sobrescrever:
- `NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev`

### Fluxo principal

- `/login`: salva token em `localStorage` (`agroroute_token`)
- `/register`: cria conta via `POST /auth/register`
- `/new/area`: seleção de área e persistência via `POST /fields/`

## Testes (backend)

Pasta: `backend-fastapi/`

Reset do banco antes de rodar `test_models.py` (exemplo):
- `docker exec -it postgres_postgis psql -U postgres -d agro_db -c \"DROP TABLE IF EXISTS rotas CASCADE;\"`

Obs: por padrão os testes de model usam `localhost:5432` (Postgres do Docker exposto na máquina).

### Makefile (recomendado)

Na raiz do repo:
- `make up` (sobe backend + db)
- `make db-reset` (drop tables antes dos testes)
- `make test-back` (roda testes do backend no Docker, incluindo `app/tests/test_models.py`)
- `make down` (derruba os containers)
- `make logs` (acompanha logs)
- `make front` (roda o frontend local)

Obs: `backend-fastapi/app/tests/test_models.py` usa `DATABASE_URL` via env; quando roda no Docker ele usa o `DATABASE_URL` do `docker-compose.yml` (host `db`), e quando roda no host cai no default `localhost:5432`.
