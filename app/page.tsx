import { CatalogApp } from '@/components/catalog-app';
import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';

export default function Home() {
  return <CatalogApp showEditorLink={env.WORKER_ROLE !== 'public'} />;
}
