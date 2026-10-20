declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    ADMIN_EMAILS?: string;
    // 'true' only behind a proxy that sets oai-authenticated-* headers.
    TRUST_IDENTITY_HEADERS?: string;
    EDITOR_PASSWORD?: string;
    EDITOR_ADMIN_EMAIL?: string;
    EDITOR_ADMIN_NAME?: string;
    WORKER_ROLE?: 'editor' | 'public';
    SITE_ORIGIN?: string;
    // Cloudflare rate limiter for password attempts (editor Worker only).
    LOGIN_LIMITER?: RateLimit;
  }
}
