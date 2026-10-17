/* Վարորդական քննություն · quiz app (vanilla JS, works from file://)
   Ուսուցողական հարթակ՝ սխալների կրկնություն, առաջընթաց, streak, ձեռքբերումներ,
   մարաթոն, բլից և վերանայման ռեժիմներ */

const GROUP_INFO = {
  1: 'Երթևեկության ընդհանուր կանոններ և նշաններ',
  2: 'Վարորդի և ուղևորի պարտականություններ',
  3: 'Շահագործումն արգելող անսարքություններ',
  4: 'Ճանապարհային նշաններ',
  5: 'Խաչմերուկների անցման հերթականություն',
  6: 'Լուսացույցներ և կարգավորողի ազդանշաններ',
  7: 'Կանգառ և կայանում',
  8: 'Արագություն և ուղևորների տեղափոխում',
  9: 'Ազդանշաններ, վազանց և լուսային սարքեր',
  10: 'Առաջին բուժօգնություն',
  11: 'Տեսողության և ընկալման ստուգում (նկարներով)',
};

// հարցեր թեմաների համար՝ ԵՃ կանոններ + հոգեբանական թեստեր
const TOPIC_QUESTIONS = QUESTIONS.concat(typeof PSYCHO !== 'undefined' ? PSYCHO : []);

const EXAM_COUNT = 20;
const EXAM_TIME_SEC = 20 * 60;
const BLITZ_SEC = 10;

const app = document.getElementById('app');

// ---------- persistent storage ----------
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
}

let stats = load('roudexam.stats', {
  groups: {},          // group -> { c: correct, t: total }
  totalCorrect: 0,
  totalAnswered: 0,
  examsTaken: 0,
  examsPassed: 0,
  bestMarathon: 0,
});
let mistakes = load('roudexam.mistakes', []);          // ['4:55', ...]
let streak = load('roudexam.streak', { last: null, count: 0 });
let achievements = load('roudexam.achievements', {});  // id -> true
let settings = load('roudexam.settings', { theme: 'light' });

const ACHIEVEMENTS = [
  { id: 'first10', emoji: '🌱', name: 'Առաջին քայլերը', desc: '10 ճիշտ պատասխան' },
  { id: 'correct100', emoji: '💯', name: 'Հարյուրավոր', desc: '100 ճիշտ պատասխան' },
  { id: 'correct500', emoji: '🚀', name: 'Անխոհեմ', desc: '500 ճիշտ պատասխան' },
  { id: 'examPass', emoji: '🎓', name: 'Հանձնած է', desc: 'Առաջին հանձնած քննությունը' },
  { id: 'perfectExam', emoji: '💎', name: 'Կատարյալ', desc: 'Քննություն առանց սխալի' },
  { id: 'marathon10', emoji: '🏃', name: 'Մարաթոնցի', desc: '10+ անընդմեջ ճիշտ մարաթոնում' },
  { id: 'marathon25', emoji: '🦄', name: 'Լեգենդ', desc: '25+ անընդմեջ ճիշտ մարաթոնում' },
  { id: 'streak3', emoji: '🔥', name: 'Կրակն անջնջելի', desc: '3+ օր անըդմեջ պարապմունք' },
  { id: 'allGroups', emoji: '🗺️', name: 'Հետազոտող', desc: 'Պատասխանել բոլոր 11 խմբերից' },
];

function qkey(q) { return q.group + ':' + q.num; }
const QMAP = {};
for (const q of TOPIC_QUESTIONS) QMAP[qkey(q)] = q;

function groupTitle(g) {
  return g <= 10 ? 'Խումբ ' + g : 'Հոգեբանական թեստեր';
}

function bumpStats(q, correct) {
  stats.totalAnswered++;
  if (correct) stats.totalCorrect++;
  const g = stats.groups[q.group] || (stats.groups[q.group] = { c: 0, t: 0 });
  g.t++;
  if (correct) g.c++;
  save('roudexam.stats', stats);
}

function addMistake(q) {
  const k = qkey(q);
  if (!mistakes.includes(k)) {
    mistakes.push(k);
    save('roudexam.mistakes', mistakes);
  }
}
function removeMistake(q) {
  const k = qkey(q);
  const i = mistakes.indexOf(k);
  if (i !== -1) {
    mistakes.splice(i, 1);
    save('roudexam.mistakes', mistakes);
  }
}

