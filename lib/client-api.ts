export async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(
    url,
    body === undefined
      ? { cache: 'no-store' }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok || data === null)
    throw new Error(
      data?.error ?? 'Não foi possível concluir. Tente novamente.',
    );
  return data as T;
}
