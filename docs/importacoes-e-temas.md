# Importações e temas do catálogo

## Onde encontrar

No editor, abra **Importações** para importar produtos por Excel ou imagens pelo código. Abra **Temas e fundo** para personalizar a campanha acima dos produtos.

## Importações

- Excel: formato `.xlsx`, até 20 MB e 20.000 produtos por aba. Reconhece as colunas da planilha produtos.xlsx, permite escolher a aba e a linha de cabeçalho e ajustar o mapeamento.
- O código identifica o produto. Escolha cadastrar apenas novos ou atualizar os existentes. Novos produtos ficam como rascunho, salvo se a publicação for marcada explicitamente.
- Fotos, textos editoriais, características, destaque e publicação dos produtos existentes são preservados. Campos opcionais vazios não apagam dados.
- Marcas e caminhos de departamento/seção/categoria novos são acrescentados. O segmento segue as regras do catálogo.
- Imagens: selecione até 500 arquivos, de até 5 MB cada, em PNG, JPEG, WebP ou GIF estático. Exemplos: `123.jpg`, `123_frente.png` e `123-foto.webp` para o código `123`. O código deve coincidir exatamente, incluindo zeros à esquerda e letras.
- Uploads individuais e em lote são convertidos no navegador para WebP antes do envio: até 1.920 px no maior lado, sem ampliar arquivos pequenos, com transparência preservada. A compressão inicia em qualidade 82 e tenta reduzir mais quando o arquivo supera 512 KB; esse tamanho é um alvo, não uma garantia. WebP já pequeno não é recomprimido. O relatório informa o tamanho original e o armazenado. Os originais no computador e imagens antigas do site não são alterados. Animações são recusadas com aviso, para não perder movimento silenciosamente. Fontes com mais de 40 megapixels ou 16.384 px por lado são recusadas por segurança. URLs externas continuam sendo referências, sem cópia/conversão automática.
- O armazenamento aceita novos uploads somente como WebP estático, com assinatura, estrutura e dimensões verificadas. Links antigos em PNG/JPEG/GIF permanecem acessíveis.
- Há uma imagem principal por produto. Duplicidades e arquivos sem correspondência ficam para revisão. Substituir uma foto existente exige marcar a opção correspondente e confirmar o envio.
- Revise a prévia antes de confirmar. O processamento ocorre em pequenos lotes; parar não desfaz os lotes concluídos. Se a conexão falhar, analise novamente antes de tentar, pois o último envio pode ter sido salvo sem confirmação. O relatório pode ser baixado em CSV.

## Campanhas

A busca pública fica no cabeçalho ao lado da logo e permanece disponível enquanto a página é percorrida. Na área do catálogo, uma única linha reúne os departamentos e os filtros dependentes de Seção e Categoria; os filtros de Marca, Segmento e o botão de limpeza não aparecem mais nessa faixa. Marcas e segmentos continuam acessíveis em suas seções e popups. Entre blocos consecutivos de banner, catálogo, marcas ou segmentos, uma faixa usa exatamente a cor de fundo configurada para separar visualmente os carrosséis.

Há sete temas prontos: Natal, Ano Novo, Black Friday, Dia das Mães, aniversário da empresa, Carnaval e Dia das Crianças. A escolha é manual, sem calendário automático.

Escolha **Tema pronto**, **Minha imagem** ou **Carrossel de fundo**. O tema funciona somente como plano de fundo atrás do título institucional, busca e filtros. Não existem painéis promocionais, botão extra ou quadro de totais. Os produtos ficam logo abaixo. O carrossel aceita até 12 imagens com nome interno e ordem editáveis; a imagem muda sem duplicar ou reiniciar os filtros. É possível usar artes prontas e próprias no mesmo carrossel. O fundo pode ficar somente no cabeçalho ou também na área dos produtos. Ajuste enquadramento e clareamento. O título e o texto institucional permanecem editáveis em **Aparência e página**, no bloco **Catálogo**.

A prévia do editor não publica as alterações. Use **Salvar e publicar página** para aplicá-las ao catálogo desta instalação local. Não foi realizada publicação externa.

