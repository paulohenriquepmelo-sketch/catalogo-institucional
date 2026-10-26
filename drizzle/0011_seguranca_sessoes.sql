-- Geração das sessões do editor ("Encerrar as outras sessões") e limite geral
-- de códigos errados do autenticador. IF NOT EXISTS: o editor também cria as
-- tabelas no primeiro uso, porque o deploy não aplica migrations sozinho.
CREATE TABLE IF NOT EXISTS `editor_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `auth_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`window_start` text NOT NULL,
	`locked_until` text
);
