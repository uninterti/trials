let activeWorkAttempt = null;
let workSimulationDefinition = null;
let workSimulationEpoch = 0;
let selectedPerformanceStudent = '';
let performanceData = null;
let availableWorks = [];
let performanceStudents = [];
let workRequestEpoch = 0;
let studentWorksEpoch = 0;

async function workApi(path, method = 'GET', data) {
  const response = await fetch(path, {
    method, cache: 'no-store',
    ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir. Tente novamente.');
  return result;
}
const workDate = value => value ? new Date(value).toLocaleString('pt-BR') : '—';
const workGrade = value => value === null || value === undefined ? '—' : `${value}/10`;
const workStatus = item => item.active_attempt_id ? 'Em andamento' : item.attempt_count ? 'Concluído' : 'Não iniciado';

function resetWorkUI() {
  resetWorkManagement();
  clearWorkSimulation();
  workRequestEpoch++;
  studentWorksEpoch++;
  activeWorkAttempt = null;
  selectedPerformanceStudent = '';
  performanceData = null;
  availableWorks = [];
  performanceStudents = [];
  for (const id of ['studentWorks', 'performanceReport', 'workQuizQuestions', 'workQuizResult', 'releaseWorkFeedback']) $(`#${id}`).innerHTML = '';
  $('#performanceStudent').innerHTML = '<option value="">Selecione um aluno…</option>';
  $('#performanceCourse').value = '';
}

async function loadPerformanceArea() {
  const epoch = ++workRequestEpoch;
  $('#performanceReport').innerHTML = '<p class="empty-state">Carregando alunos…</p>';
  $('#releaseWorkButton').disabled = true;
  $('#releaseWorkFeedback').innerHTML = '';
  try {
    const [students, works] = await Promise.all([workApi('/api/students'), workApi('/api/assignments')]);
    if (epoch !== workRequestEpoch || currentUser?.role !== 'professor') return;
    performanceStudents = students.students;
    availableWorks = works.works;
    $('#performanceStudent').innerHTML = '<option value="">Selecione um aluno…</option>' + students.students.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} · ${escapeHtml(s.course_title || 'Sem curso')}</option>`).join('');
    $('#performanceStudent').value = selectedPerformanceStudent;
    selectedPerformanceStudent = $('#performanceStudent').value;
    $('#performanceCourse').innerHTML = '<option value="">Todos os cursos</option>' + courses.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)}</option>`).join('');
    if (!students.students.length) {
      updateReleaseOptions();
      $('#performanceReport').innerHTML = '<p class="empty-state">Nenhum aluno cadastrado. Cadastre um aluno no menu Alunos para liberar trabalhos.</p>';
      return;
    }
    await loadPerformanceReport();
  } catch (error) {
    if (epoch === workRequestEpoch) $('#performanceReport').innerHTML = errorMessage(error.message) + '<button class="secondary" data-page="performance">Tentar novamente</button>';
  }
}

function updateReleaseOptions() {
  const target = performanceStudents.find(s => s.id === selectedPerformanceStudent);
  const matching = availableWorks.filter(w => w.courseId === target?.course_id);
  const released = new Set((performanceData?.assignments || []).map(a => a.work_id));
  const unreleased = matching.filter(w => !released.has(w.id));
  $('#releaseWork').innerHTML = unreleased.length
    ? unreleased.map(w => `<option value="${escapeHtml(w.id)}">${escapeHtml(w.courseTitle)} · ${escapeHtml(w.lessonTitle)} · ${escapeHtml(w.id)} — ${w.questionCount} questões</option>`).join('')
    : `<option value="">${!target ? 'Selecione um aluno primeiro' : matching.length ? 'Todos os trabalhos disponíveis já foram liberados' : 'Ainda não há trabalho disponível para este curso'}</option>`;
  $('#releaseWork').disabled = !unreleased.length;
  $('#releaseWorkButton').disabled = !unreleased.length;
}

