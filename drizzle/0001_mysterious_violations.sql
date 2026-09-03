CREATE TABLE `catalog_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
