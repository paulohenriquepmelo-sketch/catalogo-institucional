-- Correções dos dados do ERP (abreviações, hierarquia por código). Uma linha
-- só (id=1). IF NOT EXISTS: o editor também cria a tabela na primeira leitura,
-- porque o deploy não aplica migrations sozinho.
CREATE TABLE IF NOT EXISTS `erp_fixes` (
	`id` integer PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