async function loadPerformanceReport() {
  const epoch = ++workRequestEpoch;
  performanceData = null;
  $('#releaseWorkButton').disabled = true;
  $('#releaseWork').disabled = true;
  if (!selectedPerformanceStudent) {
    updateReleaseOptions();
    $('#performanceReport').innerHTML = '<p class="empty-state">Selecione um aluno para visualizar seu desempenho.</p>';
    return;
  }
  $('#performanceReport').innerHTML = '<p class="empty-state">Carregando desempenho…</p>';
  try {
    const data = await workApi(`/api/students/performance?studentId=${encodeURIComponent(selectedPerformanceStudent)}`);
    if (epoch !== workRequestEpoch || currentUser?.role !== 'professor') return;
    performanceData = data;
    updateReleaseOptions();
    renderPerformanceReport();
  } catch (error) {
    if (epoch === workRequestEpoch) $('#performanceReport').innerHTML = errorMessage(error.message) + '<button class="secondary" id="retryPerformance">Tentar novamente</button>';
  }
}

function renderPerformanceReport() {
  if (!performanceData) return;
  const { student, assignments, history } = performanceData;
  const selectedCourse = $('#performanceCourse').value;
  const filtered = assignments.filter(a => !selectedCourse || a.work.courseId === selectedCourse);
  const completed = filtered.filter(a => a.latest_score !== null);
  const average = completed.length ? (completed.reduce((sum, a) => sum + a.latest_score, 0) / completed.length).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—';
  const courseIds = [...new Set(filtered.map(a => a.work.courseId))];
  $('#performanceReport').innerHTML = `<h2 class="section-title" style="margin-top:28px">${escapeHtml(student.name)}</h2>
    <p class="muted work-help">A nota atual é a última tentativa concluída. A melhor nota e todas as tentativas ficam no histórico. Trabalhos não realizados não entram na média.</p>
    <div class="work-summary"><div class="work-stat"><strong>${filtered.length}</strong><span>Trabalhos liberados</span></div><div class="work-stat"><strong>${completed.length}</strong><span>Trabalhos concluídos</span></div><div class="work-stat"><strong>${average}${completed.length ? '/10' : ''}</strong><span>Média das notas atuais</span></div></div>
    ${!filtered.length ? '<p class="empty-state">Nenhum trabalho liberado para este aluno no filtro selecionado.</p>' : courseIds.map(courseId => {
      const rows = filtered.filter(a => a.work.courseId === courseId);
      return `<div class="student-table-card work-card"><div class="table-header"><h3>${escapeHtml(rows[0].work.courseTitle)}</h3></div><div class="table-responsive"><table class="student-table"><caption class="sr-only">Notas de ${escapeHtml(student.name)} no curso ${escapeHtml(rows[0].work.courseTitle)}</caption><thead><tr><th>Curso</th><th>Aula</th><th>Trabalho</th><th>Aluno</th><th>Status</th><th>Nota atual</th><th>Melhor nota</th><th>Tentativas</th><th>Última entrega</th></tr></thead><tbody>${rows.map(a => `<tr><td>${escapeHtml(a.work.courseTitle)}</td><td>${escapeHtml(a.work.lessonTitle)}</td><td>${escapeHtml(a.work.id)}</td><td>${escapeHtml(student.name)}</td><td>${workStatus(a)}</td><td><strong>${workGrade(a.latest_score)}</strong></td><td>${workGrade(a.best_score)}</td><td>${a.attempt_count}</td><td>${workDate(a.latest_at)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }).join('')}
    ${filtered.map(a => {
      const attempts = history.filter(h => h.assignment_id === a.id);
      if (!attempts.length) return '';
      return `<details class="module-card work-history"><summary>${escapeHtml(a.work.courseTitle)} · ${escapeHtml(a.work.lessonTitle)} · ${escapeHtml(a.work.id)} — Histórico de tentativas</summary><div class="table-responsive"><table class="student-table"><thead><tr><th>Tentativa</th><th>Entregue em</th><th>Nota</th></tr></thead><tbody>${attempts.map((h, i) => `<tr><td>${attempts.length - i}</td><td>${workDate(h.submitted_at)}</td><td>${h.score}/${h.total}</td></tr>`).join('')}</tbody></table></div></details>`;
    }).join('')}`;
}

async function loadStudentWorks() {
  const epoch = ++studentWorksEpoch;
  $('#studentWorks').innerHTML = '<p class="empty-state">Carregando seus trabalhos…</p>';
  try {
    const data = await workApi('/api/assignments');
    if (epoch !== studentWorksEpoch || currentUser?.role !== 'aluno') return;
    $('#studentWorks').innerHTML = data.assignments.length ? data.assignments.map(a => `<article class="module-card work-card"><span class="pill">${escapeHtml(a.work.courseTitle)} · ${escapeHtml(a.work.lessonTitle)} · ${escapeHtml(a.work.id)}</span><h2>${escapeHtml(a.work.title)}</h2><p>${a.work.questionCount} questões objetivas · 1 ponto cada · Total: ${a.work.total} pontos</p><p><strong>${workStatus(a)}</strong> · Nota atual: ${workGrade(a.latest_score)} · Melhor nota: ${workGrade(a.best_score)} · ${a.attempt_count} tentativa(s) concluída(s)</p><div class="work-actions"><button class="primary" data-start-work="${escapeHtml(a.id)}">${a.active_attempt_id ? 'Continuar trabalho' : a.attempt_count ? 'Refazer com questões embaralhadas' : 'Iniciar trabalho'}</button>${a.latest_attempt_id ? `<button class="secondary" data-work-result="${escapeHtml(a.latest_attempt_id)}">Ver nota e gabarito</button>` : ''}</div></article>`).join('') : '<div class="module-card"><h2>Nenhum trabalho liberado ainda</h2><p class="muted">Quando o professor liberar um trabalho para você, ele aparecerá aqui.</p></div>';
  } catch (error) {
    if (epoch === studentWorksEpoch) $('#studentWorks').innerHTML = errorMessage(error.message) + '<button class="secondary" data-page="works">Tentar novamente</button>';
  }
}

async function openWork(button, review = false) {
  const userId = currentUser?.id;
  button.disabled = true;
  try {
    const attempt = review
      ? await workApi(`/api/assignments/attempts?id=${encodeURIComponent(button.dataset.workResult)}`)
      : await workApi('/api/assignments/attempts', 'POST', { assignmentId: button.dataset.startWork });
    if (currentUser?.id !== userId) return;
    activeWorkAttempt = attempt;
    renderWorkAttempt();
    show('workQuiz');
  } catch (error) {
    if (currentUser?.id === userId) {
      const host = button.closest('.work-card') || $('#workQuizResult');
      let feedback = host.querySelector('.work-open-error');
      if (!feedback) { feedback = document.createElement('div'); feedback.className = 'work-open-error'; host.append(feedback); }
      feedback.innerHTML = errorMessage(error.message);
    }
  } finally { button.disabled = false; }
}

function clearWorkSimulation() {
  workSimulationEpoch++;
  workSimulationDefinition = null;
  if (activeWorkAttempt?.simulation) {
    activeWorkAttempt = null;
    $('#workQuizQuestions').innerHTML = '';
    $('#workQuizResult').innerHTML = '';
    $('#workQuizFeedback').innerHTML = '';
  }
  $('#workSimulationNotice').classList.add('hidden');
}

async function openWorkSimulation(button, repeat = false) {
  if (currentUser?.role !== 'professor') return;
  const epoch = ++workSimulationEpoch;
  const userId = currentUser.id;
  const definition = repeat ? workSimulationDefinition : managementWorks.find(w => w.id === button.dataset.simulateWork);
  if (!definition || definition.questions.length !== 10) return;
  const snapshot = structuredClone(definition);
  const previousIds = repeat ? (activeWorkAttempt?.questions || []).map(q => q.id) : [];
  button.disabled = true;
  try {
    const { shuffledQuestions } = await import('/work-engine.js');
    if (epoch !== workSimulationEpoch || currentUser?.id !== userId) return;
    workSimulationDefinition = snapshot;
    const { questions, ...work } = snapshot;
    workSimulationDefinition.questions = shuffledQuestions(questions, previousIds);
    activeWorkAttempt = {
      id: `simulation-${crypto.randomUUID()}`, simulation: true,
      work: { ...work, questionCount: questions.length, total: questions.length },
      total: questions.length, score: null, submittedAt: null,
      questions: workSimulationDefinition.questions.map(({ id, prompt, options }) => ({ id, prompt, options })),
    };
    renderWorkAttempt();
    show('workQuiz');
  } catch (error) {
    if (epoch === workSimulationEpoch) {
      const host = repeat ? $('#workQuizResult') : $('#managementFeedback');
      const feedback = document.createElement('div');
      feedback.innerHTML = errorMessage('Não foi possível abrir o simulador. Tente novamente.');
      host.append(feedback);
    }
  } finally { button.disabled = false; }
}

async function simulatedResult(attempt, definition, answers) {
  const { gradeAnswers } = await import('/work-engine.js');
  const score = gradeAnswers(definition.questions, answers);
  if (score === null) throw new Error('Responda às 10 questões com uma alternativa válida em cada uma.');
  // In-memory result only: never call a persistence API or browser storage here.
  return {
    ...attempt, score, submittedAt: new Date().toISOString(),
    questions: definition.questions.map(q => ({ ...q, selected: answers[q.id] })),
  };
}

function renderWorkAttempt() {
  const a = activeWorkAttempt;
  const simulation = Boolean(a.simulation);
  $('#workSimulationNotice').classList.toggle('hidden', !simulation);
  $('#workQuizBack').dataset.page = simulation ? 'workManagement' : 'works';
  $('#workQuizBack').textContent = simulation ? '← Gestão de trabalhos' : '← Meus trabalhos';
  $('#submitWorkButton').disabled = false;
  $('#workQuizMeta').textContent = `${a.work.courseTitle} · ${a.work.lessonTitle} · ${a.work.id}`;
  $('#workQuizTitle').textContent = a.work.title;
  $('#workQuizDescription').textContent = a.submittedAt ? 'Confira sua nota e o gabarito comentado abaixo.' : (simulation ? 'Responda às 10 questões. Cada acerto vale 1 ponto. Esta simulação não salva respostas nem notas.' : 'Responda às 10 questões. Cada acerto vale 1 ponto. Suas respostas serão salvas ao entregar; sair ou atualizar antes disso descarta as marcações.');
  $('#workQuizFeedback').innerHTML = '';
  $('#workQuizForm').classList.toggle('hidden', Boolean(a.submittedAt));
  $('#workQuizResult').innerHTML = '';
  if (a.submittedAt) {
    $('#workQuizQuestions').innerHTML = '';
    $('#workQuizResult').innerHTML = `<div class="work-score"><span>Trabalho ${escapeHtml(a.work.id)} · ${escapeHtml(currentUser.name)}</span><strong>Nota ${a.score}/${a.total}</strong><p>${simulation ? 'Resultado da simulação · Não salvo.' : `Resultado salvo em ${workDate(a.submittedAt)}.`}</p></div><div class="work-actions"><button class="primary" ${simulation ? 'data-restart-simulation' : `data-start-work="${escapeHtml(a.assignmentId)}"`}>Refazer com questões embaralhadas</button><button class="secondary" data-page="${simulation ? 'workManagement' : 'works'}">${simulation ? 'Voltar à gestão' : 'Voltar aos trabalhos'}</button></div><h2 class="section-title" style="margin-top:28px">Gabarito comentado</h2>${a.questions.map((q, i) => `<article class="work-review ${q.selected === q.correct ? 'correct' : 'incorrect'}"><h3>${i + 1}. ${escapeHtml(q.prompt)}</h3><p><strong>${q.selected === q.correct ? 'Acertou · 1 ponto' : 'Errou · 0 ponto'}</strong></p><p>Sua resposta: ${escapeHtml(q.options[q.selected])}</p><p><strong>Resposta correta:</strong> ${escapeHtml(q.options[q.correct])}</p><p class="muted">${escapeHtml(q.explanation)}</p></article>`).join('')}`;
    return;
  }
  $('#workQuizQuestions').innerHTML = a.questions.map((q, i) => `<fieldset class="work-question"><legend>${i + 1}. ${escapeHtml(q.prompt)} <span class="muted">(1 ponto)</span></legend>${q.options.map((option, index) => `<label class="option"><input type="radio" name="${escapeHtml(q.id)}" value="${index}" required> ${escapeHtml(option)}</label>`).join('')}</fieldset>`).join('');
}

$('#performanceStudent').addEventListener('change', () => {
  selectedPerformanceStudent = $('#performanceStudent').value;
  $('#releaseWorkFeedback').innerHTML = '';
  loadPerformanceReport();
});
$('#performanceCourse').addEventListener('change', renderPerformanceReport);
$('#releaseWorkForm').addEventListener('submit', async event => {
  event.preventDefault();
  const studentId = selectedPerformanceStudent;
  const workId = $('#releaseWork').value;
  if (!studentId || !workId) return;
  const epoch = workRequestEpoch;
  $('#releaseWorkButton').disabled = true;
  $('#releaseWorkFeedback').innerHTML = '';
  try {
    await workApi('/api/assignments', 'POST', { studentId, workId });
    if (epoch !== workRequestEpoch || currentUser?.role !== 'professor') return;
    $('#releaseWorkFeedback').innerHTML = successMessage(`Trabalho ${workId} liberado. O aluno já pode acessá-lo em Meus trabalhos.`);
    await loadPerformanceReport();
  } catch (error) {
    if (epoch === workRequestEpoch) { $('#releaseWorkFeedback').innerHTML = errorMessage(error.message); updateReleaseOptions(); }
  }
});
$('#workQuizForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!activeWorkAttempt || activeWorkAttempt.submittedAt) return;
  const attemptId = activeWorkAttempt.id;
  const userId = currentUser?.id;
  const form = new FormData(event.target);
  const answers = Object.fromEntries(activeWorkAttempt.questions.map(q => [q.id, form.has(q.id) ? Number(form.get(q.id)) : null]));
  $('#submitWorkButton').disabled = true;
  $('#workQuizFeedback').innerHTML = '';
  try {
    const result = activeWorkAttempt.simulation
      ? await simulatedResult(activeWorkAttempt, workSimulationDefinition, answers)
      : await workApi('/api/assignments/attempts', 'PATCH', { attemptId, answers });
    if (currentUser?.id !== userId || activeWorkAttempt?.id !== attemptId) return;
    activeWorkAttempt = result;
    renderWorkAttempt();
    window.scrollTo(0, 0);
  } catch (error) {
    if (currentUser?.id === userId && activeWorkAttempt?.id === attemptId) $('#workQuizFeedback').innerHTML = errorMessage(error.message);
  } finally { $('#submitWorkButton').disabled = false; }
});
document.addEventListener('click', event => {
  const performanceButton = event.target.closest('[data-performance-student]');
  if (performanceButton) {
    selectedPerformanceStudent = performanceButton.dataset.performanceStudent;
    show('performance');
  }
  const simulation = event.target.closest('[data-simulate-work]');
  if (simulation) openWorkSimulation(simulation);
  const repeatSimulation = event.target.closest('[data-restart-simulation]');
  if (repeatSimulation) openWorkSimulation(repeatSimulation, true);
  const start = event.target.closest('[data-start-work]');
  if (start) openWork(start);
  const review = event.target.closest('[data-work-result]');
  if (review) openWork(review, true);
  if (event.target.closest('#retryPerformance')) loadPerformanceReport();
});
