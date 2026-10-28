/* oxlint-disable next/no-img-element, next/no-html-link-for-pages -- Logo da empresa e links simples, como no restante do site público. */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicCatalog } from '@/lib/catalog-repository';
import { PRIVACY_PATH, privacyPolicyReady } from '@/lib/privacy-policy';
import { CATALOG_NOTICE } from '@/lib/catalog-notices';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  alternates: { canonical: PRIVACY_PATH },
};

// Texto conferido com o funcionamento real do site (out/2026): catálogo sem
// cadastro, sem cookies e sem ferramentas de análise; logs da hospedagem
// (Cloudflare Workers Logs) guardados por até 7 dias. Só vai ao ar com os
// dados da empresa preenchidos no editor.
export default async function PrivacyPolicyPage() {
  const { config } = await getPublicCatalog();
  if (!privacyPolicyReady(config)) notFound();
  const company = config.legalName!;
  return (
    <main className="public-catalog site-v2 privacy-page">
      <div className="privacy-header">
        <div className="v2-container privacy-header-inner">
          <a href="/" aria-label={`${config.name} — início`} className="privacy-logo">
            <img src={config.logo || '/distribuidora-laurencini-logo.jpeg'} alt={config.name} />
          </a>
          <a href="/" className="privacy-back">
            Voltar ao catálogo
          </a>
        </div>
      </div>
      <article className="v2-container privacy-body">
        <h1>Política de Privacidade</h1>
        <p className="privacy-lead">
          Este site é o catálogo digital da {config.name}. Ele não vende online,
          não tem cadastro de visitantes e não usa cookies de rastreamento,
          análise de audiência ou publicidade. Abaixo explicamos o pouco que é
          tratado e por quê.
        </p>

        <h2>Quem é o responsável</h2>
        <p>
          {company}, CNPJ {config.cnpj}, {config.address}. Para assuntos de
          dados pessoais, escreva para{' '}
          <a href={`mailto:${config.privacyEmail}`}>{config.privacyEmail}</a>.
        </p>

        <h2>Que dados são tratados e para quê</h2>
        <ul>
          <li>
            <strong>Registros técnicos de acesso.</strong> Ao abrir o site, o
            provedor de hospedagem (Cloudflare) registra dados técnicos da
            requisição, como endereço IP, data e hora, página acessada e
            informações do navegador. Usamos esses registros só para manter o
            site seguro e funcionando. Ficam guardados por até 7 dias.
          </li>
          <li>
            <strong>Contato pelo WhatsApp ou por e-mail.</strong> Quando você
            clica para falar com a equipe ou informa a sua cidade para achar o
            representante comercial, abrimos o WhatsApp ou o seu e-mail com a
            mensagem pronta. A cidade não fica guardada no site. A mensagem que
            você enviar, com o seu nome e telefone ou e-mail, é usada para o
            atendimento comercial e guardada pelo tempo necessário a esse
            atendimento e às obrigações legais.
          </li>
          <li>
            <strong>Preferência no seu navegador.</strong> Durante a visita, o
            site guarda no próprio navegador se o aviso de encartes já foi
            visto, para não mostrá-lo de novo. Isso não identifica você e some
            ao fechar o navegador.
          </li>
        </ul>

        <h2>Bases legais</h2>
        <p>
          Os registros técnicos são tratados pelo legítimo interesse em manter
          o site seguro (LGPD, art. 7º, IX). O contato comercial é tratado para
          atender o seu pedido e preparar negócios com você (art. 7º, V) e
          pelo legítimo interesse no atendimento (art. 7º, IX).
        </p>

        <h2>Com quem compartilhamos</h2>
        <p>
          Com o provedor de hospedagem do site (Cloudflare) e, quando você
          escolhe falar conosco, com o WhatsApp (Meta) ou com o seu provedor de
          e-mail. Cada um segue a própria política de privacidade. Não vendemos
          nem cedemos dados pessoais.
        </p>

        <h2>Seus direitos</h2>
        <p>
          Você pode pedir a confirmação de que tratamos seus dados, acesso,
          correção, exclusão e informações sobre o compartilhamento (LGPD, art.
          18), pelo e-mail{' '}
          <a href={`mailto:${config.privacyEmail}`}>{config.privacyEmail}</a>.
        </p>

        <h2>Sobre este catálogo</h2>
        <p>{CATALOG_NOTICE}</p>
      </article>
      <div className="privacy-footer">
        <div className="v2-container">
          © {new Date().getFullYear()} {company} · CNPJ {config.cnpj}
        </div>
      </div>
    </main>
  );
}
