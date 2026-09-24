# Catálogo Institucional (Catálogo Laurencini)

Idioma: responder sempre em pt-BR. Carregar a skill `principal-software-engineer`.

## O que é
Catálogo digital público de produtos com editor administrativo (login, importação Excel/imagens, marcas/logos, campanhas, temas, layout, publicação) e app Android.
- Editor: https://catalogo-institucional-editor.paulohenriquepmelo.workers.dev (Worker `catalogo-institucional-editor`, `WORKER_ROLE=editor`, D1 + R2)
- Público: https://sites-project.paulohenriquepmelo.workers.dev (Worker `sites-project`, `WORKER_ROLE=public`, só R2)

## Stack
- vinext (Next-like sobre Vite, RSC) + React + TS + Tailwind + shadcn/base-ui; pnpm. Rotas em `app/`, API em `app/api/*`, lógica em `lib/`.
- D1 `catalogo-institucional-db` via drizzle (`db/schema.ts`, migrations em `drizzle/`); R2 `catalogo-institucional-files`. Import Excel em Web Worker (`workers/excel-import.worker.ts`).
- Mobile: `mobile/` (Expo 57 / React Native 0.86), consome `/api/config` e `/api/products` do site público, cache offline.

## Comandos
- `pnpm dev` · `pnpm build` · `pnpm test` (`scripts/test.mjs`, testes em `tests/`) · `pnpm lint` (oxlint) · `pnpm db:generate`
- Deploy: GitHub Actions `deploy-cloudflare.yml` → `wrangler deploy --config wrangler.deploy.jsonc --env editor` e `--env public`.

## Regras
- Importação: produto identificado pelo código exato; novos entram como rascunho; campos opcionais vazios não apagam dados; fotos/textos existentes preservados.
- Uploads convertidos para WebP no navegador (máx. 1920 px, qualidade 82); o storage aceita novos uploads só em WebP. Detalhes: `docs/importacoes-e-temas.md`.
