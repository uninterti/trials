CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`initial_password` text,
	`course_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);
--> statement-breakpoint
CREATE INDEX `idx_users_phone` ON `users` (`phone`);
--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);
