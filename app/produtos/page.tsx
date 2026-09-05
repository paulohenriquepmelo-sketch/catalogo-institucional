import { CatalogApp } from '@/components/catalog-app';
import { env } from 'cloudflare:workers';
import { getEditorUser } from '@/lib/editor-access';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?:
    | { version?: string | string[] }
    | Promise<{ version?: string | string[] }>;
}) {
  const isEditorWorker = env.WORKER_ROLE !== 'public';
  const params = (await searchParams) ?? {};
  const requestedVersion = Array.isArray(params.version)
    ? params.version[0]
    : params.version;
  const editorPreview =
    isEditorWorker &&
    requestedVersion !== 'published' &&
    Boolean(await getEditorUser());

  return (
    <CatalogApp
      showEditorLink={isEditorWorker}
      editorPreview={editorPreview}
      fullCatalogPage
    />
  );
}

