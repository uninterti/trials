import { env } from "cloudflare:workers";
import initial from "./initial-content.json";
import lessonOne from "./lesson-one.json";
import { hashPassword } from "@/lib/auth";

export function database() {
  if (!env.DB) throw new Error("Banco de dados indisponível");
  return env.DB;
}

export async function ensureTablesExist() {
  const db = database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS courses (
      id text PRIMARY KEY NOT NULL,
      title text NOT NULL,
      description text NOT NULL,
      status text NOT NULL,
      icon text NOT NULL,
      sort_order integer NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS lessons (
      id text PRIMARY KEY NOT NULL,
      course_id text NOT NULL,
      title text NOT NULL,
      goal text NOT NULL,
      blocks text NOT NULL,
      task text NOT NULL,
      duration_minutes integer NOT NULL,
      sort_order integer NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON UPDATE no action ON DELETE no action
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_lessons_course_order ON lessons (course_id, sort_order)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS questions (
      id text PRIMARY KEY NOT NULL,
      course_id text NOT NULL,
      prompt text NOT NULL,
      options text NOT NULL,
      correct_option integer NOT NULL,
      sort_order integer NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON UPDATE no action ON DELETE no action
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_questions_course_order ON questions (course_id, sort_order)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS assessment_attempts (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id text NOT NULL,
      course_id text NOT NULL,
      score integer NOT NULL,
      total integer NOT NULL,
      created_at text NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON UPDATE no action ON DELETE no action
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_attempts_user_course ON assessment_attempts (user_id, course_id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS lesson_content (
      lesson_id text PRIMARY KEY NOT NULL,
      content text NOT NULL,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON UPDATE no action ON DELETE no action
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      phone text NOT NULL UNIQUE,
      role text NOT NULL,
      password_hash text NOT NULL,
      initial_password text,
      course_id text,
      created_at text NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON UPDATE no action ON DELETE no action
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_role ON users (role)`),
  ]);
}

export async function seedInitialContent() {
  await ensureTablesExist();
  const db = database();

  // Seed or update master user toniagne
  const masterHash = await hashPassword("toni28CM##");
  const existingMaster = await db.prepare("SELECT id FROM users WHERE phone = 'toniagne'").first();
  if (!existingMaster) {
    await db.prepare(
      "INSERT INTO users (id, name, phone, role, password_hash, initial_password, course_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      "user-master-toniagne",
      "Toni Agne",
      "toniagne",
      "professor",
      masterHash,
      "toni28CM##",
      null,
      new Date().toISOString()
    ).run();
  } else {
    // Ensure the password hash is updated if needed
    await db.prepare(
      "UPDATE users SET password_hash = ?, initial_password = ?, role = 'professor' WHERE phone = 'toniagne'"
    ).bind(masterHash, "toni28CM##").run();
  }

  // Also seed default professor fallback if needed
  const existingProf = await db.prepare("SELECT id FROM users WHERE phone = 'professor'").first();
  if (!existingProf) {
    const profHash = await hashPassword("admin");
    await db.prepare(
      "INSERT OR IGNORE INTO users (id, name, phone, role, password_hash, initial_password, course_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      "prof-1",
      "Professor Toni",
      "professor",
      "professor",
      profHash,
      "admin",
      null,
      new Date().toISOString()
    ).run();
  }

  const current = await db.prepare("SELECT id FROM courses WHERE id = ?").bind("word").first();
  if (current) return;

  const courses = [
    ["office", "Office", "Visão geral das ferramentas de produtividade.", "planned", "O", 0],
    ["word", "Word", "Crie documentos, trabalhe na nuvem e use IA para melhorar sua escrita.", "available", "W", 1],
    ["excel", "Excel", "Espaço reservado para aulas de planilhas, fórmulas e análise de dados.", "planned", "X", 2],
    ["powerpoint", "PowerPoint", "Espaço reservado para criação e apresentação de slides.", "planned", "P", 3],
  ];
  const statements = courses.map((row) => db.prepare("INSERT OR IGNORE INTO courses (id,title,description,status,icon,sort_order) VALUES (?,?,?,?,?,?)").bind(...row));
  initial.lessons.forEach((lesson, i) => statements.push(db.prepare("INSERT OR IGNORE INTO lessons (id,course_id,title,goal,blocks,task,duration_minutes,sort_order) VALUES (?,?,?,?,?,?,?,?)").bind(`word-${i + 1}`, "word", lesson.title, lesson.goal, JSON.stringify(lesson.blocks), lesson.task, 60, i + 1)));
  initial.questions.forEach((question, i) => statements.push(db.prepare("INSERT OR IGNORE INTO questions (id,course_id,prompt,options,correct_option,sort_order) VALUES (?,?,?,?,?,?)").bind(`word-q${i + 1}`, "word", question.q, JSON.stringify(question.options), question.correct, i + 1)));
  await db.batch(statements);
}

export async function seedLessonOneContent() {
  await seedInitialContent();
  const db = database();
  await db.prepare("INSERT OR IGNORE INTO lesson_content (lesson_id,content) VALUES (?,?)")
    .bind("word-1", JSON.stringify(lessonOne)).run();
}

