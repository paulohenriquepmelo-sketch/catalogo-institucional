-- Autenticador (TOTP) do editor, uma linha só (id=1). recovery guarda só os
-- hashes SHA-256 dos códigos de recuperação. IF NOT EXISTS: o editor também
-- cria a tabela ao ativar, porque o deploy não aplica migrations sozinho.
CREATE TABLE IF NOT EXISTS `editor_totp` (
	`id` integer PRIMARY KEY NOT NULL,
	`secret` text,
	`pending_secret` text,
	`pending_at` text,
	`enabled_at` text,
	`last_step` integer NOT NULL DEFAULT 0,
	`recovery` text NOT NULL DEFAULT '[]'
);
