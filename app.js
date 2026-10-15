/* Վարորդական քննություն · quiz app (vanilla JS, works from file://) */

const GROUP_INFO = {
  1: 'Երթևեկության ընդհանուր կանոններ և նշաններ',
  2: 'Վարորդի և ուղևորի պարտականություններ',
  3: 'Շահագործումն արգելող անսարքություններ',
  4: 'Ճանապարհային նշաններ',
  5: 'Խաչմերուկների անցման հերթականություն',
  6: 'Երթևեկության սահմանափակումներ և արգելքներ',
  7: 'Կանգառ և կայանում',
  8: 'Արագություն և ուղևորների տեղափոխում',
  9: 'Լուսացույցներ և հատուկ ազդանշաններ',
  10: 'Առաջին բուժօգնություն',
};

const EXAM_COUNT = 20;
const EXAM_TIME_SEC = 20 * 60;

const app = document.getElementById('app');

// ---------- state ----------
let state = {
  screen: 'home',      // home | quiz | results
  config: null,        // { title, questions, mode, timeLimitSec }
  index: 0,
  picked: null,
  records: [],         // { question, picked, correct }
  timeLeft: 0,
  timerId: null,
  retry: null,
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

// ---------- screens ----------
function render() {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  if (state.screen === 'home') renderHome();
  else if (state.screen === 'quiz') renderQuiz();
  else renderResults();
  window.scrollTo(0, 0);
}

function renderHome() {
  const counts = {};
  for (const q of QUESTIONS) counts[q.group] = (counts[q.group] || 0) + 1;

  let topics = '';
  for (let g = 1; g <= 10; g++) {
    topics += `
      <button class="topic-card" onclick="startTopic(${g})">
        <span>
          <span class="name">Խումբ ${g}</span>
          <span class="desc" style="display:block">${esc(GROUP_INFO[g])}</span>
        </span>
        <span class="count">${counts[g] || 0} հարց</span>
      </button>`;
  }

  app.innerHTML = `
    <div class="container">
      <header class="home-header">
        <span class="badge">A · B · C կարգեր</span>
        <h1>Վարորդական քննության հարցաշար</h1>
        <p>Պաշտոնական ${QUESTIONS.length} հարց roadpolice.am-ից · սեղմիր պատասխանի վրա և անմիջապես ստուգիր</p>
      </header>
      <div class="big-actions">
        <button class="big-btn exam" onclick="startExam()">
          <span class="t">⏱ Քննական ռեժիմ</span>
          <span class="s">${EXAM_COUNT} պատահական հարց · ${EXAM_TIME_SEC / 60} րոպե · արդյունքը վերջում</span>
        </button>
        <button class="big-btn all" onclick="startAll()">
          <span class="t">📚 Բոլոր հարցերը</span>
          <span class="s">${QUESTIONS.length} հարց խառնված · ազատ պարապմունք</span>
        </button>
      </div>
      <div class="section-title">Թեմաներ ըստ խմբերի</div>
      <div class="topics">${topics}</div>
      <div class="footer">Հարցերը՝ roadpolice.am պաշտոնական հարցաշարից (A, B, C կարգեր)</div>
    </div>`;
}

function startTopic(group) {
  state.config = {
    title: 'Խումբ ' + group,
    questions: QUESTIONS.filter(q => q.group === group),
    mode: 'practice',
  };
  state.retry = () => startTopic(group);
  beginQuiz();
}

function startAll() {
  state.config = { title: 'Բոլոր հարցերը', questions: shuffle(QUESTIONS), mode: 'practice' };
  state.retry = startAll;
  beginQuiz();
}

function startExam() {
  state.config = {
    title: 'Քննական ռեժիմ',
    questions: shuffle(QUESTIONS).slice(0, EXAM_COUNT),
    mode: 'exam',
    timeLimitSec: EXAM_TIME_SEC,
  };
  state.retry = startExam;
  beginQuiz();
}

function beginQuiz() {
  state.screen = 'quiz';
  state.index = 0;
  state.picked = null;
  state.records = [];
  state.timeLeft = state.config.timeLimitSec || 0;
  render();
}

function renderQuiz() {
  const { questions, mode, timeLimitSec } = state.config;
  const q = questions[state.index];
  const isExam = mode === 'exam';
  const answered = state.picked !== null;
  const correctCount = state.records.filter(r => r.correct).length;
  const progress = Math.round(((state.index + (answered ? 1 : 0)) / questions.length) * 100);

  let stats = '';
  if (!isExam) {
    stats += `<span class="pill ok">✓ ${correctCount}</span>
              <span class="pill bad">✗ ${state.records.length - correctCount}</span>`;
  }
  if (isExam && timeLimitSec) {
    stats += `<span class="pill timer ${state.timeLeft < 60 ? 'warn' : ''}" id="timerPill">⏱ ${fmtTime(state.timeLeft)}</span>`;
  }
  stats += `<span class="pill">Հարց ${state.index + 1} / ${questions.length}</span>`;

  const imgs = q.images.map(src =>
    `<img src="${esc(src)}" alt="հարցի նկար" loading="lazy">`).join('');

  const opts = q.options.map((opt, i) => {
    const n = i + 1;
    const isPicked = state.picked === n;
    const isAnswer = q.answer === n;
    const showResult = answered && !isExam;
    let cls = 'opt';
    if (showResult && isAnswer) cls += ' correct';
    if (showResult && isPicked && !isAnswer) cls += ' wrong';
    if (isExam && isPicked) cls += ' picked';
    const mark = showResult && isAnswer ? '<span class="mark">✓</span>'
      : showResult && isPicked && !isAnswer ? '<span class="mark">✗</span>' : '';
    return `
      <button class="${cls}" onclick="pick(${n})" ${answered && !isExam ? 'disabled' : ''}>
        <span class="num">${n}</span>
        <span class="txt">${esc(opt)}</span>
        ${mark}
      </button>`;
  }).join('');

  let footer = '';
  if (answered && !isExam) {
    const ok = state.picked === q.answer;
    const last = state.index + 1 >= questions.length;
    footer = `
      <div class="qfooter">
        <span class="verdict ${ok ? 'ok' : 'bad'}">
          ${ok ? 'Ճիշտ է ✓' : 'Սխալ է · ճիշտ պատասխանը՝ ' + q.answer}
        </span>
        <button class="btn" onclick="next()">${last ? 'Տեսնել արդյունքը 🏁' : 'Հաջորդ հարցը →'}</button>
      </div>`;
  } else if (!isExam && state.records.length > 0) {
    footer = `
      <div class="qfooter" style="justify-content:flex-end">
        <button class="btn ghost small" onclick="finishEarly()">🏁 Ավարտել վաղաժամ</button>
      </div>`;
  }

  app.innerHTML = `
    <div class="container">
      <div class="topbar">
        <div class="topbar-row">
          <button class="quit-btn" onclick="quitQuiz()">← Դուրս գալ</button>
          <div class="stats">${stats}</div>
        </div>
        <div class="progress"><div style="width:${progress}%"></div></div>
      </div>
      <div class="qcard">
        <div class="qmeta">Խումբ ${q.group} · Հարց ${q.num}</div>
        <div class="qtext">${esc(q.q)}</div>
        ${imgs ? `<div class="qimages">${imgs}</div>` : ''}
        <div class="options">${opts}</div>
        ${footer}
      </div>
    </div>`;

  if (isExam && timeLimitSec) {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(() => {
      state.timeLeft--;
      const pill = document.getElementById('timerPill');
      if (pill) {
        pill.textContent = '⏱ ' + fmtTime(Math.max(0, state.timeLeft));
        if (state.timeLeft < 60) pill.classList.add('warn');
      }
      if (state.timeLeft <= 0) {
        clearInterval(state.timerId);
        state.timerId = null;
        if (state.screen !== 'quiz') return;
        // mark remaining questions unanswered
        for (let i = state.records.length; i < questions.length; i++) {
          state.records.push({ question: questions[i], picked: null, correct: false });
        }
        state.screen = 'results';
        render();
      }
    }, 1000);
  }
}

function pick(n) {
  if (state.picked !== null) return;
  state.picked = n;
  if (state.config.mode === 'exam') {
    renderQuiz(); // show selection
    setTimeout(() => { recordAndNext(n); }, 350);
  } else {
    renderQuiz();
  }
}

function recordAndNext(choice) {
  if (state.screen !== 'quiz') return;
  const q = state.config.questions[state.index];
  state.records.push({ question: q, picked: choice, correct: choice === q.answer });
  if (state.index + 1 >= state.config.questions.length) {
    state.screen = 'results';
    render();
  } else {
    state.index++;
    state.picked = null;
    renderQuiz();
  }
}

function next() { recordAndNext(state.picked); }

function finishEarly() {
  state.screen = 'results';
  render();
}

function quitQuiz() {
  state.screen = 'home';
  render();
}

function renderResults() {
  const records = state.records;
  const total = records.length;
  const correct = records.filter(r => r.correct).length;
  const wrong = records.filter(r => !r.correct && r.picked !== null);
  const skipped = records.filter(r => r.picked === null);
  const pct = total ? Math.round((correct / total) * 100) : 0;

  const mistakes = wrong.map((r, i) => {
    const q = r.question;
    const imgs = q.images.map(src => `<img src="${esc(src)}" alt="" loading="lazy">`).join('');
    return `
      <div class="mistake-card">
        <div class="qmeta">Խումբ ${q.group} · Հարց ${q.num}</div>
        <div class="mq">${esc(q.q)}</div>
        ${imgs ? `<div class="qimages">${imgs}</div>` : ''}
        <div class="mrow bad">✗ Քո պատասխանը՝ ${r.picked}. ${esc(q.options[r.picked - 1] || '')}</div>
        <div class="mrow ok">✓ Ճիշտը՝ ${q.answer}. ${esc(q.options[q.answer - 1])}</div>
      </div>`;
  }).join('');

  app.innerHTML = `
    <div class="container">
      <header class="home-header" style="padding-bottom:14px">
        <h1 style="font-size:clamp(20px,4.5vw,28px)">Արդյունք · ${esc(state.config.title)}</h1>
      </header>
      <div class="result-card">
        <div class="result-score">${correct}<small> / ${total}</small></div>
        <div class="result-pct">${pct}% ճիշտ</div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <div class="result-badges">
          <span class="pill ok">✓ Ճիշտ ${correct}</span>
          <span class="pill bad">✗ Սխալ ${wrong.length}</span>
          ${skipped.length ? `<span class="pill">− Չպատասխանած ${skipped.length}</span>` : ''}
        </div>
        <div class="result-actions">
          <button class="btn" onclick="state.retry()">↻ Կրկնել</button>
          <button class="btn ghost" onclick="quitQuiz()">🏠 Գլխավոր էջ</button>
        </div>
      </div>
      ${wrong.length ? `<div class="mistakes-title">Սխալները (${wrong.length})</div>${mistakes}` : ''}
    </div>`;
}

// expose for inline handlers
window.startTopic = startTopic;
window.startAll = startAll;
window.startExam = startExam;
window.pick = pick;
window.next = next;
window.finishEarly = finishEarly;
window.quitQuiz = quitQuiz;
window.state = state;

render();
