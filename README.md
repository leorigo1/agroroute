# AgroRouting

O AgroRouting é uma aplicação para desenhar talhões no mapa e calcular uma rota de cobertura agrícola sobre essa área. Depois que a rota é calculada, ela aparece no mapa e também pode ser exportada em GeoJSON.

O projeto tem duas partes principais:

- `backend-fastapi/`: API em FastAPI, autenticação, banco PostGIS e algoritmo de rota.
- `frontend/`: interface em Next.js, com mapa, criação de áreas e visualização das rotas.

A forma mais simples de rodar tudo é usando o `Makefile`.

## Antes de começar

Você precisa ter instalado:

- Docker
- Docker Compose
- Node.js 20 ou superior
- npm
- make

## Rodando o projeto

Na raiz do projeto, abra um terminal e suba o backend junto com o banco:

```bash
make up
```

Esse comando sobe:

- a API FastAPI em `http://localhost:8000`;
- o PostgreSQL/PostGIS em `localhost:5432`.

Agora abra outro terminal, também na raiz do projeto, e rode o frontend:

```bash
make front
```

Depois disso, acesse:

```text
http://localhost:3000
```

A documentação automática da API fica em:

```text
http://localhost:8000/docs
```

## Primeiro uso

Com a aplicação aberta:

1. Crie uma conta em `/register`.
2. Faça login em `/login`.
3. Vá para a tela de criação de área.
4. Clique no mapa para marcar os pontos do talhão.
5. Clique novamente no primeiro ponto para fechar a área.
6. Preencha os dados da operação, como largura de trabalho, velocidade e consumo.
7. Salve a área.

Quando o salvamento terminar, o sistema volta para a tela inicial. A rota calculada aparece em azul no mapa.

Você pode abrir os detalhes clicando no talhão ou em qualquer parte azul da rota.

## Exportando a rota

Na tela de detalhes da área existe o botão `Exportar GeoJSON`.

Ele baixa um arquivo parecido com:

```text
talhao-1-rota.geojson
```

Esse arquivo pode ser aberto em ferramentas como QGIS, Leaflet e outros visualizadores que aceitam GeoJSON.

## Comandos úteis

Subir backend e banco:

```bash
make up
```

Subir frontend:

```bash
make front
```

Parar os containers:

```bash
make down
```

Ver logs do backend e banco:

```bash
make logs
```

Limpar as tabelas principais do banco local:

```bash
make db-reset
```

Rodar os testes do backend:

```bash
make test-back
```

## Rodando o frontend manualmente

Se preferir não usar `make front`, entre na pasta do frontend:

```bash
cd frontend
npm install
npm run dev
```

Para validar o frontend:

```bash
npm run lint
npm run build
```

Observação: o build usa fontes do Google via `next/font/google`. Se a máquina estiver sem internet, o build pode falhar ao tentar baixar as fontes Geist.

## Banco de dados

O banco roda em um container PostgreSQL com PostGIS.

Dados locais:

```text
Host: localhost
Porta: 5432
Banco: agro_db
Usuário: postgres
Senha: postgres
```

Para entrar no banco pelo terminal:

```bash
docker exec -it postgres_postgis psql -U postgres -d agro_db
```

## Endpoints principais

```text
GET    /
GET    /about
POST   /auth/register
POST   /auth/login
GET    /fields/
POST   /fields/
GET    /fields/{field_id}
POST   /fields/{field_id}/calculate
GET    /fields/{field_id}/route
DELETE /fields/{field_id}
```

As rotas de `/fields` precisam de autenticação:

```text
Authorization: Bearer <token>
```

## Problemas comuns

### Token inválido ou expirado

Faça login novamente. O frontend remove o token antigo quando a API responde com `401`.

### Backend não conecta no banco fora do Docker

O backend usa o host `db`, que existe dentro do Docker Compose. Se você tentar rodar a API fora do Docker, provavelmente vai precisar ajustar a conexão em `backend-fastapi/app/database/database.py`.

### Porta ocupada

Se `3000`, `8000` ou `5432` já estiverem em uso, pare o processo que está usando a porta ou altere o mapeamento no `docker-compose.yml`.