function touchStreak() {
  const today = new Date().toDateString();
  if (streak.last === today) return;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  streak.count = streak.last === yesterday ? streak.count + 1 : 1;
  streak.last = today;
  save('roudexam.streak', streak);
  if (streak.count >= 2) toast('🔥 ' + streak.count + ' օր անըդմեջ պարապմունք');
}

function unlock(id) {
  if (achievements[id]) return;
  achievements[id] = true;
  save('roudexam.achievements', achievements);
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (a) toast(a.emoji + ' Ձեռքբերում՝ ' + a.name);
}

function checkAchievements() {
  if (stats.totalCorrect >= 10) unlock('first10');
  if (stats.totalCorrect >= 100) unlock('correct100');
  if (stats.totalCorrect >= 500) unlock('correct500');
  if (stats.examsPassed >= 1) unlock('examPass');
  if (stats.bestMarathon >= 10) unlock('marathon10');
  if (stats.bestMarathon >= 25) unlock('marathon25');
  if (streak.count >= 3) unlock('streak3');
  let covered = 0;
  for (let g = 1; g <= 11; g++) if (stats.groups[g] && stats.groups[g].t > 0) covered++;
  if (covered >= 11) unlock('allGroups');
}

// թույլ թեմաներ՝ >= 5 պատասխան և < 80% ճշգրտություն
function weakGroups() {
  const list = [];
  for (let g = 1; g <= 11; g++) {
    const s = stats.groups[g];
    if (s && s.t >= 5 && s.c / s.t < 0.8) list.push({ g, acc: s.c / s.t });
  }
  return list.sort((a, b) => a.acc - b.acc).slice(0, 3).map(x => x.g);
}

// ---------- toast ----------
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 3200);
}

// ---------- theme ----------
const themeBtn = document.createElement('button');
themeBtn.className = 'theme-btn';
themeBtn.title = 'Փոխել թեման';
themeBtn.onclick = toggleTheme;
document.body.appendChild(themeBtn);

function applyTheme() {
  document.body.classList.toggle('dark', settings.theme === 'dark');
  themeBtn.textContent = settings.theme === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  save('roudexam.settings', settings);
  applyTheme();
}
applyTheme();

