import type { AppIconName } from '@/components/AppIcon';

/**
 * Segmentos de clientes do app (gerado a partir das regras validadas contra o
 * catálogo publicado; edite aqui e confira as contagens na aba Segmentos).
 *
 * Diferente do site, um produto pode estar em VÁRIOS segmentos: a sacola
 * serve para a padaria, o restaurante e o delivery. Cada segmento é dividido
 * em grupos (insumos, embalagens, revenda...).
 *
 * Um grupo inclui o produto quando a CATEGORIA dele está em `categories` OU o
 * NOME tem alguma palavra de `keywords`, e o nome não tem nenhuma de
 * `exclude`. As palavras casam pelo início ("sacola" pega "sacolas"); um
 * espaço no fim exige a palavra inteira ("copo " não pega "Copobras").
 * Acentos e maiúsculas são ignorados.
 */

export type SegmentGroupRule = {
  name: string;
  categories: string[];
  keywords: string[];
  exclude: string[];
};

export type SegmentRule = {
  id: string;
  name: string;
  note: string;
  icon: AppIconName;
  groups: SegmentGroupRule[];
};

export const SEGMENT_RULES: SegmentRule[] = [
  {
    id: 'supermercados',
    name: 'Supermercados e mercearias',
    note: 'Revenda do dia a dia e abastecimento',
    icon: 'basket',
    groups: [
      {
        name: 'Mercearia',
        categories: ['1.2-mercearia', '1.4-massas', '1.6-santa amalia', 'alimentos', 'farinhas & farofas', 'temperos', '1.5-condimentos guarana'],
        keywords: [],
        exclude: ['cesta'],
      },
      {
        name: 'Biscoitos e matinais',
        categories: ['1.3-biscoitos'],
        keywords: ['achocolat', 'cafe radiante', 'cereal'],
        exclude: [],
      },
      {
        name: 'Bebidas',
        categories: ['3.1-sucos', '3.2-refrigerantes', '3.3-energeticos', '3.4-agua mineral'],
        keywords: [],
        exclude: [],
      },
      {
        name: 'Cervejas, destilados e vinhos',
        categories: ['4.1-cervejas', '4.2-destilados', '4.3-vinhos & espumantes'],
        keywords: [],
        exclude: ['porta', 'cesta'],
      },
      {
        name: 'Bomboniere',
        categories: ['2.1-balas & drops', '2.2-chicletes', '2.3-pirulitos', '2.4-chocolates', '2.5-doces / brinquedos', '2.7-gulozitos', 'barra dark', 'barra regular', 'hersheys mix'],
        keywords: [],
        exclude: [],
      },
      {
        name: 'Salgadinhos e petiscos',
        categories: ['2.6-salgadinhos / pipocas / chips', 'salgadinhos', 'pipocas microondas', 'batata chips art fritas', 'torresmos'],
        keywords: ['amendoim', 'mendoreto', 'pururuca'],
        exclude: [],
      },
      {
        name: 'Higiene e perfumaria',
        categories: ['higiene pessoal'],
        keywords: ['papel hig', 'fralda'],
        exclude: [],
      },
      {
        name: 'Limpeza',
        categories: ['limpeza'],
        keywords: ['vassoura', 'rodo', 'pa p/ lixo', 'pa de lixo', 'esponja', 'pano', 'saco lixo', 'papel toalha', 'dispenser', 'escova sanit', 'desentupidor', 'balde', 'lixeira'],
        exclude: [],
      },
      {
        name: 'Sacolas e bobinas',
        categories: ['sacolas/ bobinas/ sacos pp'],
        keywords: [],
        exclude: ['teste', 'hambur', 'talher', 'deliv', 'pizza'],
      },
      {
        name: 'Utilidades e bazar',
        categories: ['utilidades', 'filme pvc/ papel aluminio'],
        keywords: [],
        exclude: ['vassoura', 'rodo', 'saco lixo', 'esponja', 'pano', 'porta latinha', 'porta cerveja', 'porta litrao', 'porta latao', 'porta guardanapo'],
      },
      {
        name: 'Datas especiais',
        categories: ['fogos'],
        keywords: ['cesta', 'panettone', 'chocotone', 'ovo de pascoa', 'caixa natal'],
        exclude: [],
      },
    ],
  },
  {
    id: 'restaurantes',
    name: 'Restaurantes e lanchonetes',
    note: 'Insumos, descartáveis e embalagens',
    icon: 'restaurant',
    groups: [
      {
        name: 'Insumos de cozinha',
        categories: ['1.1-food service', '1.5-condimentos guarana', 'temperos', 'banhas', 'linha foods service'],
        keywords: ['oleo', 'azeite', 'vinagre', 'extrato', 'molho', 'caldo', 'tempero', 'cond ', 'azeitona', 'palmito', 'milho verde', 'ervilha', 'seleta', 'cogumelo', 'sardinha', 'atum', 'maionese', 'catchup', 'mostarda', 'far trigo', 'farinha', 'farofa', 'amido', 'polvilho', 'mortadela', 'salsicha', 'linguica'],
        exclude: ['sache', 'chips', 'pipoca', 'salg ', 'bala', 'mini '],
      },
      {
        name: 'Sachês e molhos individuais',
        categories: [],
        keywords: ['sache'],
        exclude: ['canudo', 'garfo', 'faca', 'colher', 'sabao', 'amaciante', 'detergente', 'milho', 'ervilha'],
      },
      {
        name: 'Descartáveis',
        categories: ['descartaveis'],
        keywords: ['copo ', 'prato', 'garfo', 'colher', 'faca', 'talher', 'canudo', 'guardanapo', 'mexedor', 'palito', 'tampa'],
        exclude: ['doce', 'bala', 'choco', 'luva', 'mascara', 'touca', 'dispenser', 'extrato', 'pilha', 'americano', 'nadir', 'porta', 'frigideira', 'panela', 'canecao', 'caneca', 'leiteira', 'cuscuzeira', 'chaleira', 'caçarola', 'cacarola', 'forma de', 'isqueiro'],
      },
      {
        name: 'Luvas, toucas e proteção',
        categories: [],
        keywords: ['luva', 'touca', 'mascara', 'avental'],
        exclude: [],
      },
      {
        name: 'Marmitex e bandejas',
        categories: ['eps (isopor)/bandejas aluminio'],
        keywords: ['marmitex', 'bandeja', 'assadeira', 'pote termico', 'copo termico', 'tampa pote'],
        exclude: ['disco pizza', 'hambur', 'prato', 'frigideira', 'panela', 'canecao', 'caneca', 'leiteira', 'cuscuzeira', 'chaleira', 'caçarola', 'cacarola', 'forma de', 'isqueiro'],
      },
      {
        name: 'Potes e tampas',
        categories: [],
        keywords: ['pote', 'emb kit pot', 'sushi', 'emb. ret', 'embalagem (base)', 'embalagem (tampa)', 'frangueira'],
        exclude: ['choco', 'pacoca', 'doce', 'bala', 'goma', 'confeito', 'granulado', 'cond ', 'escova', 'soda', 'marmitex', 'termico', 'p/ molho'],
      },
      {
        name: 'Sacolas para viagem',
        categories: ['sacolas/ bobinas/ sacos pp'],
        keywords: [],
        exclude: ['teste', 'lixo'],
      },
      {
        name: 'Bebidas para revenda',
        categories: ['3.1-sucos', '3.2-refrigerantes', '3.3-energeticos', '3.4-agua mineral', '4.1-cervejas'],
        keywords: [],
        exclude: ['porta', 'cesta'],
      },
      {
        name: 'Cozinha e limpeza',
        categories: ['limpeza', 'filme pvc/ papel aluminio'],
        keywords: ['frigideira', 'canecao', 'panela', 'caneca', 'coador', 'escorredor', 'concha', 'escumadeira', 'tabua', 'taboa', 'pano', 'esponja', 'saco lixo', 'papel toalha', 'porta guardanapo', 'galheteiro', 'saleiro'],
        exclude: ['vinho'],
      },
    ],
  },
  {
    id: 'padarias',
    name: 'Padarias e confeitarias',
    note: 'Produção, embalagens e revenda de balcão',
    icon: 'bread',
    groups: [
      {
        name: 'Farinhas, fermentos e misturas',
        categories: ['dona benta'],
        keywords: ['far trigo', 'farinha', 'fermento', 'fermix', 'mistura p/ bolo', 'mistura bolo', 'mistura p/bolo', 'amido', 'polvilho', 'fuba', 'trigo p', 'melhorador'],
        exclude: ['bisc', 'salg', 'kibe'],
      },
      {
        name: 'Recheios, coberturas e confeitos',
        categories: ['linha foods service'],
        keywords: ['margarina', 'chantil', 'cobertura', 'recheio', 'creme de conf', 'creme culinario', 'choc. granul', 'granulado', 'coco ralado', 'leite cond', 'leite condensado', 'acucar', 'gelatina sem sabor', 'gelatina em po', 'corante', 'confeit', 'doce de leite', 'sob.lactea', 'forneavel', 'choco creme', 'creme de leite', 'chocolate em po', 'achocolatado em po', 'goiabada', 'essencia', 'aroma', 'glucose', 'cremor', 'bicarbonato', 'emulsificante'],
        exclude: ['bala', 'bisc', 'suco', 'goma', 'ref ', 'gomets', 'pirulito', 'pir ', 'chup ', 'doce mole', 'brinq', 'lavanda', 'limpadua'],
      },
      {
        name: 'Embalagens de bolo, torta e doces',
        categories: [],
        keywords: ['emb bolo', 'emba. bolo', 'embalagem p/ bolo', 'torta', 'leva doce', 'salgados/doces', 'emb leva', 'forminha', 'fatia', 'mini bolo', 'cake', 'cupcake', 'bandeja', 'disco', 'tampa'],
        exclude: ['pizza', 'marmitex', 'copo', 'pote termico', 'eps', 'doce mole', 'isopor', 'hambur', 'frigideira', 'panela', 'canecao', 'caneca', 'leiteira', 'cuscuzeira', 'chaleira', 'caçarola', 'cacarola', 'forma de', 'isqueiro'],
      },
      {
        name: 'Sacolas, sacos e papéis',
        categories: ['sacolas/ bobinas/ sacos pp'],
        keywords: ['papel manteiga', 'papel canada', 'papel p/'],
        exclude: ['teste', 'lixo', 'hamburg', 'pizza'],
      },
      {
        name: 'Descartáveis e proteção',
        categories: [],
        keywords: ['luva', 'touca', 'mascara', 'guardanapo', 'copo ', 'garfo', 'colher', 'mexedor', 'filme pvc', 'papel aluminio'],
        exclude: ['doce', 'bala', 'choco', 'extrato', 'americano', 'nadir', 'porta guardanapo', 'termico', 'borracha', 'latex', 'nitrilica'],
      },
      {
        name: 'Revenda de balcão',
        categories: ['1.3-biscoitos', '3.1-sucos', '3.2-refrigerantes', '3.4-agua mineral', '2.4-chocolates', 'barra regular', 'barra dark', '2.1-balas & drops', '2.2-chicletes'],
        keywords: ['panettone', 'chocotone', 'bolinho', 'sequilho', 'rosquinha', 'wafer', 'cafe radiante', 'achocolatado 200', 'leite cond.', 'doce de leite (ebl)'],
        exclude: ['cesta'],
      },
      {
        name: 'Limpeza',
        categories: ['limpeza'],
        keywords: ['vassoura', 'rodo', 'pa p/ lixo', 'pa de lixo', 'esponja', 'pano', 'saco lixo', 'papel toalha', 'dispenser', 'escova sanit', 'desentupidor', 'balde', 'lixeira'],
        exclude: [],
      },
    ],
  },
  {
    id: 'docerias',
    name: 'Docerias e bombonieres',
    note: 'Doces, chocolates e embalagens para doces',
    icon: 'candy',
    groups: [
      {
        name: 'Chocolates',
        categories: ['2.4-chocolates', 'barra dark', 'barra regular', 'hersheys mix'],
        keywords: [],
        exclude: ['cesta'],
      },
      {
        name: 'Balas, chicletes e pirulitos',
        categories: ['2.1-balas & drops', '2.2-chicletes', '2.3-pirulitos'],
        keywords: [],
        exclude: [],
      },
      {
        name: 'Doces e brinquedos',
        categories: ['2.5-doces / brinquedos', '2.7-gulozitos'],
        keywords: ['pacoca', 'pe de moleque', 'doce mole', 'mariola', 'goiabada', 'bananada', 'cocada'],
        exclude: [],
      },
      {
        name: 'Salgadinhos e petiscos',
        categories: ['2.6-salgadinhos / pipocas / chips', 'salgadinhos', 'pipocas microondas', 'batata chips art fritas', 'torresmos'],
        keywords: ['amendoim', 'mendoreto', 'pururuca'],
        exclude: [],
      },
      {
        name: 'Confeitaria',
        categories: ['linha foods service'],
        keywords: ['granulado', 'confeit', 'cobertura', 'coco ralado', 'leite cond', 'sob.lactea', 'brigadeiro', 'chocolate em po', 'corante', 'forneavel', 'choco creme'],
        exclude: ['bala', 'bombom', 'brinq', 'pir '],
      },
      {
        name: 'Embalagens para doces',
        categories: [],
        keywords: ['leva doce', 'salgados/doces', 'emb bolo', 'emba. bolo', 'torta', 'forminha', 'saquinho', 'celofane'],
        exclude: ['pizza'],
      },
    ],
  },
  {
    id: 'bares',
    name: 'Bares e conveniências',
    note: 'Bebidas, petiscos e itens de balcão',
    icon: 'beer',
    groups: [
      {
        name: 'Cervejas',
        categories: ['4.1-cervejas'],
        keywords: [],
        exclude: ['porta'],
      },
      {
        name: 'Destilados',
        categories: ['4.2-destilados'],
        keywords: [],
        exclude: ['cesta'],
      },
      {
        name: 'Vinhos e espumantes',
        categories: ['4.3-vinhos & espumantes'],
        keywords: [],
        exclude: ['cesta'],
      },
      {
        name: 'Refrigerantes, sucos e energéticos',
        categories: ['3.2-refrigerantes', '3.1-sucos', '3.3-energeticos', '3.4-agua mineral'],
        keywords: [],
        exclude: [],
      },
      {
        name: 'Salgadinhos e petiscos',
        categories: ['2.6-salgadinhos / pipocas / chips', 'salgadinhos', 'pipocas microondas', 'batata chips art fritas', 'torresmos'],
        keywords: ['amendoim', 'mendoreto', 'pururuca'],
        exclude: [],
      },
      {
        name: 'Bomboniere de balcão',
        categories: ['2.2-chicletes', '2.1-balas & drops', '2.3-pirulitos', 'barra regular'],
        keywords: ['chocolate', 'wafer'],
        exclude: [],
      },
      {
        name: 'Copos, porta-latas e acessórios',
        categories: [],
        keywords: ['porta latinha', 'porta cerveja', 'porta litrao', 'porta latao', 'copo americano', 'copo desc', 'copo transp', 'palito', 'canudo', 'guardanapo', 'porta guardanapo', 'porta canudo', 'baralho', 'abridor', 'isqueiro', 'gelo'],
        exclude: ['doce', 'pilha', 'bala'],
      },
    ],
  },
  {
    id: 'delivery',
    name: 'Delivery e embalagens',
    note: 'Embalagens para preparo, entrega e viagem',
    icon: 'truck',
    groups: [
      {
        name: 'Marmitex e bandejas',
        categories: ['eps (isopor)/bandejas aluminio'],
        keywords: ['marmitex', 'bandeja', 'assadeira', 'pote termico', 'copo termico', 'tampa pote'],
        exclude: ['disco pizza', 'hambur', 'prato', 'frigideira', 'panela', 'canecao', 'caneca', 'leiteira', 'cuscuzeira', 'chaleira', 'caçarola', 'cacarola', 'forma de', 'isqueiro'],
      },
      {
        name: 'Potes e tampas',
        categories: [],
        keywords: ['pote', 'emb kit pot', 'sushi', 'emb. ret', 'embalagem (base)', 'embalagem (tampa)', 'frangueira'],
        exclude: ['choco', 'pacoca', 'doce', 'bala', 'goma', 'confeito', 'granulado', 'cond ', 'escova', 'soda', 'marmitex', 'termico', 'p/ molho'],
      },
      {
        name: 'Pizza',
        categories: [],
        keywords: ['pizza', 'disco pizza'],
        exclude: ['far trigo', 'molho'],
      },
      {
        name: 'Hambúrguer e lanches',
        categories: [],
        keywords: ['hambur', 'hot dog', 'papel p/hamburg', 'embalagem batata', 'emb batata', 'papel acoplado'],
        exclude: ['molho'],
      },
      {
        name: 'Sacolas de entrega',
        categories: [],
        keywords: ['deliv', 'kraft', 'sacola papel', 'sacola camis', 'sacola p/', 'sacola cam'],
        exclude: ['talher', 'teste'],
      },
      {
        name: 'Copos e tampas',
        categories: [],
        keywords: ['copo ', 'tampa copo', 'tampa t', 'tampa bolha', 'tampa p/ copo'],
        exclude: ['doce', 'bala', 'choco', 'extrato', 'americano', 'nadir', 'pote', 'marmitex', 'termico', 'frigideira', 'panela', 'canecao', 'caneca', 'leiteira', 'cuscuzeira', 'chaleira', 'caçarola', 'cacarola', 'forma de', 'isqueiro'],
      },
      {
        name: 'Sachês e molhos individuais',
        categories: [],
        keywords: ['sache'],
        exclude: ['canudo', 'garfo', 'faca', 'colher', 'sabao', 'amaciante', 'detergente', 'milho', 'ervilha'],
      },
      {
        name: 'Talheres e guardanapos',
        categories: [],
        keywords: ['garfo', 'faca', 'colher', 'talher', 'guardanapo', 'canudo', 'mexedor'],
        exclude: ['porta guardanapo'],
      },
      {
        name: 'Filme PVC e papel alumínio',
        categories: ['filme pvc/ papel aluminio'],
        keywords: [],
        exclude: [],
      },
    ],
  },
  {
    id: 'higiene',
    name: 'Perfumarias e higiene',
    note: 'Higiene pessoal e cuidados',
    icon: 'medkit',
    groups: [
      {
        name: 'Higiene pessoal',
        categories: ['higiene pessoal'],
        keywords: [],
        exclude: ['papel hig', 'fralda', 'creme dental', 'escova dental', 'fio dental'],
      },
      {
        name: 'Papel higiênico e fraldas',
        categories: [],
        keywords: ['papel hig', 'fralda', 'lenco umedec'],
        exclude: [],
      },
      {
        name: 'Higiene bucal',
        categories: [],
        keywords: ['creme dental', 'escova dental', 'fio dental', 'enxaguante'],
        exclude: [],
      },
    ],
  },
  {
    id: 'limpeza',
    name: 'Limpeza profissional',
    note: 'Produtos e utensílios de limpeza',
    icon: 'spray',
    groups: [
      {
        name: 'Produtos de limpeza',
        categories: ['limpeza'],
        keywords: [],
        exclude: ['vassoura', 'rodo', 'pano', 'esponja', 'luva', 'saco lixo'],
      },
      {
        name: 'Vassouras, rodos e utensílios',
        categories: [],
        keywords: ['vassoura', 'rodo', 'rastelo', 'pa p/ lixo', 'pa de lixo', 'cabo madeira', 'escova', 'desentupidor', 'balde', 'lixeira', 'esfregao', 'mop'],
        exclude: ['escova dental'],
      },
      {
        name: 'Panos, esponjas e luvas',
        categories: [],
        keywords: ['pano', 'esponja', 'flanela', 'luva', 'la de aco', 'bombril'],
        exclude: ['nitrilica', 'vinil', 'descartavel', 'latex', 'plast'],
      },
      {
        name: 'Sacos de lixo',
        categories: [],
        keywords: ['saco lixo', 'saco de lixo'],
        exclude: [],
      },
      {
        name: 'Papel toalha e dispensers',
        categories: [],
        keywords: ['papel toalha', 'dispenser', 'papel hig'],
        exclude: [],
      },
    ],
  },
  {
    id: 'utilidades',
    name: 'Utilidades e bazar',
    note: 'Utensílios e itens para o dia a dia',
    icon: 'grid',
    groups: [
      {
        name: 'Utilidades domésticas',
        categories: ['utilidades'],
        keywords: [],
        exclude: ['vassoura', 'rodo', 'rastelo', 'saco lixo', 'esponja', 'pano', 'pa p/ lixo', 'cabo madeira', 'papel toalha', 'escova sanit'],
      },
      {
        name: 'Filme PVC e papel alumínio',
        categories: ['filme pvc/ papel aluminio'],
        keywords: [],
        exclude: [],
      },
      {
        name: 'Fogos e festas',
        categories: ['fogos'],
        keywords: ['vela', 'balao'],
        exclude: [],
      },
    ],
  },
  {
    id: 'pizzarias',
    name: 'Pizzarias',
    note: 'Massa, recheios, embalagens e bebidas',
    icon: 'pizza',
    groups: [
      {
        name: 'Massa: farinhas e fermentos',
        categories: ['dona benta'],
        keywords: ['far trigo', 'fermento', 'fermix', 'farinha rosca', 'semolina', 'fuba'],
        exclude: ['c/ferm', 'bolo'],
      },
      {
        name: 'Molhos e recheios',
        categories: [],
        keywords: ['molho tomate', 'molho de tomate', 'extrato', 'polpa tomate', 'azeitona', 'palmito', 'milho verde', 'ervilha', 'cogumelo', 'oregano', 'azeite', 'calabresa', 'mortadela', 'bacon', 'catupiry', 'requeijao', 'presunto', 'atum', 'sardinha'],
        exclude: ['chips', 'salg', 'pipoca', 'gulao', 'gulossauros', 'sache', 'farofa'],
      },
      {
        name: 'Embalagens de pizza',
        categories: [],
        keywords: ['pizza', 'disco pizza', 'sacola p/pizza'],
        exclude: ['far trigo', 'molho'],
      },
      {
        name: 'Sachês e molhos individuais',
        categories: [],
        keywords: ['sache'],
        exclude: ['canudo', 'garfo', 'faca', 'colher', 'sabao', 'amaciante', 'detergente', 'milho', 'ervilha'],
      },
      {
        name: 'Bebidas',
        categories: ['3.2-refrigerantes', '3.1-sucos', '3.4-agua mineral', '4.1-cervejas'],
        keywords: [],
        exclude: ['porta'],
      },
      {
        name: 'Descartáveis e proteção',
        categories: [],
        keywords: ['guardanapo', 'luva', 'touca', 'garfo', 'faca', 'papel aluminio'],
        exclude: ['porta guardanapo'],
      },
    ],
  },
  {
    id: 'hamburguerias',
    name: 'Hamburguerias e lanches',
    note: 'Molhos, embalagens e descartáveis',
    icon: 'fast-food',
    groups: [
      {
        name: 'Molhos e condimentos',
        categories: [],
        keywords: ['maionese', 'catchup', 'mostarda', 'barbecue', 'molho cheddar', 'molho especial', 'molho verde', 'molho alho', 'molho hot dog', 'molho barbecue'],
        exclude: ['sache', 'pote'],
      },
      {
        name: 'Sachês e molhos individuais',
        categories: [],
        keywords: ['sache'],
        exclude: ['canudo', 'garfo', 'faca', 'colher', 'sabao', 'amaciante', 'detergente', 'milho', 'ervilha'],
      },
      {
        name: 'Batata, bacon e acompanhamentos',
        categories: ['palha art fritas', 'banhas'],
        keywords: ['batata palha', 'bacon', 'salsicha', 'banha', 'torresmo', 'cheddar', 'milho verde', 'ervilha'],
        exclude: ['chips', 'gulao', 'gulossauros', 'pipoca', 'doce', 'farofa', 'sache'],
      },
      {
        name: 'Embalagens de lanche',
        categories: [],
        keywords: ['hambur', 'hot dog', 'papel p/hamburg', 'emb batata', 'embalagem batata', 'sacola p/hamburg', 'papel acoplado'],
        exclude: ['molho'],
      },
      {
        name: 'Sacolas de entrega',
        categories: [],
        keywords: ['deliv', 'kraft', 'sacola papel'],
        exclude: ['talher'],
      },
      {
        name: 'Bebidas',
        categories: ['3.2-refrigerantes', '3.1-sucos', '3.3-energeticos', '3.4-agua mineral', '4.1-cervejas'],
        keywords: [],
        exclude: ['porta'],
      },
      {
        name: 'Descartáveis e proteção',
        categories: [],
        keywords: ['guardanapo', 'canudo', 'copo desc', 'copo transp', 'luva', 'touca', 'garfo', 'faca'],
        exclude: ['porta', 'borracha', 'latex'],
      },
    ],
  },
  {
    id: 'sorveterias',
    name: 'Sorveterias e açaiterias',
    note: 'Bases, coberturas, copos e colheres',
    icon: 'ice-cream',
    groups: [
      {
        name: 'Bases e pós para sorvete',
        categories: [],
        keywords: ['po  p/sorvete', 'po p/sorvete', 'sorvete', 'acai', 'liga neutra', 'emulsificante', 'saborizante'],
        exclude: ['doce mole', 'banana fit', 'mariola', 'ref ', 'pazinha'],
      },
      {
        name: 'Coberturas e complementos',
        categories: [],
        keywords: ['cobertura', 'granulado', 'confeit', 'leite cond', 'leite condensado', 'pacoca', 'amendoim', 'choco creme', 'creme de avela', 'coco ralado', 'calda', 'sob.lactea', 'marshmallow', 'chocoball', 'choco bolinha', 'ovomaltine', 'gotas'],
        exclude: ['bala', 'mendoreto', 'dori 70g', 'pirulito'],
      },
      {
        name: 'Copos, potes e tampas',
        categories: [],
        keywords: ['copo ', 'pote', 'tampa copo', 'tampa bolha', 'tampa t', 'tampa pote'],
        exclude: ['doce', 'bala', 'choco', 'pacoca', 'extrato', 'americano', 'nadir', 'marmitex', 'emb kit', 'goma', 'confeito', 'cond ', 'soda', 'escova', 'sushi', 'p/ molho', 'frigideira', 'panela', 'canecao', 'caneca', 'leiteira', 'cuscuzeira', 'chaleira', 'caçarola', 'cacarola', 'forma de', 'isqueiro'],
      },
      {
        name: 'Colheres, canudos e guardanapos',
        categories: [],
        keywords: ['colher', 'canudo', 'guardanapo', 'mexedor', 'pazinha'],
        exclude: ['porta'],
      },
      {
        name: 'Bebidas',
        categories: ['3.2-refrigerantes', '3.1-sucos', '3.4-agua mineral'],
        keywords: [],
        exclude: [],
      },
    ],
  },
  {
    id: 'marmitarias',
    name: 'Marmitarias e restaurantes a quilo',
    note: 'Cozinha em volume e embalagens',
    icon: 'soup',
    groups: [
      {
        name: 'Insumos em volume',
        categories: ['1.1-food service', 'banhas'],
        keywords: ['oleo', 'azeite', 'vinagre', 'caldo', 'tempero', 'cond ', 'sal ', 'extrato', 'molho tomate', 'farofa', 'farinha', 'milho verde', 'ervilha', 'seleta'],
        exclude: ['sache', 'chips', 'pipoca', 'bala', 'sobremesa', 'bolinho', 'choco', 'cobertura', 'confeit', 'granulado', 'chantil', 'recheio', 'mistura p/ bolo', 'mistura bolo', 'creme de conf', 'corante', 'sob.lactea'],
      },
      {
        name: 'Marmitex e bandejas',
        categories: ['eps (isopor)/bandejas aluminio'],
        keywords: ['marmitex', 'bandeja', 'assadeira', 'pote termico', 'copo termico', 'tampa pote'],
        exclude: ['disco pizza', 'hambur', 'prato', 'frigideira', 'panela', 'canecao', 'caneca', 'leiteira', 'cuscuzeira', 'chaleira', 'caçarola', 'cacarola', 'forma de', 'isqueiro'],
      },
      {
        name: 'Filme e papel alumínio',
        categories: ['filme pvc/ papel aluminio'],
        keywords: [],
        exclude: [],
      },
      {
        name: 'Sachês e molhos individuais',
        categories: [],
        keywords: ['sache'],
        exclude: ['canudo', 'garfo', 'faca', 'colher', 'sabao', 'amaciante', 'detergente', 'milho', 'ervilha'],
      },
      {
        name: 'Talheres e descartáveis',
        categories: [],
        keywords: ['garfo', 'faca', 'colher', 'talher', 'guardanapo', 'copo desc', 'copo transp'],
        exclude: ['porta'],
      },
      {
        name: 'Sacolas',
        categories: [],
        keywords: ['sacola camis', 'sacola cam', 'sacola p/', 'deliv', 'kraft'],
        exclude: ['teste', 'hambur'],
      },
      {
        name: 'Bebidas',
        categories: ['3.2-refrigerantes', '3.1-sucos', '3.4-agua mineral'],
        keywords: [],
        exclude: [],
      },
      {
        name: 'Luvas, toucas e proteção',
        categories: [],
        keywords: ['luva', 'touca', 'mascara', 'avental'],
        exclude: [],
      },
    ],
  },
];
