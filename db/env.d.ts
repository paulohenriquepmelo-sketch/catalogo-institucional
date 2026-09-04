declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    ADMIN_EMAILS?: string;
    EDITOR_PASSWORD?: string;
    EDITOR_ADMIN_EMAIL?: string;
    EDITOR_ADMIN_NAME?: string;
    SITE_ORIGIN?: string;
  }
}
