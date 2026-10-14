const managementCourses = { word: 'Word', excel: 'Excel', powerpoint: 'PowerPoint' };
const managementLevels = { facil: 'Fácil', intermediario: 'Intermediário', dificil: 'Difícil' };
let managementWorks = [];
let managementQuestions = [];
let managementEpoch = 0;
let managementTab = 'works';
let editedWork = null;
let editedQuestion = null;
let selectedBankQuestions = new Set();
let managementLoaded = false;
const levelBadge = level => `<span class="pill level-${escapeHtml(level)}">${escapeHtml(managementLevels[level] || level)}</span>`;

function resetWorkManagement() {
  managementEpoch++;
  managementWorks = []; managementQuestions = []; managementLoaded = false;
  editedWork = null; editedQuestion = null; selectedBankQuestions = new Set();
  $('#managedWorkForm').reset(); $('#bankQuestionForm').reset();
  $('#managedWorkForm').classList.add('hidden'); $('#bankQuestionForm').classList.add('hidden');
  for (const id of ['managementFeedback','managedWorksList','bankQuestionsList','workQuestionPicker','selectedQuestionList','managedWorkFeedback','bankQuestionFeedback']) $(`#${id}`).innerHTML = '';
  for (const id of ['managementCourse','managementLevel','managementSearch']) $(`#${id}`).value = '';
  $('#newManagedWork').disabled = true; $('#newBankQuestion').disabled = true;
}
async function loadWorkManagement() {
  const epoch = ++managementEpoch;
  $('#managementFeedback').innerHTML = '<p class="muted">Carregando trabalhos e questões…</p>';
  $('#newManagedWork').disabled = true; $('#newBankQuestion').disabled = true;
  try {
    const [works, bank] = await Promise.all([workApi('/api/teacher/works'), workApi('/api/teacher/questions')]);
    if (epoch !== managementEpoch || currentUser?.role !== 'professor') return;
    managementWorks = works.works; managementQuestions = bank.questions; managementLoaded = true;
    $('#managementFeedback').innerHTML = '';
    $('#newManagedWork').disabled = false; $('#newBankQuestion').disabled = false;
    renderManagementLists(); renderQuestionPicker();
  } catch (error) {
    if (epoch === managementEpoch) $('#managementFeedback').innerHTML = errorMessage(error.message) + '<button class="secondary" id="retryManagement">Tentar novamente</button>';
  }
}
function switchManagementTab(tab) {
  managementTab = tab;
  for (const button of document.querySelectorAll('[data-management-tab]')) {
    const selected = button.dataset.managementTab === tab;
    button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
  }
  $('#managedWorksPanel').classList.toggle('hidden', tab !== 'works');
  $('#bankQuestionsPanel').classList.toggle('hidden', tab !== 'questions');
}
function matchesManagement(item, text) {
  return (!$('#managementCourse').value || item.courseId === $('#managementCourse').value)
    && (!$('#managementLevel').value || item.level === $('#managementLevel').value)
    && text.toLocaleLowerCase('pt-BR').includes($('#managementSearch').value.trim().toLocaleLowerCase('pt-BR'));
}
function renderManagementLists() {
  $('#managedWorkCount').textContent = managementWorks.length;
  $('#bankQuestionCount').textContent = managementQuestions.length;
  const works = managementWorks.filter(w => matchesManagement(w, `${w.id} ${w.title} ${w.lessonTitle}`));
  const questions = managementQuestions.filter(q => matchesManagement(q, q.prompt));
  $('#managedWorksList').innerHTML = works.length ? `<div class="student-table-card"><div class="table-responsive"><table class="student-table"><caption class="sr-only">Trabalhos cadastrados</caption><thead><tr><th>Trabalho</th><th>Curso</th><th>Nível</th><th>Questões</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${works.map(w => `<tr><td><strong>${escapeHtml(w.id)}</strong><br>${escapeHtml(w.title)}<br><small>${escapeHtml(w.lessonTitle)}</small></td><td>${escapeHtml(managementCourses[w.courseId])}</td><td>${levelBadge(w.level)}</td><td>${w.questions.length}/10</td><td>${w.questions.length === 10 ? 'Pronto para liberar' : 'Rascunho'}</td><td><div class="work-actions"><button class="secondary" data-edit-managed-work="${escapeHtml(w.id)}">Visualizar / Editar</button><button class="secondary" data-simulate-work="${escapeHtml(w.id)}" ${w.questions.length === 10 ? '' : 'disabled title="Complete 10 questões para simular a experiência do aluno"'}>Simular</button>${w.questions.length === 10 ? '<button class="secondary" data-page="performance">Liberar para aluno</button>' : ''}</div></td></tr>`).join('')}</tbody></table></div></div>` : '<p class="empty-state">Nenhum trabalho encontrado. Ajuste os filtros ou cadastre um novo trabalho.</p>';
  $('#bankQuestionsList').innerHTML = questions.length ? questions.map(q => {
    const linked = managementWorks.filter(w => w.questions.some(question => question.id === q.id)).length;
    return `<article class="module-card question-bank-card"><div class="management-toolbar"><div class="work-actions"><span class="pill">${escapeHtml(managementCourses[q.courseId])}</span>${levelBadge(q.level)}<span class="muted">Em ${linked} trabalho(s)</span></div><button class="secondary" data-edit-bank-question="${escapeHtml(q.id)}">Editar questão</button></div><details><summary>${escapeHtml(q.prompt)}</summary><ol type="A">${q.options.map((o,i) => `<li class="${i===q.correct ? 'correct-option' : ''}">${escapeHtml(o)}${i===q.correct ? ' ✓ Correta' : ''}</li>`).join('')}</ol>${q.explanation ? `<p class="muted">${escapeHtml(q.explanation)}</p>` : ''}</details></article>`;
  }).join('') : '<p class="empty-state">Nenhuma questão encontrada. Ajuste os filtros ou cadastre uma nova questão.</p>';
}
function openManagedWork(id = null) {
  if (!managementLoaded) return;
  editedWork = id ? managementWorks.find(w => w.id === id) : null;
  if (id && !editedWork) return;
  $('#managedWorkForm').reset();
  selectedBankQuestions = new Set(editedWork?.questions.map(q => q.id) || []);
  $('#managedWorkCode').value = editedWork?.id || '';
  $('#managedWorkCode').disabled = Boolean(editedWork);
  $('#managedWorkTitle').value = editedWork?.title || '';
  $('#managedWorkCourse').value = editedWork?.courseId || $('#managementCourse').value || 'word';
  $('#managedWorkCourse').disabled = Boolean(editedWork);
  $('#managedWorkLevel').value = editedWork?.level || $('#managementLevel').value || 'facil';
  $('#managedWorkLesson').value = editedWork?.lessonTitle === 'Trabalho' ? '' : editedWork?.lessonTitle || '';
  $('#managedWorkEditorTitle').textContent = editedWork ? `Editar trabalho ${editedWork.id}` : 'Novo trabalho';
  $('#managedWorkFeedback').innerHTML = '';
  $('#managedWorkForm').classList.remove('hidden');
  switchManagementTab('works'); renderQuestionPicker();
  $('#managedWorkForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#managedWorkTitle').focus({ preventScroll: true });
}
function renderQuestionPicker() {
  if ($('#managedWorkForm').classList.contains('hidden')) return;
  const course = $('#managedWorkCourse').value;
  const level = $('#pickerLevel').value;
  const search = $('#pickerSearch').value.trim().toLocaleLowerCase('pt-BR');
  const bank = managementQuestions.filter(q => q.courseId === course && (!level || q.level === level) && q.prompt.toLocaleLowerCase('pt-BR').includes(search));
  $('#selectedQuestionCount').textContent = `${selectedBankQuestions.size} / 10`;
  $('#selectedQuestionList').innerHTML = [...selectedBankQuestions].map((id,i) => {
    const q = managementQuestions.find(item=>item.id===id);
    return `<button type="button" data-remove-bank-question="${escapeHtml(id)}" title="Remover: ${escapeHtml(q?.prompt)}">${i+1}. ${escapeHtml(q?.prompt.slice(0,65))}${q?.prompt.length>65 ? '…' : ''} ×</button>`;
  }).join('');
  $('#workQuestionPicker').innerHTML = bank.length ? bank.map(q => `<label class="picker-question"><input type="checkbox" value="${escapeHtml(q.id)}" ${selectedBankQuestions.has(q.id) ? 'checked' : ''} ${!selectedBankQuestions.has(q.id) && selectedBankQuestions.size >= 10 ? 'disabled' : ''}><span>${escapeHtml(q.prompt)}<small>${escapeHtml(managementLevels[q.level])}</small></span></label>`).join('') : '<p class="empty-state">Nenhuma questão neste filtro. Cadastre uma questão ou ajuste o nível e a busca.</p>';
  $('#workReadiness').textContent = selectedBankQuestions.size === 10 ? '10 questões selecionadas · 10 pontos · Pronto para liberar após salvar.' : `Rascunho: faltam ${10-selectedBankQuestions.size} questão(ões) para liberar. Você já pode salvar e completar depois.`;
}
function openBankQuestion(id = null, suggestedCourse = null) {
  if (!managementLoaded) return;
  editedQuestion = id ? managementQuestions.find(q => q.id === id) : null;
  if (id && !editedQuestion) return;
  $('#bankQuestionForm').reset();
  $('#bankQuestionCourse').value = editedQuestion?.courseId || suggestedCourse || $('#managementCourse').value || 'word';
  $('#bankQuestionCourse').disabled = Boolean(editedQuestion);
  $('#bankQuestionLevel').value = editedQuestion?.level || $('#managementLevel').value || 'facil';
  $('#bankQuestionPrompt').value = editedQuestion?.prompt || '';
  $('#bankQuestionExplanation').value = editedQuestion?.explanation || '';
  for (let i=0;i<4;i++) $(`#bankOption${i}`).value = editedQuestion?.options[i] || '';
  if (editedQuestion) $(`#bankQuestionForm input[name="bankCorrect"][value="${editedQuestion.correct}"]`).checked=true;
  $('#bankQuestionEditorTitle').textContent = editedQuestion ? 'Editar questão' : 'Nova questão';
  $('#bankQuestionFeedback').innerHTML = '';
  $('#bankQuestionForm').classList.remove('hidden');
  switchManagementTab('questions');
  $('#bankQuestionForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#bankQuestionPrompt').focus({ preventScroll: true });
}
$('#managedWorkCourse').addEventListener('change', () => { selectedBankQuestions.clear(); renderQuestionPicker(); });
for (const id of ['pickerLevel','pickerSearch']) $(`#${id}`).addEventListener('input', renderQuestionPicker);
for (const id of ['managementCourse','managementLevel','managementSearch']) $(`#${id}`).addEventListener('input', renderManagementLists);
$('#workQuestionPicker').addEventListener('change', event => {
  const target = event.target.closest('input[type="checkbox"]'); if (!target) return;
  if (target.checked && selectedBankQuestions.size < 10) selectedBankQuestions.add(target.value); else selectedBankQuestions.delete(target.value);
  renderQuestionPicker();
});
$('#managedWorkForm').addEventListener('submit', async event => {
  event.preventDefault();
  const epoch = managementEpoch;
  const data = { id: $('#managedWorkCode').value, title: $('#managedWorkTitle').value, courseId: $('#managedWorkCourse').value, level: $('#managedWorkLevel').value, lessonTitle: $('#managedWorkLesson').value, questionIds: [...selectedBankQuestions], ...(editedWork ? { revision: editedWork.revision } : {}) };
  $('#saveManagedWork').disabled = true; $('#managedWorkFeedback').innerHTML = '';
  try {
    const result = await workApi('/api/teacher/works', editedWork ? 'PATCH' : 'POST', data);
    if (epoch !== managementEpoch || currentUser?.role !== 'professor') return;
    managementWorks = [result.item, ...managementWorks.filter(w=>w.id!==result.item.id)];
    $('#managedWorkForm').classList.add('hidden'); editedWork=null;
    renderManagementLists();
    $('#managementFeedback').innerHTML = successMessage(`Trabalho ${result.item.id} salvo. ${result.item.questions.length === 10 ? 'Disponível para liberação em Alunos → Desempenho.' : 'Rascunho salvo; complete 10 questões para liberar.'}`);
    $('#managementFeedback').scrollIntoView({ behavior: 'smooth' });
  } catch(error) { if (epoch === managementEpoch) $('#managedWorkFeedback').innerHTML = errorMessage(error.message); }
  finally { $('#saveManagedWork').disabled = false; }
});
$('#bankQuestionForm').addEventListener('submit', async event => {
  event.preventDefault();
  const epoch = managementEpoch;
  const selected = $('#bankQuestionForm input[name="bankCorrect"]:checked');
  const data = { courseId: $('#bankQuestionCourse').value, level: $('#bankQuestionLevel').value, prompt: $('#bankQuestionPrompt').value, options: [0,1,2,3].map(i=>$(`#bankOption${i}`).value), correct: selected ? Number(selected.value) : null, explanation: $('#bankQuestionExplanation').value, ...(editedQuestion ? { id: editedQuestion.id, revision: editedQuestion.revision } : {}) };
  $('#saveBankQuestion').disabled = true; $('#bankQuestionFeedback').innerHTML = '';
  try {
    const result = await workApi('/api/teacher/questions', editedQuestion ? 'PATCH' : 'POST', data);
    if (epoch !== managementEpoch || currentUser?.role !== 'professor') return;
    managementQuestions = [result.item, ...managementQuestions.filter(q=>q.id!==result.item.id)];
    managementWorks = managementWorks.map(w=>({...w,questions:w.questions.map(q=>q.id===result.item.id ? result.item : q)}));
    $('#bankQuestionForm').classList.add('hidden'); editedQuestion=null;
    renderManagementLists(); renderQuestionPicker();
    $('#managementFeedback').innerHTML = successMessage('Questão salva no banco. Ela já pode ser selecionada em trabalhos do mesmo curso.');
    $('#managementFeedback').scrollIntoView({ behavior: 'smooth' });
  } catch(error) { if(epoch === managementEpoch) $('#bankQuestionFeedback').innerHTML=errorMessage(error.message); }
  finally { $('#saveBankQuestion').disabled=false; }
});
document.addEventListener('click', event => {
  const tab=event.target.closest('[data-management-tab]'); if(tab) switchManagementTab(tab.dataset.managementTab);
  const work=event.target.closest('[data-edit-managed-work]'); if(work) openManagedWork(work.dataset.editManagedWork);
  const q=event.target.closest('[data-edit-bank-question]'); if(q) openBankQuestion(q.dataset.editBankQuestion);
  const remove=event.target.closest('[data-remove-bank-question]'); if(remove) { selectedBankQuestions.delete(remove.dataset.removeBankQuestion); renderQuestionPicker(); }
  if(event.target.closest('#newManagedWork')) openManagedWork();
  if(event.target.closest('#newBankQuestion')) openBankQuestion();
  if(event.target.closest('#addQuestionFromWork')) openBankQuestion(null,$('#managedWorkCourse').value);
  if(event.target.closest('#closeManagedWork')) $('#managedWorkForm').classList.add('hidden');
  if(event.target.closest('#closeBankQuestion')) $('#bankQuestionForm').classList.add('hidden');
  if(event.target.closest('#retryManagement')) loadWorkManagement();
});
$('.management-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  switchManagementTab(event.key==='Home' ? 'works' : event.key==='End' ? 'questions' : managementTab==='works' ? 'questions' : 'works');
  $(`[data-management-tab="${managementTab}"]`).focus();
});
