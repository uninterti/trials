// Local-only integration: creates temporary students and deletes them in finally.
// Start the app and apply migrations first; node tests/works.integration.mjs
import assert from 'node:assert/strict';
import { workDefinitions } from '../lib/work-bank.ts';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Integration tests must only run locally');
let checks = 0;
async function request(path, { cookie, method = 'GET', body, status = 200 } = {}) {
  const res = await fetch(base + path, { method, headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await res.json();
  assert.equal(res.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  checks++;
  return { data, cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
const login = async (login, password) => (await request('/api/auth/login', { method: 'POST', body: { login, password } })).cookie;
const prof = await login('professor', 'admin');
const created = [];
try {
  for (const [index, courseId] of ['word', 'word', 'excel'].entries()) {
    const { data } = await request('/api/students', { cookie: prof, method: 'POST', body: { name: `Teste trabalhos ${index}`, phone: `qa-${Date.now()}-${index}`, courseId } });
    created.push(data.student);
  }
  const [student, other, excel] = created;
  const cookie = await login(student.phone, student.initialPassword);
  const otherCookie = await login(other.phone, other.initialPassword);
  await request('/api/assignments', { status: 401 });
  await request('/api/assignments', { cookie, method: 'POST', body: { studentId: student.id, workId: 'W-A1' }, status: 403 });
  await request(`/api/students/performance?studentId=${student.id}`, { cookie, status: 403 });
  await request('/api/assignments', { cookie: prof, method: 'POST', body: { studentId: excel.id, workId: 'W-A1' }, status: 400 });
  await request('/api/assignments', { cookie: prof, method: 'POST', body: { studentId: student.id, workId: 'W-A2' }, status: 404 });
  assert.equal((await request('/api/assignments', { cookie })).data.assignments.length, 0);
  const release = { cookie: prof, method: 'POST', body: { studentId: student.id, workId: 'W-A1' } };
  const releases = await Promise.all([request('/api/assignments', release), request('/api/assignments', release)]);
  const assignmentId = releases[0].data.assignments[0].id;
  assert.equal(releases[1].data.assignments.length, 1);
  assert.equal(releases[1].data.assignments[0].id, assignmentId);
  assert.equal((await request(`/api/assignments?studentId=${student.id}`, { cookie: otherCookie })).data.assignments.length, 0);
  await request('/api/assignments/attempts', { cookie: otherCookie, method: 'POST', body: { assignmentId }, status: 404 });
  const starts = await Promise.all([0, 1].map(() => request('/api/assignments/attempts', { cookie, method: 'POST', body: { assignmentId } })));
  const first = starts[0].data;
  assert.equal(starts[1].data.id, first.id);
  assert.equal(first.questions.length, 10);
  assert.ok(first.questions.every(q => !('correct' in q) && !('explanation' in q)));
  await request(`/api/assignments/attempts?id=${first.id}`, { cookie: otherCookie, status: 404 });
  await request('/api/assignments/attempts', { cookie: otherCookie, method: 'PATCH', body: { attemptId: first.id, answers: {} }, status: 404 });
  await request('/api/assignments/attempts', { cookie, method: 'PATCH', body: { attemptId: first.id, answers: {} }, status: 400 });
  const answers = Object.fromEntries(workDefinitions[0].questions.map(q => [q.id, q.correct]));
  const grades = await Promise.all([0, 1].map(() => request('/api/assignments/attempts', { cookie, method: 'PATCH', body: { attemptId: first.id, answers, score: 0 } })));
  assert.equal(grades[0].data.score, 10);
  assert.equal(grades[1].data.score, 10);
  assert.ok(grades[0].data.questions.every(q => q.correct === q.selected && q.explanation));
  const reviewed = (await request(`/api/assignments/attempts?id=${first.id}`, { cookie })).data;
  assert.equal(reviewed.score, 10);
  const wrong = Object.fromEntries(workDefinitions[0].questions.map(q => [q.id, (q.correct + 1) % 4]));
  assert.equal((await request('/api/assignments/attempts', { cookie, method: 'PATCH', body: { attemptId: first.id, answers: wrong } })).data.score, 10);
  const second = (await request('/api/assignments/attempts', { cookie, method: 'POST', body: { assignmentId } })).data;
  assert.notEqual(second.id, first.id);
  assert.notDeepEqual(second.questions.map(q => q.id), first.questions.map(q => q.id));
  assert.equal((await request('/api/assignments/attempts', { cookie, method: 'PATCH', body: { attemptId: second.id, answers: wrong, score: 10 } })).data.score, 0);
  const report = (await request(`/api/students/performance?studentId=${student.id}`, { cookie: prof })).data;
  assert.equal(report.assignments[0].attempt_count, 2);
  assert.equal(report.assignments[0].latest_score, 0);
  assert.equal(report.assignments[0].best_score, 10);
  assert.equal(report.assignments[0].work.courseTitle, 'Word');
  assert.equal(report.assignments[0].work.lessonTitle, 'Aula 1');
  assert.equal(report.history.length, 2);
  const loggedInAgain = await login(student.phone, student.initialPassword);
  assert.equal((await request('/api/assignments', { cookie: loggedInAgain })).data.assignments[0].latest_score, 0);
  await request(`/api/students?id=${student.id}`, { cookie: prof, method: 'DELETE' });
  await request('/api/assignments', { cookie, status: 401 });
  console.log(`PASS: ${checks} HTTP checks; release, isolation, grading, idempotency, shuffle, history and persistence.`);
} finally {
  for (const student of created) await request(`/api/students?id=${student.id}`, { cookie: prof, method: 'DELETE' });
}
