/**
 * Shared quiz rules. This module contains no question bank, network calls or storage.
 * @template {{ id: string }} T
 * @param {T[]} questions
 * @param {string[]} [previousIds]
 * @returns {T[]}
 */
export function shuffledQuestions(questions, previousIds = []) {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (shuffled.length > 1 && shuffled.every((q, i) => q.id === previousIds[i])) {
    shuffled.push(shuffled.shift());
  }
  return shuffled;
}

/**
 * @param {{ id: string, options: string[], correct: number }[]} questions
 * @param {unknown} answers
 * @returns {number | null}
 */
export function gradeAnswers(questions, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const values = /** @type {Record<string, unknown>} */ (answers);
  if (Object.keys(values).length !== questions.length) return null;
  if (!questions.every(q => Object.hasOwn(values, q.id) && Number.isInteger(values[q.id]) && Number(values[q.id]) >= 0 && Number(values[q.id]) < q.options.length)) return null;
  return questions.reduce((score, q) => score + Number(values[q.id] === q.correct), 0);
}
