# Assinatura AgroRoute Premium

O checkout oferece assinatura recorrente mensal por cartão e pagamento mensal
manual por PIX. O SDK oficial MercadoPago.js tokeniza o cartão no navegador; o
FastAPI recebe somente `card_token_id` nesse fluxo. Para PIX, o FastAPI cria a
cobrança no Mercado Pago e mostra o QR Code e o código copia e cola. O Premium
só é liberado após confirmação de uma cobrança `approved` consultada no Mercado
Pago.

## Variáveis de ambiente

Configure no serviço backend (na Vercel, em **Settings → Environment Variables**;
os arquivos `.env.example` são apenas exemplos locais e não definem variáveis no
deploy):

| Nome | Finalidade |
| --- | --- |
| `MP_ACCESS_TOKEN` | Credencial privada usada pelo SDK Python. Nunca exponha ao frontend. |
| `MP_WEBHOOK_SECRET` | Segredo usado para validar HMAC das notificações. |
| `MP_PREMIUM_MONTHLY_AMOUNT` | Valor mensal em reais; padrão `8.99` (R$ 8,99/mês). |
| `FRONTEND_URL` | Origem pública do frontend, usada no retorno e na URL de notificação. Em produção: `https://agroroute.vercel.app`. |

Configure no frontend:

| Nome | Finalidade |
| --- | --- |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Public Key usada pelo MercadoPago.js para tokenizar o cartão. |

## Login com Google

O login usa Google Identity Services no navegador e envia o ID token diretamente
para `POST /api/auth/google`. O backend verifica assinatura, validade e audience
com `GOOGLE_CLIENT_ID`, aceita somente e-mails verificados e emite o mesmo JWT
utilizado pelo login por senha.

Configure o mesmo OAuth Client ID nas variáveis `GOOGLE_CLIENT_ID` do backend e
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` do frontend. Cadastre as origens do app (por
exemplo, `http://localhost:3000` e o domínio de produção) nas origens JavaScript
autorizadas do cliente OAuth no Google Cloud Console. O fluxo de ID token não
usa Client Secret no navegador nem precisa dele no backend.

Configure essas variáveis no ambiente de deploy e reinicie/recompile os serviços
após a alteração. Se um Client Secret tiver sido compartilhado ou exposto,
revogue-o e gere outro no Google Cloud Console; não o armazene no repositório.

Os arquivos `backend-fastapi/.env.example` e `frontend/.env.example` contêm
somente nomes e valores de exemplo. Não coloque Access Token nem Webhook Secret
em `NEXT_PUBLIC_*`, no Git ou na documentação.

## Desenvolvimento e credenciais de teste

1. Crie/consulte as credenciais de teste no painel de desenvolvedores do Mercado
   Pago.
2. Configure o Access Token de teste e a Public Key de teste nos ambientes
   backend e frontend, respectivamente.
3. Configure `MP_PREMIUM_MONTHLY_AMOUNT=8.99` e `FRONTEND_URL` para a origem
   que o navegador utiliza (por exemplo, `https://agroroute.vercel.app` em
   produção).
4. O backend precisa alcançar o PostgreSQL/PostGIS de desenvolvimento e o
   frontend precisa alcançar `/api`.
5. Use somente os cartões de teste e os usuários de teste documentados no
   painel oficial do Mercado Pago para o país e produto da conta. Não use dados
   reais de cartão em testes.

O navegador nunca envia número, CVV ou validade do cartão ao FastAPI. Esses
campos são controlados pelo CardForm oficial; o FastAPI recebe somente o token
temporário e o descarta após iniciar a assinatura. No PIX, o CPF é enviado ao
backend para compor a cobrança e não é armazenado pela aplicação.

## Webhook

Configure no painel do Mercado Pago a URL HTTPS pública:

```text
https://<dominio-publico>/api/subscriptions/webhook
```

O endpoint é público e não usa JWT; valida o header `x-signature` com HMAC
SHA-256 e `MP_WEBHOOK_SECRET`. A assinatura é sincronizada após consulta ao
recurso correspondente na API do Mercado Pago. Configure as notificações de:

- `subscription_preapproval`;
- `subscription_authorized_payment`;
- `payment`;
- `chargebacks`, se o produto/painel da conta oferecer esse tópico.

