CREATE TABLE `published_catalog_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`published_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `published_products` (
	`id` integer PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`department` text NOT NULL,
	`section` text NOT NULL,
	`category` text NOT NULL,
	`segment` text NOT NULL,
	`brand` text NOT NULL,
	`image` text NOT NULL,
	`specs` text DEFAULT '[]' NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_published_products_code` ON `published_products` (`code`);