let currentUser = null;
let lessons = [];
let questions = [];
let courses = [];
let studentsList = [];
let lastCreatedStudent = null;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

const errorMessage = (message) => `<div class="error-feedback" role="alert">${escapeHtml(message)}</div>`;
const successMessage = (message) => `<div class="feedback" role="status">${escapeHtml(message)}</div>`;

// --- AUTHENTICATION ---

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.user) {
      currentUser = data.user;
      applyUserUI();
      await loadCatalog();
      $('#login').classList.add('hidden');
      $('#app').classList.remove('hidden');
      const hashPage = (location.hash || '').replace('#', '');
      show(hashPage && hashPage !== 'login' ? hashPage : 'dashboard');
      return true;
    }
  } catch (err) {
    console.error('Auth check error', err);
  }
  
  currentUser = null;
  $('#login').classList.remove('hidden');
  $('#app').classList.add('hidden');
  return false;
}

function applyUserUI() {
  if (!currentUser) return;
  const isProf = currentUser.role === 'professor';
  
  $('#topbarUserName').textContent = currentUser.name || (isProf ? 'Professor' : 'Aluno');
  $('#topbarAvatar').textContent = (currentUser.name || 'U').charAt(0).toUpperCase();
  
  const roleBadge = $('#topbarRoleBadge');
  roleBadge.textContent = isProf ? 'Professor' : 'Aluno';
  roleBadge.className = `role-badge ${isProf ? 'prof' : 'aluno'}`;

  const navStudents = $('#navStudents');
  if (navStudents) {
    if (isProf) {
      navStudents.classList.remove('hidden');
    } else {
      navStudents.classList.add('hidden');
    }
  }

  const greeting = $('#dashGreeting');
  if (greeting) {
    greeting.textContent = `Olá, ${currentUser.name || (isProf ? 'Professor' : 'Aluno')}!`;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const userField = $('#loginUser');
  const passField = $('#loginPassword');
  const btn = $('#loginSubmitBtn');
  const errorBox = $('#loginError');

  const login = userField.value.trim();
  const password = passField.value.trim();

  if (!login || !password) {
    errorBox.textContent = 'Preencha o usuário e a senha.';
    errorBox.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Autenticando…';
  errorBox.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Falha ao autenticar.');
    }

    currentUser = data.user;
    applyUserUI();
    await loadCatalog();

    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    show('dashboard');
    userField.value = '';
    passField.value = '';
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar no ambiente';
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout error', err);
  }
  currentUser = null;
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  location.hash = '';
}

// --- CATALOG & COURSES ---

