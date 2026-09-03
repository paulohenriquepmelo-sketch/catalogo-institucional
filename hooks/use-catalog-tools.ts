'use client';
import { useEffect, useRef } from 'react';
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function useCatalogTools(tools: Tool[]) {
  const latest = useRef(tools);
  latest.current = tools;
  useEffect(() => {
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    for (const tool of latest.current) {
      try {
        void Promise.resolve(
          context.registerTool(
            {
              ...tool,
              execute: (input) =>
                latest.current
                  .find((t) => t.name === tool.name)!
                  .execute(input),
            },
            { signal: controller.signal },
          ),
        ).catch(() => {});
      } catch {
        /* Optional browser capability. */
      }
    }
    return () => controller.abort();
  }, []);
}
