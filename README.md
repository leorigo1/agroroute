# AgroRouting

AgroRouting é um monorepo para criação de talhões agrícolas, cálculo de rotas de cobertura e visualização das passadas em mapa. O projeto combina uma API FastAPI com banco PostgreSQL/PostGIS e uma aplicação web Next.js com Leaflet.

## Sumário

- [Visão geral](#visão-geral)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Como rodar rapidamente](#como-rodar-rapidamente)
- [Comandos do Makefile](#comandos-do-makefile)
- [Backend FastAPI](#backend-fastapi)
- [Frontend Next.js](#frontend-nextjs)
- [Banco de dados](#banco-de-dados)
- [Fluxo de uso](#fluxo-de-uso)
- [Endpoints principais](#endpoints-principais)
- [Exportação de rota](#exportação-de-rota)
- [Testes](#testes)
- [Troubleshooting](#troubleshooting)

## Visão geral

O sistema permite:

- cadastrar usuários e autenticar com JWT;
- desenhar uma nova área/talhão no mapa;
- salvar o talhão no banco com geometria PostGIS;
- calcular a rota de cobertura com base em largura de trabalho, velocidade e consumo;
- visualizar as passadas no mapa;
- clicar no talhão ou em qualquer trecho azul da rota para abrir os detalhes;
- exportar a rota calculada em GeoJSON.

## Estrutura do projeto

```text
.
├── backend-fastapi/          # API FastAPI, modelos, schemas, algoritmo e testes
├── frontend/                 # Aplicação web Next.js
├── uri-docs/                 # Documentos de referência do projeto
├── docker-compose.yml        # Sobe backend + PostGIS
├── Makefile                  # Atalhos para comandos comuns
└── README.md                 # Documentação principal
```

Arquivos importantes:

```text
backend-fastapi/app/main.py                    # inicialização da API, CORS, rotas e criação de tabelas
backend-fastapi/app/api/auth_routes.py         # registro e login
backend-fastapi/app/api/field_routes.py        # CRUD de talhões e rotas calculadas
backend-fastapi/app/services/algorithm.py      # algoritmo de cobertura
backend-fastapi/app/models/field_model.py      # model SQLAlchemy do talhão
backend-fastapi/app/models/routes_model.py     # model SQLAlchemy da rota
frontend/app/(dashboard)/new/area/page.tsx     # tela de criação de nova área
frontend/app/(dashboard)/area/[id]/page.tsx    # tela de detalhes e exportação GeoJSON
frontend/features/map/HomeFieldsMap.tsx        # mapa inicial com talhões e rotas clicáveis
frontend/features/fields/fieldService.ts       # chamadas HTTP do frontend para a API
```

## Pré-requisitos

Recomendado:

- Docker
- Docker Compose
- Node.js 20 ou superior
- npm

Para rodar backend fora do Docker:

- Python compatível com as dependências do projeto
- PostgreSQL com extensão PostGIS
- ambiente virtual Python, recomendado

Observação importante: atualmente `backend-fastapi/app/database/database.py` usa a URL fixa `postgresql://postgres:postgres@db:5432/agro_db`. Esse host `db` funciona dentro do Docker Compose. Para rodar o backend diretamente no host, será necessário ajustar a conexão do banco ou usar uma configuração equivalente.

## Como rodar rapidamente

Na raiz do projeto, suba backend e banco:

```bash
docker compose up --build
```

Em outro terminal, rode o frontend:

```bash
cd frontend
npm install
npm run dev
```

Acesse:

```text
Frontend: http://localhost:3000
API:      http://localhost:8000
Swagger:  http://localhost:8000/docs
Postgres: localhost:5432
```

Também é possível usar os atalhos:

```bash
make up
make front
```

## Comandos do Makefile

Todos os comandos abaixo devem ser executados na raiz do projeto.

```bash
make help
```

Mostra a lista de comandos disponíveis.

```bash
make up
```

Executa:

```bash
docker compose up --build
```

Sobe o banco PostGIS e o backend FastAPI. A API fica disponível em `http://localhost:8000`.

```bash
make down
```

Executa:

```bash
docker compose down
```

Para e remove os containers criados pelo Compose. O volume do banco não é removido.

```bash
make logs
```

Executa:

```bash
docker compose logs -f backend db
```

Acompanha os logs do backend e do banco em tempo real.

```bash
make db-reset
```

Sobe o banco e remove as tabelas principais:

```bash
docker compose up -d db
docker exec -it postgres_postgis psql -U postgres -d agro_db -c "DROP TABLE IF EXISTS rotas CASCADE;"
docker exec -it postgres_postgis psql -U postgres -d agro_db -c "DROP TABLE IF EXISTS fields CASCADE;"
docker exec -it postgres_postgis psql -U postgres -d agro_db -c "DROP TABLE IF EXISTS users CASCADE;"
```

Use quando precisar limpar o banco local de desenvolvimento.

```bash
make test-back
```

Sobe o banco e roda os testes do backend dentro do container:

```bash
docker compose up -d db
docker compose run --rm backend python -m pytest -q
```

```bash
make front
```

Executa:

```bash
cd frontend && npm install && npm run dev
```

Instala dependências do frontend e inicia o servidor Next.js.

```bash
make run
```

Executa frontend e Compose em paralelo:

```bash
make front & make up
```

Útil para desenvolvimento rápido, mas para depuração é mais claro rodar `make up` e `make front` em terminais separados.

## Backend FastAPI

Pasta:

```bash
cd backend-fastapi
```

Stack principal:

- FastAPI
- Uvicorn
- SQLAlchemy
- PostgreSQL
- PostGIS
- GeoAlchemy2
- Shapely
- PyProj
- NumPy
- python-jose para JWT
- Passlib/bcrypt para senha
- Pytest

### Rodar via Docker Compose

Na raiz:

```bash
docker compose up --build
```

O serviço `backend` expõe a porta `8000`.

### Rodar backend manualmente

Instale dependências:

```bash
cd backend-fastapi
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Rode a API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Atenção: para esse modo funcionar fora do Docker, a conexão do banco precisa apontar para um host acessível a partir da máquina local. Hoje o código usa `db`, que é o nome do serviço dentro do Compose.

### Inicialização da API

Ao iniciar, `app/main.py`:

- aguarda a conexão com o banco;
- ativa a extensão PostGIS com `CREATE EXTENSION IF NOT EXISTS postgis`;
- cria as tabelas com `Base.metadata.create_all(bind=engine)`;
- registra as rotas de autenticação, usuários, talhões e rotas.

### Variáveis e configurações

`SECRET_KEY`:

```bash
SECRET_KEY=sua-chave-secreta
```

Usada para assinar os tokens JWT. Se não for definida, o backend usa `supersecretkey123`.

`DATABASE_URL`:

O `docker-compose.yml` define:

```text
postgresql://postgres:postgres@db:5432/agro_db
```

Mas o arquivo `backend-fastapi/app/database/database.py` atualmente usa esse valor diretamente no código. Se quiser alternar ambientes por variável, ajuste esse arquivo para ler `os.getenv("DATABASE_URL", ...)`.

## Frontend Next.js

Pasta:

```bash
cd frontend
```

Stack principal:

- Next.js
- React
- TypeScript
- Leaflet
- React Leaflet
- Turf
- Tailwind CSS
- ESLint

### Instalar dependências

```bash
npm install
```

### Rodar em desenvolvimento

```bash
npm run dev
```

URL padrão:

```text
http://localhost:3000
```

### Build de produção

```bash
npm run build
```

O build usa `next/font/google` para carregar as fontes Geist e Geist Mono. Se o ambiente estiver sem acesso à internet, o build pode falhar ao buscar fontes em `fonts.googleapis.com`.

### Rodar build produzido

Depois de executar `npm run build`:

```bash
npm run start
```

### Lint

```bash
npm run lint
```

### Formatador

```bash
npm run format
```

Executa:

```bash
prettier --write .
```

### URL do backend no frontend

Por padrão, o frontend usa:

```text
http://localhost:8000
```

Para sobrescrever:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Ou, para build:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run build
```

## Banco de dados

Serviço no Docker Compose:

```text
db
```

Imagem:

```text
postgis/postgis:15-3.4
```

Credenciais locais:

```text
Host no host: localhost
Host no Compose: db
Porta: 5432
Banco: agro_db
Usuário: postgres
Senha: postgres
```

Volume:

```text
postgres_data
```

O volume preserva os dados entre reinicializações. Para parar containers sem apagar dados:

```bash
docker compose down
```

Para apagar também o volume:

```bash
docker compose down -v
```

Use `docker compose down -v` com cuidado, porque remove os dados locais do banco.

### Acessar o banco via terminal

Com o container rodando:

```bash
docker exec -it postgres_postgis psql -U postgres -d agro_db
```

Rodar um comando SQL direto:

```bash
docker exec -it postgres_postgis psql -U postgres -d agro_db -c "SELECT PostGIS_Version();"
```

Listar tabelas:

```bash
docker exec -it postgres_postgis psql -U postgres -d agro_db -c "\dt"
```

## Fluxo de uso

1. Acesse `http://localhost:3000/register` e crie uma conta.
2. Entre em `http://localhost:3000/login`.
3. O frontend salva o token JWT no `localStorage` com a chave `agroroute_token`.
4. Na tela inicial, clique em criar nova área.
5. Marque os pontos no mapa.
6. Clique no primeiro ponto para fechar a área.
7. Preencha nome, largura, velocidade e consumo.
8. Salve a seleção.
9. O frontend cria o talhão e chama o cálculo da rota.
10. Ao concluir, a tela volta para a página inicial.
11. Clique no talhão ou em qualquer trecho azul da rota para abrir os detalhes.
12. Na página de detalhes, exporte a rota em GeoJSON se necessário.

Se o token expirar, as chamadas protegidas retornam `401`. O frontend remove o token salvo e redireciona para login.

## Endpoints principais

Base local:

```text
http://localhost:8000
```

### Health / informações

```http
GET /
GET /about
```

### Autenticação

```http
POST /auth/register
```

Body:

```json
{
  "email": "usuario@email.com",
  "password": "senha"
}
```

```http
POST /auth/login
```

Body:

```json
{
  "email": "usuario@email.com",
  "password": "senha"
}
```

Resposta:

```json
{
  "access_token": "jwt",
  "token_type": "bearer"
}
```

### Talhões

As rotas abaixo exigem header:

```http
Authorization: Bearer <token>
```

Criar talhão:

```http
POST /fields/
```

Body:

```json
{
  "name": "Talhao 1",
  "coordinates": [
    [-52.58, -27.62],
    [-52.575, -27.62],
    [-52.575, -27.625],
    [-52.58, -27.625]
  ],
  "working_width": 6,
  "speed_kmh": 8,
  "fuel_per_km": 2.5
}
```

Listar talhões:

```http
GET /fields/
```

Buscar detalhe do talhão:

```http
GET /fields/{field_id}
```

Calcular e salvar rota:

```http
POST /fields/{field_id}/calculate
```

Buscar rota salva:

```http
GET /fields/{field_id}/route
```

Deletar talhão:

```http
DELETE /fields/{field_id}
```

## Exportação de rota

Na tela de detalhes da área, o botão `Exportar GeoJSON` baixa um arquivo com extensão:

```text
.geojson
```

Exemplo:

```text
talhao-1-rota.geojson
```

Formato do arquivo:

- `FeatureCollection`;
- cada passada/faixa da rota vira uma `Feature`;
- cada geometria é uma `LineString`;
- as coordenadas ficam no padrão GeoJSON `[longitude, latitude]`;
- as métricas da rota ficam em `properties`.

Exemplo simplificado:

```json
{
  "type": "FeatureCollection",
  "name": "Talhao 1 - rota calculada",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "field_id": 1,
        "field_name": "Talhao 1",
        "swath_index": 1,
        "total_distance_m": 850,
        "estimated_time_min": 6.4,
        "estimated_fuel_liters": 2.1
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-52.58, -27.62],
          [-52.575, -27.62]
        ]
      }
    }
  ]
}
```

O arquivo pode ser aberto em ferramentas como QGIS, Leaflet e outros visualizadores GIS compatíveis com GeoJSON.

## Testes

### Backend

Rodar todos os testes do backend pelo Compose:

```bash
make test-back
```

Comando equivalente:

```bash
docker compose up -d db
docker compose run --rm backend python -m pytest -q
```

Rodar testes manualmente dentro de `backend-fastapi`:

```bash
cd backend-fastapi
python -m pytest -q
```

Rodar um arquivo específico:

```bash
python -m pytest app/tests/test_algorithm.py -q
```

Rodar uma classe ou teste específico:

```bash
python -m pytest app/tests/test_algorithm.py::TestPlanCoverageRoute -q
```

Observações:

- `test_algorithm.py` testa o algoritmo sem depender diretamente do banco.
- `test_models.py` usa PostgreSQL/PostGIS e por padrão procura `postgresql://postgres:postgres@localhost:5432/agro_db` quando executado no host.
- Pelo Docker Compose, os testes usam o banco do serviço `db`.

### Frontend

O projeto atualmente não tem suíte de testes unitários configurada no frontend. As validações disponíveis são:

```bash
cd frontend
npm run lint
npm run build
```

## Troubleshooting

### `Token inválido ou expirado`

O backend retornou `401` porque o JWT salvo no navegador expirou ou não é mais válido.

Solução:

1. Volte para `/login`.
2. Faça login novamente.
3. Se necessário, limpe a chave `agroroute_token` do `localStorage`.

O frontend já remove o token automaticamente quando recebe `401` nas chamadas de talhão/rota.

### Build do frontend falha tentando baixar Geist

Sintoma:

```text
Failed to fetch `Geist` from Google Fonts.
Failed to fetch `Geist Mono` from Google Fonts.
```

Causa:

O projeto usa `next/font/google` em `frontend/app/layout.tsx`. Durante o build, o Next tenta buscar as fontes no Google Fonts.

Soluções:

- rodar o build com internet disponível;
- ou trocar para fonte local/self-hosted;
- ou remover `next/font/google` e usar uma pilha de fontes do sistema.

### Backend não conecta no banco fora do Docker

Sintoma comum:

```text
could not translate host name "db"
```

Causa:

O host `db` existe dentro da rede do Docker Compose, mas não existe no host local.

Soluções:

- rodar o backend com `docker compose up --build`;
- ou ajustar `backend-fastapi/app/database/database.py` para usar `localhost`;
- ou parametrizar a conexão com `DATABASE_URL`.

### Porta 5432 já está em uso

Se houver outro PostgreSQL rodando localmente, o Compose pode falhar ao expor `5432`.

Soluções:

- parar o PostgreSQL local;
- ou alterar o mapeamento de porta em `docker-compose.yml`, por exemplo `5433:5432`.

### Porta 8000 já está em uso

Outro processo está ocupando a porta da API.

Soluções:

- parar o processo que usa a porta;
- ou alterar o mapeamento do serviço `backend` em `docker-compose.yml`.

### Limpar banco local de desenvolvimento

Para apagar tabelas principais mantendo o volume:

```bash
make db-reset
```

Para remover containers e volume:

```bash
docker compose down -v
```

## Comandos rápidos

Raiz do projeto:

```bash
docker compose up --build
docker compose down
docker compose logs -f backend db
make help
make up
make down
make logs
make db-reset
make test-back
make front
make run
```

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run build
npm run start
npm run lint
npm run format
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Backend:

```bash
cd backend-fastapi
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
python -m pytest -q
python -m pytest app/tests/test_algorithm.py -q
```

Banco:

```bash
docker exec -it postgres_postgis psql -U postgres -d agro_db
docker exec -it postgres_postgis psql -U postgres -d agro_db -c "SELECT PostGIS_Version();"
docker exec -it postgres_postgis psql -U postgres -d agro_db -c "\dt"
docker compose down -v
```