async function loadCatalog() {
  const response = await fetch('/api/catalog', { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar os cursos.');
  const data = await response.json();
  courses = data.courses || [];
  lessons = (data.lessons || []).filter((l) => l.course_id === 'word');
  questions = (data.questions || []).filter((q) => q.course_id === 'word');

  $('#lessonCount').textContent = lessons.length;
  $('#hourCount').textContent = `${lessons.reduce((sum, l) => sum + l.duration_minutes, 0) / 60}h`;

  const cards = courses.filter((c) => c.id !== 'office' && c.id !== 'powerpoint');
  cards.push(...courses.filter((c) => c.id === 'powerpoint'));
  $('#dashCards').innerHTML = cards.map((c) => card(c)).join('');
  $('#catalogCards').innerHTML = courses.map((c) => card(c)).join('');

  $('#lessonList').innerHTML = lessons
    .map(
      (lesson, i) =>
        `<button class="lesson" data-lesson="${i}"><span class="lesson-num">${String(i + 1).padStart(2, '0')}</span><span><b>${escapeHtml(lesson.title)}</b></span><span class="lesson-arrow">→</span></button>`
    )
    .join('');

  if (lessons.length) selectLesson(0);

  $('#questions').innerHTML = questions
    .map(
      (item, i) =>
        `<div class="question"><h4>${i + 1}. ${escapeHtml(item.prompt)}</h4>${item.options
          .map(
            (option, j) =>
              `<label class="option"><input type="radio" name="q${i}" value="${j}" required>${escapeHtml(option)}</label>`
          )
          .join('')}</div>`
    )
    .join('');

  // Populate course dropdown in Student registration form
  const courseSelect = $('#studentCourse');
  if (courseSelect) {
    courseSelect.innerHTML = '<option value="">Selecione o curso…</option>' +
      courses.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)} ${c.status === 'available' ? '· Disponível' : '· Em breve'}</option>`).join('');
  }
}

function card(course) {
  const available = course.status === 'available';
  const variant = course.id === 'excel' ? 'excel' : course.id === 'powerpoint' ? 'ppt' : '';
  const meta = available ? `${lessons.length} aulas · ${lessons.length} horas` : 'Conteúdo em preparação';
  return `<article class="card"><div class="course-icon ${variant}">${escapeHtml(course.icon)}</div><span class="pill ${available ? '' : 'soon'}">${available ? 'Semana 1 disponível' : 'Em preparação'}</span><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description)}</p><div class="card-foot"><span>${meta}</span>${available ? '<button data-go="word">Abrir curso →</button>' : ''}</div></article>`;
}

function selectLesson(n) {
  document.querySelectorAll('.lesson').forEach((el, i) => el.classList.toggle('active', i === n));
  const lesson = lessons[n];
  if (!lesson) return;
  $('#lessonDetail').innerHTML = `<div class="eyebrow">Aula ${n + 1} de ${lessons.length}</div><h3>${escapeHtml(lesson.title)}</h3><p>${escapeHtml(lesson.goal)}</p><h4>Roteiro da aula</h4><ol class="agenda">${lesson.blocks.map(([, topic]) => `<li>${escapeHtml(topic)}</li>`).join('')}</ol><div class="task"><b>Atividade prática</b>${escapeHtml(lesson.task)}</div>${n === 0 ? '<button class="primary" data-open-lesson="word-1" style="width:100%;margin-top:19px">Começar a Aula 1 →</button>' : '<p>Conteúdo detalhado desta aula em preparação.</p>'}`;
}

function show(page) {
  // Protect students area from non-professors
  if (page === 'students' && currentUser?.role !== 'professor') {
    page = 'dashboard';
  }

  document.querySelectorAll('.page').forEach((el) => el.classList.toggle('active', el.id === page));
  document.querySelectorAll('.nav button').forEach((el) => el.classList.toggle('active', el.dataset.page === page || (page === 'word' && el.dataset.page === 'courses')));
  
  const crumbs = {
    dashboard: 'Dashboard',
    courses: 'Cursos',
    word: 'Cursos / Word',
    lesson: 'Word / Aula 1',
    assessments: 'Avaliações',
    students: 'Painel do Professor / Alunos',
  };
  $('#crumb').textContent = crumbs[page] || 'Dashboard';
  location.hash = page;
  window.scrollTo(0, 0);

  if (page === 'assessments') loadHistory();
  if (page === 'students') loadStudents();
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
    $('#history').textContent = data.attempts && data.attempts.length ? `Última tentativa: ${data.attempts[0].score} de ${data.attempts[0].total} acertos.` : 'Você ainda não fez esta avaliação.';
  } catch {
    $('#history').textContent = 'Seu histórico não está disponível agora.';
  }
}

// --- STUDENT MANAGEMENT (PROFESSOR) ---

async function loadStudents() {
  if (currentUser?.role !== 'professor') return;
  const tbody = $('#studentTableBody');
  const countEl = $('#studentTotalCount');
  
  try {
    const res = await fetch('/api/students', { cache: 'no-store' });
    if (!res.ok) throw new Error('Não foi possível carregar os alunos.');
    const data = await res.json();
    studentsList = data.students || [];
    countEl.textContent = `${studentsList.length} aluno(s) cadastrado(s)`;
    renderStudentsTable(studentsList);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(err.message)}</td></tr>`;
    countEl.textContent = 'Erro ao carregar';
  }
}

function renderStudentsTable(list) {
  const tbody = $('#studentTableBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Nenhum aluno cadastrado no momento. Use o formulário acima para registrar um aluno.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((st) => {
    const formattedDate = st.created_at ? new Date(st.created_at).toLocaleDateString('pt-BR') : '—';
    const pass = st.initial_password || '******';
    const courseName = st.course_title || st.course_id || 'Geral';
    return `
      <tr data-student-id="${escapeHtml(st.id)}">
        <td><strong>${escapeHtml(st.name)}</strong></td>
        <td><code>${escapeHtml(st.phone)}</code></td>
        <td><span class="pill">${escapeHtml(courseName)}</span></td>
        <td><span class="pass-badge">${escapeHtml(pass)}</span></td>
        <td>${escapeHtml(formattedDate)}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn-action-copy" data-copy-access="${escapeHtml(st.id)}">📋 Copiar Acesso</button>
          <button type="button" class="btn-action-delete" data-delete-student="${escapeHtml(st.id)}" data-name="${escapeHtml(st.name)}">🗑 Excluir</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleCreateStudent(event) {
  event.preventDefault();
  const nameInput = $('#studentName');
  const phoneInput = $('#studentPhone');
  const courseInput = $('#studentCourse');
  const btn = $('#btnCreateStudent');
  const feedback = $('#studentFormFeedback');

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const courseId = courseInput.value;

  if (!name || !phone || !courseId) {
    feedback.innerHTML = errorMessage('Preencha todos os campos do formulário.');
    feedback.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Cadastrando…';
  feedback.classList.add('hidden');

  try {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, courseId }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Erro ao cadastrar aluno.');
    }

    lastCreatedStudent = data.student;

    // Show success banner with credentials
    $('#createdStudentName').textContent = data.student.name;
    $('#createdStudentPhone').textContent = data.student.phone;
    $('#createdStudentCourse').textContent = data.student.courseTitle || data.student.courseId;
    $('#createdStudentPass').textContent = data.student.initialPassword;
    $('#studentSuccessBanner').classList.remove('hidden');
    $('#studentSuccessBanner').scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Reset inputs
    nameInput.value = '';
    phoneInput.value = '';
    courseInput.value = '';

    // Reload list
    await loadStudents();
  } catch (err) {
    feedback.innerHTML = errorMessage(err.message);
    feedback.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Cadastrar e Gerar Senha';
  }
}

async function handleDeleteStudent(id, name) {
  if (!confirm(`Tem certeza que deseja excluir o cadastro do aluno "${name}"? O acesso será revogado.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/students?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao excluir aluno.');
    }
    await loadStudents();
  } catch (err) {
    alert(err.message);
  }
}

