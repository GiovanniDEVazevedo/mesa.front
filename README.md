# mesa.front

Interface do Mesa para salão, comandas individuais, entregas, administração, estoque, predefinições e fechamento do dia.

React + TypeScript + Vite. Este repositório contém somente a interface; API, permissões, banco e cálculos oficiais ficam em [mesa.backend](https://github.com/GiovanniDEVazevedo/mesa.backend).

## Executar localmente

Use Node.js 24 LTS. Clone `mesa.front` e `mesa.backend` como pastas irmãs.

```sh
git clone https://github.com/GiovanniDEVazevedo/mesa.front.git
cd mesa.front
npm ci
cp .env.example .env
npm run dev
```

No Windows PowerShell, use `Copy-Item .env.example .env`. Abra **http://127.0.0.1:5173**. Inicie também a API conforme o [README de mesa.backend](https://github.com/GiovanniDEVazevedo/mesa.backend#executar-localmente). O Vite encaminha `/api/*` e `/auth/*` para `127.0.0.1:8787`, sem expor credenciais no JavaScript.

## Verificar e compilar

```sh
npm run typecheck
npm run build
node tests/kitchen-queue.mjs
```

O build está em `dist`. `npm run preview` serve apenas os arquivos compilados; a API continua sendo um serviço separado.

## Publicação própria

O arquivo `wrangler.jsonc` publica os arquivos estáticos no Worker interno `mesa-front`. Publique este repositório primeiro com `npm run deploy`, na mesma conta Cloudflare do backend. O Worker `mesa-back` recebe o acesso público e busca a interface pela ligação de serviço `FRONTEND`, já declarada no backend. Abra o endereço de `mesa-back` para usar o sistema completo.

`workers_dev=false` mantém o frontend como serviço interno; ele não precisa de um endereço público separado. O primeiro deploy de teste pode usar o endereço `workers.dev` do backend. Siga o [passo a passo completo](https://github.com/GiovanniDEVazevedo/mesa.backend/blob/main/docs/subir-na-cloudflare.md).

Essa configuração mantém interface e API na mesma origem e não exige CORS aberto. `MESA_API_PROXY` serve somente ao desenvolvimento. Um domínio próprio pode ser adicionado depois ao backend.

O login da exportação usa Cloudflare Access na origem e as responsabilidades continuam no banco do Mesa. A edição anteriormente publicada no ChatGPT Sites tem implantação e autenticação separadas.

## Contrato da API

As telas mantêm o contrato de `/api/session`, `/api/registration`, `/api/kitchen`, `/api/restaurant`, `/api/inventory`, `/api/staff`, `/api/kitchen-button` e `/api/day-closing`. Os modelos em `src/*-model.ts`, `src/model.ts` e `src/reports.ts` são uma cópia versionada dos contratos do backend. Alterações nesses contratos devem ser sincronizadas nos dois repositórios.

## Cadastro da equipe

Pessoas autenticadas com Google e ainda sem acesso no Mesa veem a tela de cadastro, também disponível pelo caminho `/cadastro`. O e-mail vem da sessão; somente o nome é preenchido. Após o envio, a tela mostra a pendência e permite consultar a liberação. Recusa ou desativação não libera um novo cadastro para contornar a decisão do administrador.

Em **Equipe e botão → Solicitações de cadastro**, o administrador revisa cada pedido e escolhe garçom, cozinha ou administrador antes de aprovar. Publique primeiro o backend com a migração `0007_pale_gauntlet.sql`. Pessoas que ainda não constam na política da Cloudflare precisam ser autorizadas nessa política para chegar ao formulário; esta versão não abre o cadastro ao público.

## Aba e função Cozinha

Contas com função **Cozinha** entram diretamente na aba **Cozinha**, que também está disponível para administradores. A fila mostra dois pedidos por página no celular e em telas abaixo de 1024 px; a partir de 1024 px, mostra quatro cartões em duas colunas. Em celulares, os dois cartões ficam empilhados. Os controles permitem avançar e voltar entre páginas. A aba reúne a visualização dos pedidos e o botão **Chamar garçom**. Itens e observações longos têm rolagem dentro do cartão. Em janelas com pouca altura, a página também pode rolar para preservar os controles.

A fila atualiza a cada três segundos e mostra mesa, assento, itens, observações, tempo e garçom responsável. A conta Cozinha apenas visualiza os pedidos e chama o garçom. Não há controles para iniciar preparo ou marcar pratos prontos. A confirmação de retirada e entrega permanece com o salão. A interface usa `/api/kitchen`, que limita os dados e as ações também no servidor. Não são necessários novos secrets ou alteração da política de login para usar essa função em uma conta já autorizada na Cloudflare.

## Limites do piloto

Pagamentos são registros manuais. Ingredientes são baixados manualmente no estoque. Não há operação offline nem emissão fiscal. QR Code de notas permanece pausado; XML e entrada manual estão disponíveis. O banco de dados e os segredos de produção não fazem parte deste repositório.
