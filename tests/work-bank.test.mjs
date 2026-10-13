import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeAnswers, shuffledQuestions, workDefinitions } from '../lib/work-bank.ts';

const questions = workDefinitions[0].questions;
test('W-A1 has ten distinct questions and a valid answer for each', () => {
  assert.equal(questions.length, 10);
  assert.equal(new Set(questions.map(q => q.id)).size, 10);
  for (const question of questions) {
    assert.ok(question.options[question.correct]);
    assert.ok(question.explanation);
  }
});
test('grades by question ID, independently of display or answer order', () => {
  const answers = Object.fromEntries([...questions].reverse().map(q => [q.id, q.correct]));
  assert.equal(gradeAnswers([...questions].reverse(), answers), 10);
  answers[questions[0].id] = (questions[0].correct + 1) % 4;
  assert.equal(gradeAnswers(questions, answers), 9);
  assert.equal(gradeAnswers(questions, Object.fromEntries(questions.map(q => [q.id, (q.correct + 1) % 4]))), 0);
});
test('rejects missing, extra, out-of-range, string, null and fractional answers', () => {
  const good = Object.fromEntries(questions.map(q => [q.id, q.correct]));
  for (const value of [undefined, null, [], {}, { ...good, extra: 0 }, { ...good, [questions[0].id]: undefined }, { ...good, [questions[0].id]: '0' }, { ...good, [questions[0].id]: null }, { ...good, [questions[0].id]: -1 }, { ...good, [questions[0].id]: 4 }, { ...good, [questions[0].id]: 1.5 }]) {
    assert.equal(gradeAnswers(questions, value), null);
  }
});
test('retakes preserve question IDs and always change order, including identity shuffle', () => {
  const original = Math.random;
  try {
    Math.random = () => 0.99999;
    const before = questions.map(q => q.id);
    const after = shuffledQuestions(questions, before).map(q => q.id);
    assert.notDeepEqual(after, before);
    assert.deepEqual([...after].sort(), [...before].sort());
    assert.deepEqual(questions.map(q => q.id), before);
  } finally { Math.random = original; }
});