## Artes originais

As sete artes foram geradas com a ferramenta integrada **image_gen**, uma solicitação por arte, sem textos incorporados. Os textos da campanha permanecem editáveis no site. As imagens foram inspecionadas e salvas em PNG, 1536 × 1024.

Arquivos finais integrados ao site:

- [Natal](C:/Users/fatur/Documents/Codex/2026-09-02/que/site/public/themes/natal.png)
- [Ano Novo](C:/Users/fatur/Documents/Codex/2026-09-02/que/site/public/themes/ano-novo.png)
- [Black Friday](C:/Users/fatur/Documents/Codex/2026-09-02/que/site/public/themes/black-friday.png)
- [Dia das Mães](C:/Users/fatur/Documents/Codex/2026-09-02/que/site/public/themes/dia-das-maes.png)
- [Aniversário da empresa](C:/Users/fatur/Documents/Codex/2026-09-02/que/site/public/themes/aniversario.png)
- [Carnaval](C:/Users/fatur/Documents/Codex/2026-09-02/que/site/public/themes/carnaval.png)
- [Dia das Crianças](C:/Users/fatur/Documents/Codex/2026-09-02/que/site/public/themes/dia-das-criancas.png)

Solicitações exatas de geração, preservadas integralmente:

- [Natal, Ano Novo e Black Friday](C:/Users/fatur/Documents/Codex/2026-09-02/que/work/holiday-assets/winter-prompts.json)
- [Dia das Mães e aniversário](C:/Users/fatur/Documents/Codex/2026-09-02/que/work/holiday-assets/celebration-prompts.md)
- [Carnaval e Dia das Crianças](C:/Users/fatur/Documents/Codex/2026-09-02/que/work/holiday-assets/colorful-hero-prompts.md)

## Validação

Compilação local concluída. Treze testes automatizados passaram, incluindo leitura dos 2.525 produtos da planilha original, proteção de acesso, importação e atualização em banco isolado, associação de imagens, persistência dos temas e ausência dos painéis promocionais. A renderização mantém uma única busca e um único conjunto de filtros, mesmo com vários fundos no carrossel. O arquivo Excel e os produtos reais não foram alterados pelos testes. As sete imagens estão disponíveis na prévia local.

## Cores e contraste

Em Aparência e página, escolha Automático ou Personalizado para títulos, textos, descrições, destaques, textos sobre a cor principal, textos sobre o tema e cores do fundo/texto do rodapé. A prévia acompanha os ajustes; salvar aplica ao público. O automático calcula luminância relativa e busca contraste mínimo de 4,5:1 em superfícies sólidas; combinações manuais insuficientes geram aviso, sem substituir a escolha. Os temas usam uma área opaca de leitura derivada da paleta para não depender da luminosidade de cada fotografia. Não há análise de pixels nem alteração de letras já incorporadas em logos/imagens. Configurações antigas recebem padrões automáticos sem sobrescrever cores e identidade salvas.

## Marcas em popup

Os dois carrosséis têm movimento automático suave a cada 4,5 segundos. O movimento pausa durante mouse, toque ou foco do teclado e pode ser pausado ou retomado pelo botão do carrossel. A preferência de movimento reduzido desativa o avanço automático.

Segmentos e marcas aparecem em carrosséis horizontais de uma única linha, com arraste, navegação por teclado, botões de voltar/avançar e movimento automático suave a cada 4,5 segundos. O movimento pausa durante mouse, toque ou foco do teclado e pode ser pausado ou retomado pelo botão do carrossel. A preferência de movimento reduzido desativa o avanço automático. O carrossel de marcas mostra somente marcas publicadas e em destaque. **Mostrar mais marcas** abre um popup com busca e todas as marcas publicadas, incluindo as sem destaque. Clicar em uma marca abre seus produtos num popup interno; fechar retorna à lista sem perder a busca. Em **Aparência e página → Cores dos textos, cards e rodapé**, escolha o contorno dos segmentos, o fundo sólido dos cards das marcas e sua cor de texto (automática por contraste ou personalizada). As configurações antigas recebem padrões sem mudar as demais escolhas. Salve e publique a página para aplicar as cores; as logos não são recoloridas. A altura dos cards de segmentos permanece para ajuste em uma próxima etapa.

