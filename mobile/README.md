# Catálogo Laurencini — app Android

App nativo (React Native + Expo) que exibe o mesmo catálogo público do site
(`sites-project.paulohenriquepmelo.workers.dev`), consumindo as rotas
`/api/config` e `/api/products`. Não tem editor nem login — é só a vitrine
pública, igual ao site, com navegação em estilo app de marketplace.

Qualquer publicação feita no editor do site aparece no app automaticamente
na próxima vez que ele buscar os dados (abrir o app, puxar para atualizar,
ou voltar para o app depois de um tempo) — não precisa atualizar o app em
si para isso.

## Telas

- **Início** — busca, banners, campanha, ofertas em destaque, novidades em
  destaque, atalho de marcas.
- **Catálogo** — busca e filtro por marca, grid completo do catálogo.
- **Ofertas** — todas as ofertas ativas no momento, com contagem regressiva.
- **Novidades** — produtos novos (mesma regra de dias do site).
- **Marcas** — grid de marcas publicadas, com contagem de produtos.
- **Produto** — ficha do produto com specs, dados técnicos, contato
  comercial e itens parecidos (mesma pontuação de similaridade do site).

Sem internet, o app mostra o último catálogo salvo no aparelho (aviso
"Sem conexão" aparece no topo da Início).

## Ícone e logo

`assets/icon.png`, `assets/adaptive-icon.png`, `assets/splash.png` e
`assets/logo.png` são placeholders (um "L" nas cores da marca). Troque
pelos arquivos reais da logo da Laurencini quando tiver — mesmo nome,
mesmo tamanho aproximado (todos quadrados, `logo.png` com fundo
transparente).

## Como gerar um APK de teste (primeira vez)

Este ambiente não consegue compilar Android diretamente (sem acesso ao
Android SDK), então a build roda na nuvem da Expo (EAS Build). Duas
formas de disparar a build — escolha uma:

### Opção A — pelo seu computador (mais rápido para o primeiro teste)

Precisa ter Node.js instalado. Dentro da pasta do projeto:

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

O `eas login` vai pedir seu usuário/senha da conta Expo (a mesma que você
conectou aqui na conversa). Ao final, o terminal mostra um link
`https://expo.dev/accounts/.../builds/...` — abra esse link e baixe o
`.apk` quando o build terminar (leva uns 10-15 minutos). Esse é o APK de
teste para você analisar antes de qualquer coisa ir para o R2.

Para instalar no celular: copie o `.apk` para o aparelho e abra o arquivo
(o Android vai pedir para permitir "instalar apps de fontes desconhecidas"
na primeira vez — é esperado, porque não estamos usando a Play Store).

### Opção B — deixar comigo disparando as próximas builds

Para eu conseguir chamar uma nova build direto daqui (sem você precisar
rodar nada no terminal depois), o projeto precisa estar num repositório
GitHub conectado à Expo:

1. Crie um repositório novo no GitHub (pode ser privado) e suba esta pasta
   nele (`git init`, `git add .`, `git commit`, `git remote add origin ...`,
   `git push`).
2. Rode a Opção A pelo menos uma vez (o `eas build` local também registra o
   projeto na sua conta Expo — necessário mesmo se você for usar só a
   Opção B depois).
3. Acesse `https://expo.dev/accounts/[sua-conta]/projects/catalogo-laurencini-app/github`,
   clique em instalar o app do GitHub da Expo e conecte o repositório.

Depois disso, eu consigo pedir uma build nova a qualquer momento (por
exemplo depois de um ajuste no app) sem você precisar rodar nada.

## Publicação do APK (depois do teste aprovado)

Depois que você aprovar a versão beta, o `.apk` final vai para o bucket R2
(`catalogo-institucional-files`, mesmo bucket das imagens) e o site público
ganha um botão "Baixar app" apontando para uma rota que serve esse arquivo
— os detalhes técnicos dessa parte estão descritos à parte, junto das
mudanças no site.
