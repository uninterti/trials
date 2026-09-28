let lessons = [];
let questions = [];
let courses = [];
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const errorMessage = (message) => `<div class="task" role="alert">${escapeHtml(message)}</div>`;

async function loadCatalog() {
  const response = await fetch('/api/catalog', { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar os cursos. Recarregue a página.');
  const data = await response.json();
  courses = data.courses;
  lessons = data.lessons.filter((lesson) => lesson.course_id === 'word');
  questions = data.questions.filter((question) => question.course_id === 'word');
  $('#lessonCount').textContent = lessons.length;
  $('#hourCount').textContent = `${lessons.reduce((sum, lesson) => sum + lesson.duration_minutes, 0) / 60}h`;
  const cards = courses.filter((course) => course.id !== 'office' && course.id !== 'powerpoint');
  cards.push(...courses.filter((course) => course.id === 'powerpoint'));
  $('#dashCards').innerHTML = cards.map((course) => card(course)).join('');
  $('#catalogCards').innerHTML = courses.map((course) => card(course)).join('');
  $('#lessonList').innerHTML = lessons.map((lesson, i) => `<button class="lesson" data-lesson="${i}"><span class="lesson-num">${String(i + 1).padStart(2, '0')}</span><span><b>${escapeHtml(lesson.title)}</b></span><span class="lesson-arrow">→</span></button>`).join('');
  if (lessons.length) selectLesson(0);
  $('#questions').innerHTML = questions.map((item, i) => `<div class="question"><h4>${i + 1}. ${escapeHtml(item.prompt)}</h4>${item.options.map((option, j) => `<label class="option"><input type="radio" name="q${i}" value="${j}" required>${escapeHtml(option)}</label>`).join('')}</div>`).join('');
}
function card(course) {
  const available = course.status === 'available';
  const variant = course.id === 'excel' ? 'excel' : course.id === 'powerpoint' ? 'ppt' : '';
  const meta = available ? `${lessons.length} aulas · ${lessons.length} horas` : 'Conteúdo em preparação';
  return `<article class="card"><div class="course-icon ${variant}">${escapeHtml(course.icon)}</div><span class="pill ${available ? '' : 'soon'}">${available ? 'Semana 1 disponível' : 'Em preparação'}</span><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description)}</p><div class="card-foot"><span>${meta}</span>${available ? '<button data-go="word">Abrir curso →</button>' : ''}</div></article>`;
}
function selectLesson(n) {
  document.querySelectorAll('.lesson').forEach((element, i) => element.classList.toggle('active', i === n));
  const lesson = lessons[n];
  $('#lessonDetail').innerHTML = `<div class="eyebrow">Aula ${n + 1} de ${lessons.length}</div><h3>${escapeHtml(lesson.title)}</h3><p>${escapeHtml(lesson.goal)}</p><h4>Roteiro da aula</h4><ol class="agenda">${lesson.blocks.map(([, topic]) => `<li>${escapeHtml(topic)}</li>`).join('')}</ol><div class="task"><b>Atividade prática</b>${escapeHtml(lesson.task)}</div>${n === 0 ? '<button class="primary" data-open-lesson="word-1" style="width:100%;margin-top:19px">Começar a Aula 1 →</button>' : '<p>Conteúdo detalhado desta aula em preparação.</p>'}`;
}
function show(page) {
  document.querySelectorAll('.page').forEach((element) => element.classList.toggle('active', element.id === page));
  document.querySelectorAll('.nav button').forEach((element) => element.classList.toggle('active', element.dataset.page === page || (page === 'word' && element.dataset.page === 'courses')));
  $('#crumb').textContent = { dashboard: 'Dashboard', courses: 'Cursos', word: 'Cursos / Word', lesson: 'Word / Aula 1', assessments: 'Avaliações' }[page];
  location.hash = page;
  window.scrollTo(0, 0);
  if (page === 'assessments') loadHistory();
}
async function openLesson() {
  show('lesson');
  $('#lessonReader').innerHTML = '<div class="reader-loading">Carregando a aula…</div>';
  $('#lessonToc').innerHTML = '';
  try {
    const response = await fetch('/api/lessons/word-1', { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível carregar a aula. Volte ao curso e tente novamente.');
    const content = await response.json();
    $('#lessonReader').innerHTML = `<p class="reader-intro">${escapeHtml(content.intro)}</p><div class="outcome"><strong>Ao final da aula</strong><br>${escapeHtml(content.outcome)}</div>${content.sections.map((section, index) => `<section class="lesson-step" id="etapa-${index + 1}"><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.explanation)}</p><h3>Faça no Word</h3><ol class="action-list">${section.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol><h3>Exemplo para praticar</h3><div class="document-example">${escapeHtml(section.example)}</div><div class="practice-note"><strong>Agora é sua vez</strong><br>${escapeHtml(section.practice)}</div><div class="lesson-tip"><strong>Dica:</strong> ${escapeHtml(section.tip)}</div></section>`).join('')}<div class="final-task"><div class="eyebrow" style="color:#f0bc6b">Conclusão</div><h2>Seu documento pronto</h2><p>${escapeHtml(content.finalTask)}</p><strong>Confira antes de terminar:</strong><ul>${content.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`;
    $('#lessonToc').innerHTML = content.sections.map((section, index) => `<a href="#etapa-${index + 1}">${escapeHtml(section.title)}</a>`).join('');
  } catch (error) {
    $('#lessonReader').innerHTML = errorMessage(error.message);
  }
}
async function loadHistory() {
  try {
    const response = await fetch('/api/attempts', { cache: 'no-store' });
    if (!response.ok) throw new Error('');
    const data = await response.json();
    $('#history').textContent = data.attempts.length ? `Última tentativa: ${data.attempts[0].score} de ${data.attempts[0].total} acertos.` : 'Você ainda não fez esta avaliação.';
  } catch { $('#history').textContent = 'Seu histórico não está disponível agora.'; }
}
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-open-lesson]')) { openLesson(); return; }
  const target = event.target.closest('[data-go],[data-page],[data-lesson]');
  if (!target) return;
  if (target.dataset.lesson !== undefined) selectLesson(Number(target.dataset.lesson));
  else show(target.dataset.go || target.dataset.page);
});
$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#loginForm button');
  button.disabled = true;
  button.textContent = 'Carregando aulas…';
  try {
    await loadCatalog();
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    show('dashboard');
  } catch (error) {
    $('.demo-note').innerHTML = errorMessage(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Entrar no ambiente';
  }
});
$('#logout').addEventListener('click', () => { window.location.href = '/signout-with-chatgpt?return_to=%2F'; });
$('#startQuiz').addEventListener('click', () => { $('#quiz').classList.remove('hidden'); $('#quiz').scrollIntoView({ behavior: 'smooth' }); });
$('#quiz').addEventListener('submit', async (event) => {
  event.preventDefault();
  const feedback = $('#feedback');
  const button = $('#quiz button[type="submit"]');
  button.disabled = true;
  feedback.classList.add('hidden');
  try {
    const data = new FormData(event.target);
    const answers = questions.map((_, i) => Number(data.get(`q${i}`)));
    const response = await fetch('/api/attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o resultado.');
    feedback.textContent = `Você acertou ${result.score} de ${result.total} perguntas. Resultado salvo. ${result.score === result.total ? 'Ótimo trabalho!' : 'Revise as aulas e tente novamente.'}`;
    feedback.classList.remove('hidden');
    loadHistory();
  } catch (error) {
    feedback.textContent = error.message;
    feedback.classList.remove('hidden');
  } finally { button.disabled = false; }
});
