import { env } from "cloudflare:workers";
import initial from "./initial-content.json";
import lessonOne from "./lesson-one.json";

export function database() {
  if (!env.DB) throw new Error("Banco de dados indisponível");
  return env.DB;
}

export async function seedInitialContent() {
  const db = database();
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
