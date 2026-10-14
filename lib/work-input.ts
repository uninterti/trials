import { WorkError } from "./work-error";

export const workCourses = { word: "Word", excel: "Excel", powerpoint: "PowerPoint" };
export const workLevels = { facil: "Fácil", intermediario: "Intermediário", dificil: "Difícil" };
export type CourseId = keyof typeof workCourses;
export type WorkLevel = keyof typeof workLevels;
export function courseId(value: unknown): CourseId {
  if (typeof value !== "string" || !Object.hasOwn(workCourses, value)) throw new WorkError("Selecione Word, Excel ou PowerPoint.");
  return value as CourseId;
}
export function level(value: unknown): WorkLevel {
  if (typeof value !== "string" || !Object.hasOwn(workLevels, value)) throw new WorkError("Selecione um nível válido.");
  return value as WorkLevel;
}
export function textValue(value: unknown, label: string, max: number, optional = false) {
  if (typeof value !== "string" || (!optional && !value.trim()) || value.trim().length > max) throw new WorkError(`${label}: preencha um texto de até ${max} caracteres.`);
  return value.trim();
}
export function questionInput(data: Record<string, unknown>) {
  if (!Array.isArray(data.options) || data.options.length !== 4) throw new WorkError("Informe exatamente quatro alternativas.");
  const options = data.options.map(v => textValue(v, "Alternativa", 500));
  if (new Set(options.map(v => v.toLocaleLowerCase('pt-BR'))).size !== 4) throw new WorkError("As quatro alternativas devem ser diferentes.");
  if (!Number.isInteger(data.correct) || Number(data.correct) < 0 || Number(data.correct) > 3) throw new WorkError("Marque uma alternativa correta.");
  return {
    courseId: courseId(data.courseId), level: level(data.level),
    prompt: textValue(data.prompt, "Pergunta", 2000), options,
    correct: Number(data.correct), explanation: textValue(data.explanation ?? "", "Explicação", 2000, true),
  };
}
export function workInput(data: Record<string, unknown>) {
  const id = textValue(data.id, "Código", 30).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,29}$/.test(id)) throw new WorkError("Use de 2 a 30 letras, números ou hífens no código do trabalho.");
  if (!Array.isArray(data.questionIds) || data.questionIds.length > 10 || !data.questionIds.every(v => typeof v === "string" && v.length > 0 && v.length <= 100)) throw new WorkError("Selecione até 10 questões válidas.");
  if (new Set(data.questionIds).size !== data.questionIds.length) throw new WorkError("Uma questão não pode aparecer duas vezes no trabalho.");
  return {
    id, courseId: courseId(data.courseId), level: level(data.level),
    title: textValue(data.title, "Título", 160),
    lessonTitle: textValue(data.lessonTitle ?? "", "Aula", 100, true),
    questionIds: data.questionIds as string[],
  };
}