O evento recebido não é considerado confirmação por si só. O backend busca o
recurso na API e confere vínculo, valor e moeda. No cartão, também confirma que
a assinatura remota está autorizada. No PIX, cada pagamento aprovado concede
um mês de acesso; a renovação é manual e o acesso expira se não houver outro
pagamento aprovado. Eventos repetidos atualizam o mesmo Payment pela
constraint única do ID de pagamento.

Para verificar uma notificação, consulte os logs do backend e o painel de
notificações do Mercado Pago. Um evento sem assinatura válida é rejeitado sem
alterar o banco. Erros temporários ao consultar a API retornam erro HTTP para
que o provedor possa tentar novamente. Se a criação de assinatura responder
com `502`, consulte os logs do backend: o erro registra o status HTTP e os
códigos/mensagens de diagnóstico retornados pelo Mercado Pago, sem registrar o
token temporário do cartão.

## Ciclo de assinatura

- `POST /api/subscriptions`: cria uma assinatura e mantém o estado local
  `PENDING`; o valor e o usuário são determinados pelo backend.
- `POST /api/subscriptions/pix`: cria (ou recupera, se ainda estiver válido) um
  pagamento PIX mensal de R$ 8,99 e retorna QR Code e código copia e cola. O QR
  expira em 30 minutos; cada renovação mensal exige um novo pagamento.
- `GET /api/subscriptions/me`: consulta o estado local da conta autenticada.
  Também retorna `premium`, `free_usage_available` e `free_usage_used`; essa
  consulta não consome o uso gratuito.
- `POST /api/subscriptions/me/pause`, `/cancel` e `/reactivate`: altera a
  assinatura recorrente por cartão e só grava a transição após confirmação do
  Mercado Pago.
- `GET /api/subscriptions/premium-test`: endpoint de verificação protegido por
  JWT e estado local `ACTIVE`.

Após configurar credenciais e webhook, faça a criação de assinatura com usuário
de teste, confira `PENDING`, aguarde evento de cobrança aprovado e consulte
`GET /api/subscriptions/me`. Teste também os eventos pendentes, rejeitados,
duplicados e a rota Premium de teste. O endpoint Premium de teste não substitui
uma política de acesso de produção a recursos do produto.
No PIX, valide o QR e o copia e cola, simule uma confirmação no Mercado Pago e
confirme que o período de acesso vence um mês após a aprovação; o QR vence em
30 minutos e o usuário precisa pagar manualmente cada renovação.

## Produção

Antes de habilitar cobranças reais:

1. Troque `MP_ACCESS_TOKEN` e `NEXT_PUBLIC_MP_PUBLIC_KEY` pelas credenciais de
   produção correspondentes à mesma conta.
2. Configure o segredo de webhook de produção em `MP_WEBHOOK_SECRET`.
3. Defina `FRONTEND_URL=https://agroroute.vercel.app` (ou o domínio HTTPS
   configurado para o frontend) no ambiente do backend.
4. Configure a URL HTTPS do webhook no painel de produção e valide a entrega
   com uma cobrança de baixo risco autorizada.
5. Restrinja a Public Key no painel, quando essa opção estiver disponível.
6. Faça deploy das variáveis no ambiente correto e nunca copie credenciais de
   teste para produção.

## Observações operacionais

O projeto cria tabelas com `Base.metadata.create_all` no startup. Esse mecanismo
cria as novas tabelas, mas não é um sistema de migração de alterações em tabelas
existentes. As novas tabelas não exigem alteração de `users`, `fields`, `rotas`
ou PostGIS.

## Uso gratuito do cálculo de rotas

Cada usuário pode calcular uma rota uma vez sem assinatura. O benefício só é
reservado ao executar `POST /api/fields/{field_id}/calculate`, depois de
autenticar e validar a propriedade do talhão. A reserva e a gravação da rota
ocorrem na mesma transação; falhas no cálculo ou na persistência desfazem a
reserva. Uma restrição única por usuário no PostgreSQL impede que requisições
concorrentes obtenham dois usos. Assinantes Premium ativos continuam sem limite,
e cancelar ou pausar uma assinatura não restaura um uso já consumido.

O estado é persistido na tabela `premium_trial_usage` e exposto pela consulta
`GET /api/subscriptions/me`. A interface apenas apresenta esse estado; somente
o backend decide se autoriza o cálculo.

Use um banco de teste isolado para pytest. Não execute
`app/tests/test_models.py` contra produção: esse teste contém `DROP TABLE`.
