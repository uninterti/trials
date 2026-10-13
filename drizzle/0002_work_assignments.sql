-- users existed before the Drizzle snapshot; preserve deployed rows and reconcile its indexes.
CREATE TABLE IF NOT EXISTS `users` (
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
CREATE UNIQUE INDEX IF NOT EXISTS `users_phone_unique` ON `users` (`phone`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_users_phone` ON `users` (`phone`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE TABLE `work_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`student_id` text NOT NULL,
	`released_by` text,
	`released_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`released_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_work_student` ON `work_assignments` (`work_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `work_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`work_version` integer NOT NULL,
	`questions` text NOT NULL,
	`answers` text,
	`score` integer,
	`total` integer NOT NULL,
	`started_at` text NOT NULL,
	`submitted_at` text,
	FOREIGN KEY (`assignment_id`) REFERENCES `work_assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_work_attempts_assignment` ON `work_attempts` (`assignment_id`,`submitted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_work_active_attempt` ON `work_attempts` (`assignment_id`) WHERE "work_attempts"."submitted_at" IS NULL;