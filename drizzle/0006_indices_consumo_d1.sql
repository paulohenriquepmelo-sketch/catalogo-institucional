-- Índices para verificar marcas/categorias removidas sem varrer os produtos
-- (salvar a configuração lia ~350 mil linhas no D1; agora lê poucas linhas).
CREATE INDEX IF NOT EXISTS `idx_products_brand` ON `products` (`brand`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_products_taxonomy` ON `products` (`department`,`section`,`category`);--> statement-breakpoint
-- Índices que já existem no banco de produção (criados pela migração
-- 0005_fluffy_overlord, que não estava no repositório): registrados aqui para
-- o repositório refletir o banco. IF NOT EXISTS: não fazem nada onde já existem.
CREATE INDEX IF NOT EXISTS `idx_products_listing` ON `products` (`featured`,`name`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_products_published_id` ON `products` (`published`,`id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_published_products_listing` ON `published_products` (`featured`,`name`);