Clicar numa marca ou segmento abre seus produtos num popup com busca independente, contagem e carregamento progressivo. Os detalhes do produto abrem num popup interno com sugestões de similares; fechar devolve à lista. Nenhum dos dois altera os filtros principais ou manda a página para o início. Cada segmento usa um símbolo correspondente à atividade, com símbolo de loja como alternativa para nomes personalizados.

## Tamanhos, divisórias e publicação de marcas

- O editor apresenta um bloco próprio **Contato comercial**. O e-mail preenchido cria o botão de solicitação nos detalhes de todos os produtos; sem ele, aparece o aviso de contato não cadastrado.
- Os textos do popup dos produtos usam maior peso e contraste. A seção pública de marcas recebe fundo sólido — por padrão, a mesma cor principal dos segmentos. No editor de cores, o fundo e o texto da seção de marcas podem ser automáticos ou personalizados separadamente das cores dos cards.
- No popup de detalhes, a foto ocupa uma área maior da coluna esquerda e acompanha o ajuste de altura definido no editor. O produto é ampliado sem corte, centralizado em fundo branco; no celular, a área é reduzida para manter as informações acessíveis.

- Em Aparência e página, ajuste a largura da logo (80–320 px, padrão 180), a altura das fotos (100–360 px, padrão 200) e escolha entre exibir o produto inteiro ou preencher com corte. A logo respeita a largura da tela. As fotos nos cartões dos popups usam o mesmo tamanho. Configurações anteriores recebem os novos padrões sem mudar os arquivos de imagem.
- As divisórias acima/abaixo da busca e entre as marcas e segmentos foram retiradas; indicadores de foco do teclado permanecem.
- Na ficha de marca, a lupa abre um popup de busca no Wikimedia Commons. Clique numa imagem para baixá-la, convertê-la em WebP, preencher a marca e voltar ao editor. Salvar a página continua necessário para publicar. A busca integrada exibe somente arquivos identificados pela fonte como domínio público ou CC0; confira a identidade da marca e a fonte. A cobertura é limitada. Para logos encontradas em outros sites, use Copiar imagem e Ctrl+V no campo do popup, ou selecione o arquivo. Sites externos não devolvem cliques ao editor automaticamente. O Seeklogo bloqueou a consulta automática, por isso não é uma fonte integrada.
- As consultas de logo exigem administrador. A seleção resolve um identificador na fonte, sem aceitar URLs arbitrárias no servidor. Só baixa imagens raster de upload.wikimedia.org/thumb.wikimedia.org, não segue redirecionamentos, limita o tamanho a 5 MB e reutiliza a validação/conversão de imagens. Erros não substituem a logo anterior; a busca não altera os demais campos da marca.
- O fundo da área das fotos é sempre branco no catálogo, nos popups e nos espaços sem foto, independentemente do tema. Isso não remove fundos incorporados aos arquivos de imagem.
- Quando um tema, imagem ou carrossel está ativo, o título institucional, a busca, as abas e os filtros fechados ficam transparentes sobre a arte, sem o antigo preenchimento azulado. Letras, ícones e bordas usam as cores de leitura do tema com contorno e sombra de contraste. As opções abertas dos campos permanecem em superfície sólida para leitura. Sem fundo de campanha, os controles mantêm a aparência comum do catálogo.
- Marcas novas, inclusive criadas pela importação de produtos, começam como rascunho. Publicar controla a apresentação na área de marcas; Destaque ordena antes das outras e exibe uma estrela. Uma marca em destaque, mas sem Publicar, continua oculta. Produtos vinculados mantêm sua publicação independente. Registros antigos sem essas opções continuam publicados e aparecem com Publicar marcado no editor. Os dados de marcas em rascunho ficam fora da resposta pública de configuração; o editor usa uma consulta protegida.
