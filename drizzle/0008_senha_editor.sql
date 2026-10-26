-- Senha do editor trocada pelo próprio editor (hash PBKDF2-SHA256, uma linha
-- só, id=1). IF NOT EXISTS: o editor também cria a tabela ao trocar a senha,
-- porque o deploy não aplica migrations sozinho.
CREATE TABLE IF NOT EXISTS `editor_credentials` (
	`id` integer PRIMARY KEY NOT NULL,
	`algorithm` text NOT NULL,
	`iterations` integer NOT NULL,
	`salt` text NOT NULL,
	`hash` text NOT NULL,
	`updated_at` text NOT NULL
);
