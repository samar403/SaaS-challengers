CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`station` text NOT NULL,
	`status` text NOT NULL,
	`health` real NOT NULL,
	`run_hours` real NOT NULL,
	`mtbf_hours` real NOT NULL,
	`hours_since_service` real NOT NULL,
	`vibration` real NOT NULL,
	`temperature` real NOT NULL,
	`oee` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_code_unique` ON `assets` (`code`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`region` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`doc_type` text NOT NULL,
	`engine` text NOT NULL,
	`extracted` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`actor` text NOT NULL,
	`kind` text NOT NULL,
	`entity` text NOT NULL,
	`summary` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_at_idx` ON `events` (`at`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`uom` text DEFAULT 'EA' NOT NULL,
	`on_hand` real DEFAULT 0 NOT NULL,
	`allocated` real DEFAULT 0 NOT NULL,
	`reorder_point` real DEFAULT 0 NOT NULL,
	`reorder_qty` real DEFAULT 0 NOT NULL,
	`daily_usage` real DEFAULT 0 NOT NULL,
	`unit_cost` real DEFAULT 0 NOT NULL,
	`location` text DEFAULT 'WH-A' NOT NULL,
	`supplier_id` integer,
	`legacy_ref` text,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `items_sku_unique` ON `items` (`sku`);--> statement-breakpoint
CREATE INDEX `items_supplier_idx` ON `items` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `po_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`po_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`qty` real NOT NULL,
	`unit_cost` real NOT NULL,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agent` text NOT NULL,
	`title` text NOT NULL,
	`rationale` text NOT NULL,
	`impact` text NOT NULL,
	`confidence` real NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`decided_at` integer,
	`decided_by` text
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`supplier_id` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`expected_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_number_unique` ON `purchase_orders` (`number`);--> statement-breakpoint
CREATE TABLE `sales_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`customer_id` integer NOT NULL,
	`status` text NOT NULL,
	`priority` integer DEFAULT 2 NOT NULL,
	`created_at` integer NOT NULL,
	`due_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_orders_number_unique` ON `sales_orders` (`number`);--> statement-breakpoint
CREATE TABLE `so_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`so_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`qty` real NOT NULL,
	`unit_price` real NOT NULL,
	FOREIGN KEY (`so_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`email` text NOT NULL,
	`lead_time_days` integer NOT NULL,
	`on_time_rate` real NOT NULL,
	`quality_rate` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_code_unique` ON `suppliers` (`code`);--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`item_id` integer NOT NULL,
	`sales_order_id` integer,
	`qty` real NOT NULL,
	`station` text NOT NULL,
	`status` text NOT NULL,
	`priority` integer DEFAULT 2 NOT NULL,
	`hours_remaining` real NOT NULL,
	`due_at` integer NOT NULL,
	`blocked_reason` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_orders_number_unique` ON `work_orders` (`number`);