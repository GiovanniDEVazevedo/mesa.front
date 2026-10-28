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
```

O build está em `dist`. `npm run preview` serve apenas os arquivos compilados; a API continua sendo um serviço separado.

## Publicação própria

O arquivo `wrangler.jsonc` publica os arquivos estáticos no Worker interno `mesa-front`. Publique este repositório primeiro com `npm run deploy`, na mesma conta Cloudflare do backend. O Worker `mesa-back` recebe o acesso público e busca a interface pela ligação de serviço `FRONTEND`, já declarada no backend. Abra o endereço de `mesa-back` para usar o sistema completo.

`workers_dev=false` mantém o frontend como serviço interno; ele não precisa de um endereço público separado. O primeiro deploy de teste pode usar o endereço `workers.dev` do backend. Siga o [passo a passo completo](https://github.com/GiovanniDEVazevedo/mesa.backend/blob/main/docs/subir-na-cloudflare.md).

Essa configuração mantém interface e API na mesma origem e não exige CORS aberto. `MESA_API_PROXY` serve somente ao desenvolvimento. Um domínio próprio pode ser adicionado depois ao backend.

O login da exportação usa Cloudflare Access na origem e as responsabilidades continuam no banco do Mesa. A edição anteriormente publicada no ChatGPT Sites tem implantação e autenticação separadas.

## Contrato da API

As telas mantêm o contrato de `/api/session`, `/api/registration`, `/api/restaurant`, `/api/inventory`, `/api/staff`, `/api/kitchen-button` e `/api/day-closing`. Os modelos em `src/*-model.ts`, `src/model.ts` e `src/reports.ts` são uma cópia versionada dos contratos do backend. Alterações nesses contratos devem ser sincronizadas nos dois repositórios.

## Cadastro da equipe

Pessoas autenticadas com Google e ainda sem acesso no Mesa veem a tela de cadastro, também disponível pelo caminho `/cadastro`. O e-mail vem da sessão; somente o nome é preenchido. Após o envio, a tela mostra a pendência e permite consultar a liberação. Recusa ou desativação não libera um novo cadastro para contornar a decisão do administrador.

Em **Equipe e botão → Solicitações de cadastro**, o administrador revisa cada pedido e escolhe garçom ou administrador antes de aprovar. Publique primeiro o backend com a migração `0007_pale_gauntlet.sql`. Pessoas que ainda não constam na política da Cloudflare precisam ser autorizadas nessa política para chegar ao formulário; esta versão não abre o cadastro ao público.

## Limites do piloto

Pagamentos são registros manuais. Ingredientes são baixados manualmente no estoque. Não há operação offline nem emissão fiscal. QR Code de notas permanece pausado; XML e entrada manual estão disponíveis. O banco de dados e os segredos de produção não fazem parte deste repositório.
