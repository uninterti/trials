import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
  icon: text("icon").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const lessons = sqliteTable("lessons", {
  id: text("id").primaryKey(),
  courseId: text("course_id").notNull().references(() => courses.id),
  title: text("title").notNull(),
  goal: text("goal").notNull(),
  blocks: text("blocks").notNull(),
  task: text("task").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  sortOrder: integer("sort_order").notNull(),
}, (table) => [index("idx_lessons_course_order").on(table.courseId, table.sortOrder)]);

export const lessonContent = sqliteTable("lesson_content", {
  lessonId: text("lesson_id").primaryKey().references(() => lessons.id),
  content: text("content").notNull(),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  courseId: text("course_id").notNull().references(() => courses.id),
  prompt: text("prompt").notNull(),
  options: text("options").notNull(),
  correctOption: integer("correct_option").notNull(),
  sortOrder: integer("sort_order").notNull(),
}, (table) => [index("idx_questions_course_order").on(table.courseId, table.sortOrder)]);

export const attempts = sqliteTable("assessment_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  courseId: text("course_id").notNull().references(() => courses.id),
  score: integer("score").notNull(),
  total: integer("total").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_attempts_user_course").on(table.userId, table.courseId)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  role: text("role").notNull(), // 'professor' | 'aluno'
  passwordHash: text("password_hash").notNull(),
  initialPassword: text("initial_password"),
  courseId: text("course_id").references(() => courses.id),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_users_phone").on(table.phone),
  index("idx_users_role").on(table.role),
]);

export const workAssignments = sqliteTable("work_assignments", {
  id: text("id").primaryKey(),
  workId: text("work_id").notNull(),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  releasedBy: text("released_by").references(() => users.id, { onDelete: "set null" }),
  releasedAt: text("released_at").notNull(),
}, (table) => [uniqueIndex("idx_work_student").on(table.workId, table.studentId)]);

export const workAttempts = sqliteTable("work_attempts", {
  id: text("id").primaryKey(),
  assignmentId: text("assignment_id").notNull().references(() => workAssignments.id, { onDelete: "cascade" }),
  workVersion: integer("work_version").notNull(),
  questions: text("questions").notNull(),
  answers: text("answers"),
  score: integer("score"),
  total: integer("total").notNull(),
  startedAt: text("started_at").notNull(),
  submittedAt: text("submitted_at"),
}, (table) => [
  index("idx_work_attempts_assignment").on(table.assignmentId, table.submittedAt),
  uniqueIndex("idx_work_active_attempt").on(table.assignmentId).where(sql`${table.submittedAt} IS NULL`),
]);
