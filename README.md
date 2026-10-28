# mesa_front

Interface do Mesa para salão, comandas individuais, entregas, administração, estoque, predefinições e fechamento do dia.

React + TypeScript + Vite. Este repositório contém somente a interface; API, permissões, banco e cálculos oficiais ficam em `mesa_back`.

## Executar localmente

Use Node.js 24 LTS. Clone `mesa_front` e `mesa_back` como pastas irmãs.

```sh
npm ci
cp .env.example .env
npm run dev
```

No Windows PowerShell, use `Copy-Item .env.example .env`. Abra **http://127.0.0.1:5173**. Inicie também a API conforme o README de `mesa_back`. O Vite encaminha `/api/*` e `/auth/*` para `127.0.0.1:8787`, sem expor credenciais no JavaScript.

## Verificar e compilar

```sh
npm run typecheck
npm run build
```

O build está em `dist`. `npm run preview` serve apenas os arquivos compilados; a API continua sendo um serviço separado.

## Publicação própria

O arquivo `wrangler.jsonc` prepara os arquivos estáticos para Cloudflare Workers. Configure um domínio próprio e publique front e back na mesma origem: `/api/*` e `/auth/*` devem ser atendidos pelo Worker `mesa-back`, e os demais caminhos pelos arquivos de `mesa-front`. Veja o guia de implantação no backend antes de publicar.

Essa configuração evita cookies entre sites e não exige CORS aberto. `MESA_API_PROXY` serve somente ao desenvolvimento e não configura rotas na hospedagem.

O login da exportação usa Cloudflare Access na origem e as responsabilidades continuam no banco do Mesa. A edição anteriormente publicada no ChatGPT Sites tem implantação e autenticação separadas.

## Contrato da API

As telas mantêm o contrato de `/api/session`, `/api/restaurant`, `/api/inventory`, `/api/staff`, `/api/kitchen-button` e `/api/day-closing`. Os modelos em `src/*-model.ts`, `src/model.ts` e `src/reports.ts` são uma cópia versionada dos contratos do backend. Alterações nesses contratos devem ser sincronizadas nos dois repositórios.

## Limites do piloto

Pagamentos são registros manuais. Ingredientes são baixados manualmente no estoque. Não há operação offline nem emissão fiscal. QR Code de notas permanece pausado; XML e entrada manual estão disponíveis. O banco de dados e os segredos de produção não fazem parte deste repositório.
