CREATE TABLE `managed_work_questions` (
	`work_id` text NOT NULL,
	`question_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`work_id`, `question_id`),
	FOREIGN KEY (`work_id`) REFERENCES `managed_works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `question_bank`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_managed_work_question_position` ON `managed_work_questions` (`work_id`,`position`);--> statement-breakpoint
CREATE TABLE `managed_works` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`level` text NOT NULL,
	`title` text NOT NULL,
	`lesson_title` text NOT NULL,
	`version` integer NOT NULL,
	`revision` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_managed_works_course_level` ON `managed_works` (`course_id`,`level`);--> statement-breakpoint
CREATE TABLE `question_bank` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`level` text NOT NULL,
	`prompt` text NOT NULL,
	`options` text NOT NULL,
	`correct` integer NOT NULL,
	`explanation` text NOT NULL,
	`revision` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_question_bank_course_level` ON `question_bank` (`course_id`,`level`);--> statement-breakpoint
ALTER TABLE `work_assignments` ADD `definition_snapshot` text;