// ---------- state ----------
let state = {
  screen: 'home',      // home | order | quiz | results
  config: null,        // { title, questions, mode, timeLimitSec, perQuestionSec }
  pending: null,       // { type: 'all'|'mistakes'|'weak'|'review' } | { type: 'topic', group }
  index: 0,
  picked: null,
  records: [],         // { question, picked, correct }
  timeLeft: 0,
  timerId: null,       // exam timer
  qTimerId: null,      // blitz per-question timer
  advanceId: null,     // blitz auto-advance timeout
  qTimeLeft: 0,
  blitzOut: false,     // blitz time expired for current question
  examCounted: false,
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

function clearTimers() {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  if (state.qTimerId) { clearInterval(state.qTimerId); state.qTimerId = null; }
  if (state.advanceId) { clearTimeout(state.advanceId); state.advanceId = null; }
}

// ---------- screens ----------
function render() {
  clearTimers();
  if (state.screen === 'home') renderHome();
  else if (state.screen === 'order') renderOrder();
  else if (state.screen === 'quiz') renderQuiz();
  else renderResults();
  window.scrollTo(0, 0);
}

function renderHome() {
  const counts = {};
  for (const q of TOPIC_QUESTIONS) counts[q.group] = (counts[q.group] || 0) + 1;

  const weak = weakGroups();

  let actions = `
    <button class="big-btn exam" onclick="startExam()">
      <span class="t">⏱ Քննական ռեժիմ</span>
      <span class="s">${EXAM_COUNT} պատահական հարց · ${EXAM_TIME_SEC / 60} րոպե · արդյունքը վերջում</span>
    </button>
    <button class="big-btn all" onclick="startAll()">
      <span class="t">📝 Սկսել թեստը</span>
      <span class="s">${QUESTIONS.length} հարց · խառը կամ կարգով — քո ընտրությամբ</span>
    </button>`;

  if (mistakes.length) {
    actions += `
    <button class="big-btn warn" onclick="startMistakes()">
      <span class="t">📕 Իմ սխալները</span>
      <span class="s">${mistakes.length} հարց սպասում է կրկնության · ամրապնդիր թույլ կետերդ</span>
    </button>`;
  }
  if (weak.length) {
    actions += `
    <button class="big-btn target" onclick="startWeak()">
      <span class="t">🎯 Թույլ թեմաներ</span>
      <span class="s">Ավտոմատ հավաքված՝ ${weak.map(g => groupTitle(g)).join(', ')}</span>
    </button>`;
  }
  actions += `
    <button class="big-btn all" onclick="startMarathon()">
      <span class="t">🏃 Մարաթոն</span>
      <span class="s">Մինչև առաջին սխալը · ռեկորդ՝ ${stats.bestMarathon}</span>
    </button>
    <button class="big-btn all" onclick="startBlitz()">
      <span class="t">⚡ Բլից</span>
      <span class="s">${BLITZ_SEC} վայրկյան յուրաքանչյուր հարցի համար</span>
    </button>
    <button class="big-btn all" onclick="startReview()">
      <span class="t">👁 Վերանայում</span>
      <span class="s">Կարդալ հարցերը ճիշտ պատասխանների հետ</span>
    </button>`;

  let topics = '';
  for (let g = 1; g <= 11; g++) {
    const name = g <= 10 ? `Խումբ ${g}` : '🧠 Հոգեբանական թեստեր';
    const s = stats.groups[g];
    const acc = s && s.t > 0 ? Math.round((s.c / s.t) * 100) : null;
    const accCls = acc === null ? '' : acc >= 80 ? 'good' : acc >= 60 ? 'mid' : 'low';
    topics += `
      <button class="topic-card" onclick="startTopic(${g})">
        <span style="flex:1">
          <span class="name">${name}</span>
          <span class="desc" style="display:block">${esc(GROUP_INFO[g])}</span>
          ${acc !== null ? `<span class="tprog"><span class="${accCls}" style="width:${acc}%"></span></span>` : ''}
        </span>
        <span style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">
          <span class="count">${counts[g] || 0} հարց</span>
          ${acc !== null ? `<span class="acc ${accCls}">${acc}%</span>` : ''}
        </span>
      </button>`;
  }

  const achHtml = ACHIEVEMENTS.map(a => `
    <div class="ach-card ${achievements[a.id] ? 'unlocked' : 'locked'}">
      <div class="ach-emoji">${a.emoji}</div>
      <div class="ach-name">${a.name}</div>
      <div class="ach-desc">${a.desc}</div>
    </div>`).join('');

  const streakChip = streak.count > 0
    ? `<span class="streak-chip">🔥 ${streak.count} օր անըդմեջ</span>` : '';

  app.innerHTML = `
    <div class="container">
      <header class="home-header">
        <span class="badge">A · B · C կարգեր</span>
        ${streakChip}
        <h1>Վարորդական քննության հարցաշար</h1>
        <p>Պաշտոնական ${QUESTIONS.length} հարց roadpolice.am-ից · սովորիր խելացի ռեժիմներով</p>
      </header>
      <div class="big-actions">${actions}</div>
      <div class="section-title">Թեմաներ ըստ խմբերի</div>
      <div class="topics">${topics}</div>
      <div class="section-title" style="margin-top:30px">🏅 Ձեռքբերումներ</div>
      <div class="ach-grid">${achHtml}</div>
      <div class="footer">Հարցերը՝ roadpolice.am պաշտոնական հարցաշարից (A, B, C կարգեր) · Հոգեբանական թեստերը՝ varord.am-ից</div>
    </div>`;
}

function startTopic(group) {
  state.pending = { type: 'topic', group };
  state.screen = 'order';
  render();
}

function startAll() {
  state.pending = { type: 'all' };
  state.screen = 'order';
  render();
}

function startMistakes() {
  state.pending = { type: 'mistakes' };
  state.screen = 'order';
  render();
}

function startWeak() {
  state.pending = { type: 'weak' };
  state.screen = 'order';
  render();
}

function startReview() {
  state.pending = { type: 'review' };
  state.screen = 'order';
  render();
}

function pendingInfo(p) {
  if (p.type === 'all') return { title: 'Բոլոր հարցերը', list: QUESTIONS };
  if (p.type === 'topic') {
    return { title: groupTitle(p.group), list: TOPIC_QUESTIONS.filter(q => q.group === p.group) };
  }
  if (p.type === 'mistakes') {
    return { title: 'Իմ սխալները', list: mistakes.map(k => QMAP[k]).filter(Boolean) };
  }
  if (p.type === 'weak') {
    const weak = weakGroups();
    return { title: 'Թույլ թեմաներ', list: TOPIC_QUESTIONS.filter(q => weak.includes(q.group)) };
  }
  // review
  return { title: 'Վերանայում', list: TOPIC_QUESTIONS };
}

function renderOrder() {
  const p = state.pending;
  const info = pendingInfo(p);

  app.innerHTML = `
    <div class="container">
      <div class="topbar">
        <div class="topbar-row">
          <button class="quit-btn" onclick="quitQuiz()">← Հետ</button>
        </div>
      </div>
      <header class="home-header">
        <h1>${esc(info.title)}</h1>
        <p>${info.list.length} հարց · ընտրիր հարցերի կարգը</p>
      </header>
      <div class="big-actions">
        <button class="big-btn exam" onclick="startWithOrder(true)">
          <span class="t">🔀 Խառը հարցերով</span>
          <span class="s">Հարցերը պատահական կարգով</span>
        </button>
        <button class="big-btn all" onclick="startWithOrder(false)">
          <span class="t">🔢 Կարգով</span>
          <span class="s">Հարցերը հաջորդական՝ № 1-ից սկսած</span>
        </button>
      </div>
    </div>`;
}

function startWithOrder(shuffled) {
  const p = state.pending;
  const info = pendingInfo(p);
  const questions = shuffled ? shuffle(info.list) : info.list.slice();
  const mode = p.type === 'review' ? 'review' : 'practice';
  state.config = { title: info.title, questions, mode, ordered: !shuffled };
  state.retry = () => startWithOrder(shuffled);
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

function startMarathon() {
  state.config = {
    title: 'Մարաթոն',
    questions: shuffle(QUESTIONS),
    mode: 'marathon',
  };
  state.retry = startMarathon;
  beginQuiz();
}

function startBlitz() {
  state.config = {
    title: 'Բլից',
    questions: shuffle(QUESTIONS),
    mode: 'blitz',
    perQuestionSec: BLITZ_SEC,
  };
  state.retry = startBlitz;
  beginQuiz();
}

function beginQuiz() {
  state.screen = 'quiz';
  state.index = 0;
  state.picked = null;
  state.records = [];
  state.timeLeft = state.config.timeLimitSec || 0;
  state.qTimeLeft = state.config.perQuestionSec || 0;
  state.blitzOut = false;
  state.examCounted = false;
  touchStreak();
  render();
}

function renderQuiz() {
  const { questions, mode, timeLimitSec, perQuestionSec } = state.config;
  const q = questions[state.index];
  const isExam = mode === 'exam';
  const isBlitz = mode === 'blitz';
  const isMarathon = mode === 'marathon';
  const isReview = mode === 'review';
  const answered = state.picked !== null || (isBlitz && state.blitzOut);
  const correctCount = state.records.filter(r => r.correct).length;
  const progress = Math.round(((state.index + (answered ? 1 : 0)) / questions.length) * 100);

  let statsHtml = '';
  if (isMarathon) {
    statsHtml += `<span class="pill ok">🏃 ${correctCount} անըդմեջ</span>
                  <span class="pill">ռեկորդ ${stats.bestMarathon}</span>`;
  } else if (!isExam && !isReview) {
    statsHtml += `<span class="pill ok">✓ ${correctCount}</span>
                  <span class="pill bad">✗ ${state.records.length - correctCount}</span>`;
  }
  if (isExam && timeLimitSec) {
    statsHtml += `<span class="pill timer ${state.timeLeft < 60 ? 'warn' : ''}" id="timerPill">⏱ ${fmtTime(state.timeLeft)}</span>`;
  }
  if (isBlitz && !answered) {
    statsHtml += `<span class="pill timer ${state.qTimeLeft <= 3 ? 'warn' : ''}" id="qTimerPill">⚡ ${state.qTimeLeft}</span>`;
  }
  if (!isMarathon) {
    statsHtml += `<span class="pill">Հարց ${state.index + 1} / ${questions.length}</span>`;
  }

  const imgs = q.images.map(src =>
    `<img src="${esc(src)}" alt="հարցի նկար" loading="lazy">`).join('');

  const opts = q.options.map((opt, i) => {
    const n = i + 1;
    const isPicked = state.picked === n;
    const isAnswer = q.answer === n;
    const showResult = (answered && !isExam) || isReview;
    let cls = 'opt';
    if (showResult && isAnswer) cls += ' correct';
    if (showResult && isPicked && !isAnswer) cls += ' wrong';
    if (isExam && isPicked) cls += ' picked';
    const mark = showResult && isAnswer ? '<span class="mark">✓</span>'
      : showResult && isPicked && !isAnswer ? '<span class="mark">✗</span>' : '';
    const disabled = (answered && !isExam) || isReview;
    return `
      <button class="${cls}" onclick="pick(${n})" ${disabled ? 'disabled' : ''}>
        <span class="num">${n}</span>
        <span class="txt">${esc(opt)}</span>
        ${mark}
      </button>`;
  }).join('');

  let footer = '';
  if (isReview) {
    const last = state.index + 1 >= questions.length;
    footer = `
      <div class="qfooter" style="justify-content:flex-end">
        <button class="btn" onclick="nextReview()">${last ? '🏁 Ավարտել' : 'Հաջորդ հարցը →'}</button>
      </div>`;
  } else if (answered && !isExam) {
    const ok = state.picked === q.answer;
    const explText = q.expl || (typeof EXPL !== 'undefined' ? EXPL[qkey(q)] : null);
    const expl = explText ? `<div class="expl">💡 ${esc(explText)}</div>` : '';
    if (isBlitz) {
      footer = `
        <div class="qfooter">
          <span class="verdict ${ok ? 'ok' : 'bad'}">
            ${ok ? 'Ճիշտ է ✓' : 'Սխալ է · ճիշտ պատասխանը՝ ' + q.answer}
          </span>
        </div>${expl}`;
    } else if (isMarathon) {
      footer = `
        <div class="qfooter">
          <span class="verdict ${ok ? 'ok' : 'bad'}">
            ${ok ? 'Ճիշտ է ✓ Շարունակի՛ր' : '💥 Մարաթոնն ավարտված է · ճիշտը՝ ' + q.answer}
          </span>
          <button class="btn" onclick="next()">${ok ? 'Հաջորդ հարցը →' : '🏁 Տեսնել արդյունքը'}</button>
        </div>${expl}`;
    } else {
      const last = state.index + 1 >= questions.length;
      footer = `
        <div class="qfooter">
          <span class="verdict ${ok ? 'ok' : 'bad'}">
            ${ok ? 'Ճիշտ է ✓' : 'Սխալ է · ճիշտ պատասխանը՝ ' + q.answer}
          </span>
          <button class="btn" onclick="next()">${last ? 'Տեսնել արդյունքը 🏁' : 'Հաջորդ հարցը →'}</button>
        </div>${expl}`;
    }
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
          <div class="stats">${statsHtml}</div>
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
    state.timerId = setInterval(() => {
      state.timeLeft--;
      const pill = document.getElementById('timerPill');
      if (pill) {
        pill.textContent = '⏱ ' + fmtTime(Math.max(0, state.timeLeft));
        if (state.timeLeft < 60) pill.classList.add('warn');
      }
      if (state.timeLeft <= 0) {
        clearTimers();
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

  if (isBlitz && !answered) {
    state.qTimerId = setInterval(() => {
      state.qTimeLeft--;
      const pill = document.getElementById('qTimerPill');
      if (pill) {
        pill.textContent = '⚡ ' + Math.max(0, state.qTimeLeft);
        if (state.qTimeLeft <= 3) pill.classList.add('warn');
      }
      if (state.qTimeLeft <= 0) {
        if (state.qTimerId) { clearInterval(state.qTimerId); state.qTimerId = null; }
        if (state.screen !== 'quiz' || state.picked !== null) return;
        state.blitzOut = true;
        renderQuiz();
        state.advanceId = setTimeout(() => recordAndNext(null), 1400);
      }
    }, 1000);
  }
}

function pick(n) {
  if (state.picked !== null || state.blitzOut) return;
  const mode = state.config.mode;
  if (mode === 'review') return;
  state.picked = n;
  if (mode === 'exam') {
    renderQuiz(); // show selection
    setTimeout(() => { recordAndNext(n); }, 350);
  } else if (mode === 'blitz') {
    if (state.qTimerId) { clearInterval(state.qTimerId); state.qTimerId = null; }
    renderQuiz();
    state.advanceId = setTimeout(() => { recordAndNext(n); }, 900);
  } else {
    renderQuiz();
  }
}

function recordAndNext(choice) {
  if (state.screen !== 'quiz') return;
  if (state.advanceId) { clearTimeout(state.advanceId); state.advanceId = null; }
  const q = state.config.questions[state.index];
  const mode = state.config.mode;
  const correct = choice === q.answer;

  if (mode !== 'review') {
    state.records.push({ question: q, picked: choice, correct });
    bumpStats(q, correct);
    if (correct) removeMistake(q); else addMistake(q);

    if (mode === 'marathon') {
      const run = state.records.filter(r => r.correct).length;
      if (!correct) {
        if (run > stats.bestMarathon) {
          stats.bestMarathon = run;
          save('roudexam.stats', stats);
        }
        checkAchievements();
        state.screen = 'results';
        render();
        return;
      }
    }
    checkAchievements();
  }

  if (state.index + 1 >= state.config.questions.length) {
    state.screen = 'results';
    render();
  } else {
    state.index++;
    state.picked = null;
    state.blitzOut = false;
    state.qTimeLeft = state.config.perQuestionSec || 0;
    renderQuiz();
  }
}

function next() { recordAndNext(state.picked); }

function nextReview() {
  if (state.index + 1 >= state.config.questions.length) {
    quitQuiz();
  } else {
    state.index++;
    renderQuiz();
  }
}

function finishEarly() {
  state.screen = 'results';
  render();
}

function quitQuiz() {
  state.screen = 'home';
  render();
}

function gradeOf(pct) {
  if (pct >= 90) return { label: 'Գերազանց', emoji: '🏆', cls: 'g-excellent' };
  if (pct >= 75) return { label: 'Լավ', emoji: '👍', cls: 'g-good' };
  if (pct >= 60) return { label: 'Բավարար', emoji: '🙂', cls: 'g-fair' };
  return { label: 'Անբավարար · պետք է կրկնել', emoji: '📖', cls: 'g-poor' };
}

// ---------- share result card ----------
function shareResult() {
  const records = state.records;
  const total = records.length;
  const correct = records.filter(r => r.correct).length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const wrong = records.filter(r => !r.correct && r.picked !== null).length;
  const skipped = total - correct - wrong;
  const isExam = state.config.mode === 'exam';
  const passed = isExam && wrong + skipped <= 2;
  const grade = gradeOf(pct);

  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const F = '-apple-system, "Noto Sans Armenian", "Segoe UI", sans-serif';

  function rr(px, py, w, h, r) {
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
  }

  // ֆոն
  const bg = x.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b0e16');
  bg.addColorStop(1, '#131a2b');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  const g1 = x.createRadialGradient(W * .85, H * .06, 0, W * .85, H * .06, 620);
  g1.addColorStop(0, 'rgba(106,61,240,.35)');
  g1.addColorStop(1, 'rgba(106,61,240,0)');
  x.fillStyle = g1;
  x.fillRect(0, 0, W, H);
  const g2 = x.createRadialGradient(W * .08, H * .98, 0, W * .08, H * .98, 620);
  g2.addColorStop(0, 'rgba(36,86,224,.35)');
  g2.addColorStop(1, 'rgba(36,86,224,0)');
  x.fillStyle = g2;
  x.fillRect(0, 0, W, H);

  x.textAlign = 'center';
  x.textBaseline = 'alphabetic';

  // վերնագիվ badge
  x.font = '700 32px ' + F;
  x.fillStyle = 'rgba(255,255,255,.72)';
  x.fillText('ՎԱՐՈՐԴԱԿԱՆ ՔՆՆՈՒԹՅՈՒՆ · A·B·C ԿԱՐԳԵՐ', W / 2, 110);

  // լուսացույց (կանաչ՝ վառ)
  const lw = 150, lh = 330, lx = W / 2 - lw / 2, ly = 175;
  x.fillStyle = 'rgba(23,28,40,.92)';
  rr(lx, ly, lw, lh, 40); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.12)';
  x.lineWidth = 3;
  rr(lx, ly, lw, lh, 40); x.stroke();
  const cols = ['#2a3244', '#2a3244', '#22c55e'];
  for (let i = 0; i < 3; i++) {
    const cy = ly + 80 + i * 85;
    x.beginPath();
    x.arc(W / 2, cy, 32, 0, Math.PI * 2);
    if (i === 2) {
      x.shadowColor = 'rgba(34,197,94,.85)';
      x.shadowBlur = 42;
    }
    x.fillStyle = cols[i];
    x.fill();
    x.shadowBlur = 0;
  }

  // գնահատական
  const label = isExam
    ? (passed ? '✅ ՔՆՆՈՒԹՅՈՒՆԸ ՀԱՆձՆԱԾ Է' : '❌ ՔՆՆՈՒԹՅՈՒՆԸ ՉԻ ՀԱՆձՆԱԾ')
    : grade.emoji + ' ' + grade.label;
  const col = isExam ? (passed ? '#22c55e' : '#dc2626')
    : (pct >= 90 ? '#22c55e' : pct >= 75 ? '#7c9bff' : pct >= 60 ? '#d97706' : '#dc2626');
  x.font = '800 54px ' + F;
  x.fillStyle = col;
  x.fillText(label, W / 2, 645);

  // հիմնական արդյունք
  x.font = '800 175px ' + F;
  x.fillStyle = '#ffffff';
  x.fillText(correct + '/' + total, W / 2, 845);
  x.font = '700 48px ' + F;
  x.fillStyle = 'rgba(255,255,255,.75)';
  x.fillText(pct + '% ճիշտ', W / 2, 925);

  // պրոգրես-գոտի
  const bw = 640, bh = 26, bx = W / 2 - bw / 2, by = 960;
  x.fillStyle = 'rgba(255,255,255,.10)';
  rr(bx, by, bw, bh, 13); x.fill();
  if (pct > 0) {
    const fg = x.createLinearGradient(bx, 0, bx + bw, 0);
    fg.addColorStop(0, '#2456e0');
    fg.addColorStop(1, '#6a3df0');
    x.fillStyle = fg;
    rr(bx, by, Math.max(bh, bw * pct / 100), bh, 13); x.fill();
  }

  // մանրամասներ
  x.font = '600 34px ' + F;
  x.fillStyle = 'rgba(255,255,255,.65)';
  let det = '✓ ' + correct + ' ճիշտ · ✗ ' + wrong + ' սխալ';
  if (skipped) det += ' · − ' + skipped + ' չպատասխանած';
  x.fillText(det, W / 2, 1060);

  // ամսաթիվ (ձեռքով՝ որ չկախված լինի սարքի լոկալից)
  const MN = ['հունվարի', 'փետրվարի', 'մարտի', 'ապրիլի', 'մայիսի', 'հունիսի',
    'հուլիսի', 'օգոստոսի', 'սեպտեմբերի', 'հոկտեմբերի', 'նոյեմբերի', 'դեկտեմբերի'];
  const d = new Date();
  const dstr = d.getDate() + ' ' + MN[d.getMonth()] + ' ' + d.getFullYear() + ' թ.';
  x.font = '500 30px ' + F;
  x.fillStyle = 'rgba(255,255,255,.45)';
  x.fillText(dstr, W / 2, 1130);
  x.fillText('Լուսի · roadpolice.am հարցաշար', W / 2, 1185);

  // ճանապարհ + մեքենա
  const ry = H - 90;
  x.fillStyle = '#10141f';
  x.fillRect(0, ry, W, 90);
  x.strokeStyle = 'rgba(251,191,36,.85)';
  x.lineWidth = 5;
  x.setLineDash([36, 30]);
  x.beginPath();
  x.moveTo(0, ry + 45);
  x.lineTo(W, ry + 45);
  x.stroke();
  x.setLineDash([]);
  x.font = '58px serif';
  x.fillText('🚗', W - 150, ry + 63);

  // կիսում կամ ներբեռնում
  cv.toBlob((blob) => {
    if (!blob) return;
    const file = new File([blob], 'roudexam-result.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Քննության արդյունք', text: 'Իմ արդյունքը՝ ' + correct + '/' + total + ' (' + pct + '%)' }).catch(() => { });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'roudexam-result.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('📥 Պատկերը ներբեռնվեց');
    }
  }, 'image/png');

  return cv;
}

function renderResults() {
  const records = state.records;
  const total = records.length;
  const correct = records.filter(r => r.correct).length;
  const wrong = records.filter(r => !r.correct && r.picked !== null);
  const skipped = records.filter(r => r.picked === null);
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const grade = gradeOf(pct);
  const isExam = state.config.mode === 'exam';
  const isMarathon = state.config.mode === 'marathon';
  const examPassed = wrong.length + skipped.length <= 2;

  if (isExam && !state.examCounted) {
    state.examCounted = true;
    stats.examsTaken++;
    if (examPassed) stats.examsPassed++;
    save('roudexam.stats', stats);
    if (examPassed && wrong.length + skipped.length === 0) unlock('perfectExam');
    checkAchievements();
  }

  const mistakesHtml = wrong.map((r) => {
    const q = r.question;
    const imgs = q.images.map(src => `<img src="${esc(src)}" alt="" loading="lazy">`).join('');
    const explText = q.expl || (typeof EXPL !== 'undefined' ? EXPL[qkey(q)] : null);
    return `
      <div class="mistake-card">
        <div class="qmeta">Խումբ ${q.group} · Հարց ${q.num}</div>
        <div class="mq">${esc(q.q)}</div>
        ${imgs ? `<div class="qimages">${imgs}</div>` : ''}
        <div class="mrow bad">✗ Քո պատասխանը՝ ${r.picked}. ${esc(q.options[r.picked - 1] || '')}</div>
        <div class="mrow ok">✓ Ճիշտը՝ ${q.answer}. ${esc(q.options[q.answer - 1])}</div>
        ${explText ? `<div class="expl">💡 ${esc(explText)}</div>` : ''}
      </div>`;
  }).join('');

  let head = '';
  if (isExam) {
    head = `<div class="grade-badge ${examPassed ? 'g-excellent' : 'g-poor'}">${examPassed ? '✅ Քննությունը հանձնած է' : '❌ Քննությունը չի հանձնած'}</div>
            <div class="grade-note">Անցողիկ չափանիշ՝ առավելագույնը 2 սխալ</div>`;
  } else if (isMarathon) {
    const isRecord = correct >= stats.bestMarathon && correct > 0;
    head = `<div class="grade-badge ${correct > 0 ? 'g-excellent' : 'g-poor'}">🏃 ${correct} ճիշտ անըդմեջ${isRecord ? ' · Նոր ռեկո՛րդ' : ''}</div>
            <div class="grade-note">Լավագույն արդյունք՝ ${stats.bestMarathon}</div>`;
  } else {
    head = `<div class="grade-badge ${grade.cls}">${grade.emoji} ${grade.label}</div>`;
  }

  app.innerHTML = `
    <div class="container">
      <header class="home-header" style="padding-bottom:14px">
        <h1 style="font-size:clamp(20px,4.5vw,28px)">Արդյունք · ${esc(state.config.title)}</h1>
      </header>
      <div class="result-card">
        ${head}
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
          ${wrong.length ? '<button class="btn ghost" onclick="startMistakes()">📕 Կրկնել սխալները</button>' : ''}
          ${isExam ? '<button class="btn ghost" onclick="shareResult()">📤 Կիսվել</button>' : ''}
          <button class="btn ghost" onclick="quitQuiz()">🏠 Գլխավոր էջ</button>
        </div>
      </div>
      ${wrong.length ? `<div class="mistakes-title">Սխալները (${wrong.length})</div>${mistakesHtml}` : ''}
    </div>`;
}

// ---------- keyboard ----------
document.addEventListener('keydown', (e) => {
  if (state.screen !== 'quiz') return;
  if (e.key >= '1' && e.key <= '9') {
    pick(Number(e.key));
  } else if (e.key === 'Enter') {
    const btn = document.querySelector('.qfooter .btn');
    if (btn) btn.click();
  }
});

// expose for inline handlers
window.startTopic = startTopic;
window.startAll = startAll;
window.startWithOrder = startWithOrder;
window.startExam = startExam;
window.startMarathon = startMarathon;
window.startBlitz = startBlitz;
window.startReview = startReview;
window.startMistakes = startMistakes;
window.startWeak = startWeak;
window.shareResult = shareResult;
window.pick = pick;
window.next = next;
window.nextReview = nextReview;
window.finishEarly = finishEarly;
window.quitQuiz = quitQuiz;
window.state = state;

render();

// ---------- welcome splash ----------
(function initSplash() {
  const el = document.getElementById('splash');
  if (!el) return;
  document.body.classList.add('no-scroll');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.classList.add('hide');
    document.body.classList.remove('no-scroll');
    setTimeout(() => el.remove(), 700);
  };
  el.addEventListener('click', close);
  // #splash hash-ով բացելիս էկրանը չի փակվում ավտոմատ (դիտելու համար)
  if (location.hash !== '#splash') setTimeout(close, 3800);
})();
