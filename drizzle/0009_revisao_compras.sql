-- Revisão do catálogo pelo compras: chaves de acesso (só o hash SHA-256 da
-- chave de 64 caracteres) e envios dos compradores. IF NOT EXISTS: o editor
-- também cria as tabelas no primeiro uso, porque o deploy não aplica
-- migrations sozinho.
CREATE TABLE IF NOT EXISTS `review_links` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL UNIQUE,
	`label` text NOT NULL,
	`filter` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `review_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`buyer` text NOT NULL,
	`note` text NOT NULL DEFAULT '',
	`items` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text NOT NULL DEFAULT 'pendente',
	`decided_at` text,
	`approved` text NOT NULL DEFAULT '[]'
);