function copyStudentWhatsApp(student) {
  if (!student) return;
  const origin = window.location.origin;
  const text = `Olá, *${student.name}*! 👋\n\nSeus dados de acesso ao ambiente *Trials* já estão ativos:\n\n🌐 *Link:* ${origin}\n📱 *Login (Telefone):* ${student.phone}\n🔑 *Senha:* ${student.initialPassword || student.initial_password || 'Sua senha'}\n📚 *Curso:* ${student.courseTitle || student.course_title || student.course_id || 'Trials'}\n\nBons estudos! 🚀`;

  navigator.clipboard.writeText(text).then(() => {
    alert('✅ Mensagem copiada com sucesso! Você pode colar diretamente no WhatsApp do aluno.');
  }).catch(() => {
    prompt('Copie a mensagem abaixo:', text);
  });
}

// --- EVENT LISTENERS ---

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-open-lesson]')) {
    openLesson();
    return;
  }

  const copyAccessBtn = event.target.closest('[data-copy-access]');
  if (copyAccessBtn) {
    const studentId = copyAccessBtn.dataset.copyAccess;
    const student = studentsList.find((s) => s.id === studentId);
    if (student) copyStudentWhatsApp(student);
    return;
  }

  const deleteBtn = event.target.closest('[data-delete-student]');
  if (deleteBtn) {
    const id = deleteBtn.dataset.deleteStudent;
    const name = deleteBtn.dataset.name;
    handleDeleteStudent(id, name);
    return;
  }

  const target = event.target.closest('[data-go],[data-page],[data-lesson]');
  if (!target) return;
  if (target.dataset.lesson !== undefined) selectLesson(Number(target.dataset.lesson));
  else show(target.dataset.go || target.dataset.page);
});

$('#loginForm').addEventListener('submit', handleLogin);
$('#logout').addEventListener('click', handleLogout);

const studentForm = $('#studentForm');
if (studentForm) {
  studentForm.addEventListener('submit', handleCreateStudent);
}

const btnCloseSuccess = $('#btnCloseSuccessBanner');
if (btnCloseSuccess) {
  btnCloseSuccess.addEventListener('click', () => {
    $('#studentSuccessBanner').classList.add('hidden');
  });
}

const btnCopyWhatsApp = $('#btnCopyWhatsApp');
if (btnCopyWhatsApp) {
  btnCopyWhatsApp.addEventListener('click', () => {
    if (lastCreatedStudent) copyStudentWhatsApp(lastCreatedStudent);
  });
}

const studentSearch = $('#studentSearch');
if (studentSearch) {
  studentSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) {
      renderStudentsTable(studentsList);
      return;
    }
    const filtered = studentsList.filter(
      (s) => (s.name || '').toLowerCase().includes(term) || (s.phone || '').toLowerCase().includes(term)
    );
    renderStudentsTable(filtered);
  });
}

// Phone input mask for Brazilian phone numbers
const phoneInput = $('#studentPhone');
if (phoneInput) {
  phoneInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 6) {
      e.target.value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      e.target.value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      e.target.value = `(${value}`;
    }
  });
}

$('#startQuiz').addEventListener('click', () => {
  $('#quiz').classList.remove('hidden');
  $('#quiz').scrollIntoView({ behavior: 'smooth' });
});

$('#quiz').addEventListener('submit', async (event) => {
  event.preventDefault();
  const feedback = $('#feedback');
  const button = $('#quiz button[type="submit"]');
  button.disabled = true;
  feedback.classList.add('hidden');
  try {
    const data = new FormData(event.target);
    const answers = questions.map((_, i) => Number(data.get(`q${i}`)));
    const response = await fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o resultado.');
    feedback.textContent = `Você acertou ${result.score} de ${result.total} perguntas. Resultado salvo. ${
      result.score === result.total ? 'Ótimo trabalho!' : 'Revise as aulas e tente novamente.'
    }`;
    feedback.classList.remove('hidden');
    loadHistory();
  } catch (error) {
    feedback.textContent = error.message;
    feedback.classList.remove('hidden');
  } finally {
    button.disabled = false;
  }
});

// Auto-initialize authentication on page load
checkAuth();
