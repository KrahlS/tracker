import * as store from './store.js';
import * as C from './calc.js';
import { PROGRAM, ROTATION, MAIN_LIFTS, QUOTES, EXAMS, SEED_EXAMS, SEED_CARS, SEED_WEIGHTS, MCAT_KEY_DATES, DEFAULT_SETTINGS } from './data.js';
import { renderIcon, ICON_NAMES } from './icons.js';
import { renderPlan, handlePlan, todaysBlocks, todaysEvents, planSettings, clock as clk } from './planner.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const fmt = (n, d = 1) => n == null ? '—' : (Math.round(n * 10 ** d) / 10 ** d).toString();
const CHECK = '<svg><use href="#i-check"/></svg>';

const ui = { view: 'today', date: C.today(), liftDay: null, liftDate: C.today(), repEdit: {}, pendingRender: false };

// ---------- seed starter data from the old spreadsheets ----------
function seedAll() {
  const days = {};
  for (const [d, w] of SEED_WEIGHTS) (days[d] ||= {}).weight = w;
  for (const [d, sec, q, c] of SEED_CARS) Object.assign(days[d] ||= {}, { cars: true, carsQ: q, carsC: c, carsT: sec });
  for (const [d, v] of Object.entries(days)) store.seed('day:' + d, v);
  store.seed('exams', SEED_EXAMS);
}

// ---------- toast ----------
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
export { toast, esc };

// ---------- charts ----------
function chart({ series, wide = false, h = 200, xFmt, xTicks, yFmt = v => fmt(v, 0), yMin, yMax, xMin, xMax }) {
  // size the viewBox to the real card width so text stays the same size on every screen
  const vw = window.innerWidth, inner = Math.min(vw, 1180) - 64;
  const w = Math.round(Math.max(280, wide || vw < 760 ? inner : inner / 2 - 6));
  const pts = series.flatMap(s => s.pts);
  if (!pts.length) return '<p class="muted small">Nothing logged yet.</p>';
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  let x0 = xMin ?? Math.min(...xs), x1 = xMax ?? Math.max(...xs);
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  let y0 = yMin ?? Math.min(...ys), y1 = yMax ?? Math.max(...ys);
  const pad = (y1 - y0) * 0.12 || 2; if (yMin == null) y0 -= pad; if (yMax == null) y1 += pad;
  const L = 34, R = 8, T = 8, B = 20;
  const X = x => L + (x - x0) / (x1 - x0) * (w - L - R), Y = y => T + (1 - (y - y0) / (y1 - y0)) * (h - T - B);
  let g = '<g class="grid">';
  for (let i = 0; i <= 4; i++) { const v = y0 + (y1 - y0) * i / 4; g += `<line x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${yFmt(v)}</text>`; }
  const ticks = w < 500 ? 3 : 5;
  const tv = xTicks || Array.from({ length: ticks + 1 }, (_, i) => x0 + (x1 - x0) * i / ticks);
  let prevLabel = null;
  tv.forEach((v, i) => {
    const label = xFmt ? xFmt(v) : fmt(v, 0);
    if (label === prevLabel) return;
    prevLabel = label;
    g += `<text x="${X(v)}" y="${h - 4}" text-anchor="${v === x0 ? 'start' : v === x1 ? 'end' : 'middle'}">${esc(label)}</text>`;
  });
  g += '</g>';
  let body = '';
  for (const s of series) {
    if (!s.pts.length) continue;
    const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    if (s.area) body += `<path class="area" d="${d}L${X(s.pts.at(-1)[0])},${h - B}L${X(s.pts[0][0])},${h - B}Z"/>`;
    if (s.line !== false) body += `<path class="${s.cls || 'ln'}" d="${d}"/>`;
    if (s.dots) for (const p of s.pts) body += `<rect class="pt ${s.dots === 'solid' ? 'solid' : ''}" x="${X(p[0]) - 2.5}" y="${Y(p[1]) - 2.5}" width="5" height="5"><title>${p[2] ?? fmt(p[1])}</title></rect>`;
  }
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">${g}${body}</svg>`;
}
const dayNum = d => C.diffDays(d, '2026-01-01');
const dayLabel = n => C.fmtDate(C.addDays('2026-01-01', Math.round(n)), { month: 'short', day: 'numeric' });

// ---------- TODAY ----------
function dayStatus(date) {
  const d = C.dayDoc(date), p = C.phaseInfo(date);
  const dietOk = d.kcal != null && d.protein != null && d.kcal <= p.kcal && d.protein >= p.protein;
  const items = [d.weight != null, dietOk, ...C.MCAT_ITEMS.map(([k]) => !!d[k])];
  const n = items.filter(Boolean).length;
  return { n, of: items.length };
}

function renderToday() {
  const s = C.settings(), date = ui.date, t = C.today();
  const d = C.dayDoc(date), p = C.phaseInfo(date, s);
  const doy = C.dayOfYear(date) + Number(date.slice(0, 4)) * 7;
  const quote = QUOTES[doy % QUOTES.length];
  const icon = ICON_NAMES[(doy * 7) % ICON_NAMES.length];
  const task = C.mcatTask(date, s);
  const toMcat = C.diffDays(s.mcatDate, date);
  const ws = C.weights(), a7 = C.avg7(date, ws);
  const liftWeek = p.week;

  // diet
  const kc = d.kcal ?? null, pr = d.protein ?? null;
  const kPct = kc == null ? 0 : Math.min(100, kc / p.kcal * 100), pPct = pr == null ? 0 : Math.min(100, pr / p.protein * 100);
  const kcOk = kc != null && kc <= p.kcal, prOk = pr != null && pr >= p.protein;

  // lift
  const todays = C.sessions().filter(x => x.date === date);
  const next = C.nextDay();

  // streak dots (last 14 days ending at viewed date)
  let dots = '';
  for (let i = 13; i >= 0; i--) {
    const dd = C.addDays(date, -i), st = dayStatus(dd);
    dots += `<i class="${st.n === st.of ? 'full' : st.n ? 'half' : ''} ${i === 0 ? 'today' : ''}" title="${dd}: ${st.n}/${st.of}"></i>`;
  }
  const st = dayStatus(date);

  $('#v-today').innerHTML = `
  <div class="card hero">
    <canvas id="heroicon" width="72" height="72" aria-hidden="true"></canvas>
    <div>
      <div class="tiny">${esc(C.fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' }))}</div>
      <div class="quote">${esc(quote)}</div>
      <div class="meta">
        <span><b>${C.PHASE_LABEL[p.phase]}</b> wk ${Math.max(1, liftWeek)}</span>
        ${p.deload ? '<span><b>Deload week</b></span>' : ''}
        <span>MCAT wk <b>${task.week}</b></span>
        <span><b>${toMcat}</b> days to test</span>
        <span>Target <b>${fmt(p.target)}</b> lb</span>
      </div>
    </div>
  </div>

  <div class="datebar">
    <button class="btn icon ghost" data-act="day-prev" aria-label="Previous day">‹</button>
    <span class="d ${date !== t ? 'past' : ''}">${date === t ? 'Today' : esc(C.fmtDate(date))}</span>
    <button class="btn icon ghost" data-act="day-next" aria-label="Next day" ${date >= t ? 'disabled' : ''}>›</button>
    ${date !== t ? '<button class="btn sm ghost" data-act="day-today">Jump to today</button>' : ''}
    <span class="spacer"></span>
    <span class="tiny">${st.n}/${st.of} done</span>
  </div>

  <div class="grid two three-lg">
    <div class="card">
      <h2>Weigh-in <span class="right">${a7 ? '7-day ' + fmt(a7) : ''}</span></h2>
      <div class="row">
        <input class="bigin" type="number" inputmode="decimal" step="0.1" placeholder="—" value="${d.weight ?? ''}" data-field="weight" aria-label="Weight in pounds">
        <span class="muted">lb</span>
      </div>
      <div class="small muted" style="margin-top:8px">
        Target ${fmt(p.target)} · ${a7 != null ? `avg is ${a7 - p.target > 0 ? '+' : ''}${fmt(a7 - p.target)} vs target` : 'log to start your average'}
      </div>
      <div class="verdict">${a7 == null ? '' : Math.abs(a7 - p.target) <= 1 ? '<span class="pill ok">On track</span>' : a7 > p.target ? '<span class="pill bad">Above target</span>' : '<span class="pill ok">Ahead</span>'}</div>
      <div class="tiny" style="margin-top:12px">Judge the 7-day trend, never one weigh-in.</div>
      <hr>
      <div class="row between">
        <label class="field"><label>Bedtime last night</label><input type="time" value="${d.bedtime ?? ''}" data-field="bedtime" data-text style="font-size:16px"></label>
        ${sleepNote(d)}
      </div>
    </div>

    <div class="card">
      <h2>Diet <span class="right">${C.PHASE_LABEL[p.phase]}</span></h2>
      <div class="row between">
        <div class="field"><label>Calories</label><input type="number" inputmode="numeric" style="width:110px;font-size:24px" value="${kc ?? ''}" placeholder="0" data-field="kcal"></div>
        <div class="field" style="text-align:right"><label>/ ${p.kcal}</label><span class="tiny">${kc != null ? (p.kcal - kc >= 0 ? (p.kcal - kc) + ' left' : (kc - p.kcal) + ' over') : ''}</span></div>
      </div>
      <div class="meter ${kc > p.kcal ? 'over' : ''}"><span style="width:${kPct}%"></span></div>
      <div class="row between" style="margin-top:12px">
        <div class="field"><label>Protein (g)</label><input type="number" inputmode="numeric" style="width:110px;font-size:24px" value="${pr ?? ''}" placeholder="0" data-field="protein"></div>
        <div class="field" style="text-align:right"><label>/ ${p.protein} g</label><span class="tiny">${pr != null ? (p.protein - pr > 0 ? (p.protein - pr) + ' to go' : 'hit') : ''}</span></div>
      </div>
      <div class="meter"><span style="width:${pPct}%"></span></div>
      <div class="verdict">
        <span class="pill ${kc == null ? '' : kcOk ? 'ok' : 'bad'}">${kc == null ? 'Calories —' : kcOk ? 'Under calories' : 'Over calories'}</span>
        <span class="pill ${pr == null ? '' : prOk ? 'ok' : 'bad'}">${pr == null ? 'Protein —' : prOk ? 'Protein hit' : 'Protein short'}</span>
      </div>
      <div class="chips">
        ${s.meals.map((m, i) => `<button class="btn sm ghost" data-act="meal" data-i="${i}">+ ${esc(m.name)} <span class="muted">${m.kcal}/${m.protein}g</span></button>`).join('')}
      </div>
      <div class="row" style="margin-top:10px">
        <input type="number" inputmode="numeric" placeholder="kcal" id="addk" style="width:70px;font-size:14px">
        <input type="number" inputmode="numeric" placeholder="protein" id="addp" style="width:70px;font-size:14px">
        <button class="btn sm" data-act="addfood">Add</button>
      </div>
    </div>

    <div class="card">
      <h2>MCAT <span class="right">Wk ${task.week}</span></h2>
      ${mcatChecks(date, d, task, s)}
    </div>

    <div class="card">
      <h2>Training <span class="right">${p.deload ? 'Deload' : 'Wk ' + Math.max(1, liftWeek)}</span></h2>
      ${todays.length ? todays.map(x => `
        <div class="row between"><div><b>${PROGRAM[x.day].name}</b><div class="small muted">${PROGRAM[x.day].focus}</div></div>
        <span class="pill ${x.done ? 'ok' : ''}">${x.done ? 'Done' : 'In progress'}</span></div>
        <div style="margin-top:10px"><button class="btn" data-act="openlift" data-day="${x.day}">${x.done ? 'View' : 'Continue'}</button></div>`).join('<hr>')
      : `<div class="small muted">Next in rotation</div>
        <div style="font:28px/1.1 var(--goth);margin:4px 0">${PROGRAM[next].name}</div>
        <div class="small muted">${PROGRAM[next].focus} · ${PROGRAM[next].ex.length} exercises</div>
        <div class="row" style="margin-top:12px"><button class="btn solid" data-act="openlift" data-day="${next}">Start workout</button></div>`}
    </div>

    ${blocksCard(date)}
    <div class="card span2">
      <h2>Last 14 days <span class="right">${C.streak(date, x => { const q = dayStatus(x); return q.n === q.of; })}-day perfect streak</span></h2>
      <div class="dots">${dots}</div>
      <div class="legend" style="margin-top:8px"><span>■ all done</span><span>▨ partial</span><span>□ nothing</span></div>
    </div>
  </div>`;
  const cv = $('#heroicon');
  const css = getComputedStyle(document.documentElement);
  renderIcon(cv, icon, css.getPropertyValue('--ink').trim(), css.getPropertyValue('--panel').trim(), doy);
}

// Hours between logged bedtime and the planner's day start, flagged when it's a short night.
function sleepNote(d) {
  if (!d.bedtime) return '<span class="tiny">log it after a late night</span>';
  const [h, m] = d.bedtime.split(':').map(Number), bed = h < 12 ? h + m / 60 + 24 : h + m / 60;
  const ps = planSettings(), [sh, sm] = ps.start.split(':').map(Number);
  const hrs = sh + sm / 60 + 24 - bed;
  const wake = bed + ps.sleep - 24;
  if (bed * 60 <= hmToMin(ps.lateAfter) || wake <= sh + sm / 60) return `<span class="pill ok">${fmt(hrs)} h possible</span>`;
  return `<span class="pill bad">Late night: start after ${Math.floor(wake)}:${String(Math.round((wake % 1) * 60)).padStart(2, '0')}</span>`;
}
const hmToMin = t => { const [h, m] = t.split(':').map(Number); return (h < 12 ? h + 24 : h) * 60 + m; };

function blocksCard(date) {
  const b = todaysBlocks(date), ev = todaysEvents(date);
  if (!b && !ev?.length) return '';
  const clock = t => clk(new Date(t));
  const rows = [...(b || []).map(x => [x.allDay ? 0 : +new Date(x.start), `<div class="plan-ev"><span>${x.allDay ? 'all day' : clock(x.start) + '–' + clock(x.end)}</span><span>${esc(x.label)}</span></div>`]),
    ...(ev || []).map(x => [x.start, `<div class="plan-ev busy"><span>${clock(x.start)}–${clock(x.end)}</span><span>${esc(x.title || 'busy')}</span></div>`])]
    .sort((x, y) => x[0] - y[0]).map(x => x[1]);
  return `<div class="card"><h2>Schedule <span class="right">from Plan</span></h2>
    ${rows.length ? rows.join('') : '<p class="muted small">Nothing planned.</p>'}</div>`;
}

function mcatChecks(date, d, task, s) {
  const cars = s.mcatDate && date > '2026-12-13' ? 'AAMC CARS QBank' : 'Jack Westin daily passage';
  const items = {
    cars: [cars, `<div class="extra" data-stop>
      <label class="field"><span class="tiny">Qs</span><input type="number" inputmode="numeric" value="${d.carsQ ?? ''}" data-field="carsQ"></label>
      <label class="field"><span class="tiny">Correct</span><input type="number" inputmode="numeric" value="${d.carsC ?? ''}" data-field="carsC"></label>
      <label class="field"><span class="tiny">Time m:ss</span><input type="text" inputmode="numeric" placeholder="8:30" value="${d.carsT ? Math.floor(d.carsT / 60) + ':' + String(d.carsT % 60).padStart(2, '0') : ''}" data-field="carsT"></label></div>`],
    anki: ['All reviews due today', ''],
    ps: [`${s.psPagesTarget}-7 pages`, `<div class="extra" data-stop><label class="field"><span class="tiny">Pages</span><input type="number" inputmode="numeric" value="${d.psPages ?? ''}" data-field="psPages"></label></div>`],
    uw: [task.label + (task.exam ? ' · log scores in MCAT' : ''), task.exam ? '' : `<div class="extra" data-stop>
      <label class="field"><span class="tiny">Qs done</span><input type="number" inputmode="numeric" value="${d.uwQ ?? ''}" data-field="uwQ"></label>
      <label class="field"><span class="tiny">% correct</span><input type="number" inputmode="numeric" value="${d.uwPct ?? ''}" data-field="uwPct"></label></div>`],
  };
  const labels = { cars: 'CARS passage', anki: 'Anki', ps: 'Psych/Soc reading', uw: /rest|off|sleep|pray/i.test(task.label) ? 'Scheduled' : task.exam ? 'Practice exam' : 'UWorld / AAMC / review' };
  return C.MCAT_ITEMS.map(([k]) => `
    <div class="check ${d[k] ? 'done' : ''}" data-act="toggle" data-k="${k}">
      <span class="box">${CHECK}</span>
      <span class="t"><b>${labels[k]}</b><span class="sub">${esc(items[k][0])}</span>${items[k][1]}</span>
    </div>`).join('');
}

// ---------- LIFT ----------
function liftKey(date, day) { return `lift:${date}:${day}`; }
function liftSession(date, day) {
  const key = liftKey(date, day);
  const ex = store.get(key);
  if (ex) return { key, ...ex, saved: true };
  const p = C.phaseInfo(date);
  const out = { key, date, day, week: p.week, deload: p.deload, ex: {}, done: false, notes: '' };
  for (const e of PROGRAM[day].ex) {
    const sg = C.suggest(e, key);
    out.ex[e.id] = { w: p.deload ? C.deloadWeight(sg.w, e) : sg.w, reps: [] };
  }
  return out;
}
function saveSession(s) { const { key, saved, ...rest } = s; store.set(key, rest); }

function renderLift() {
  const date = ui.liftDate;
  const next = C.nextDay();
  const existing = C.sessions().filter(x => x.date === date);
  const day = ui.liftDay || existing[0]?.day || next;
  ui.liftDay = day;
  const s = liftSession(date, day);
  const prog = PROGRAM[day];
  const doneCount = C.sessions().filter(x => x.done).length;

  const exHtml = prog.ex.map(e => {
    const r = s.ex[e.id] || { w: e.start, reps: [] };
    const sg = C.suggest(e, s.key);
    const n = C.plannedSets(e, s.deload);
    const editing = ui.repEdit[e.id];
    let sets = '';
    for (let i = 0; i < n; i++) {
      const v = r.reps[i];
      sets += editing
        ? `<input type="number" inputmode="numeric" class="set" style="font-size:16px;text-align:center" value="${v ?? ''}" data-act="repin" data-ex="${e.id}" data-i="${i}">`
        : `<button class="set ${v == null ? '' : v >= e.reps ? 'hit' : 'short'}" data-act="rep" data-ex="${e.id}" data-i="${i}"><small>${i + 1}</small>${v ?? ''}</button>`;
    }
    return `<div class="ex ${e.main ? 'main' : ''}">
      <div class="ex-head"><b>${esc(e.name)}</b><span class="tag">${n}×${e.reps}${e.perLeg ? '/leg' : ''}${e.rpe ? ' @ RPE ' + e.rpe : ''}</span></div>
      ${e.note ? `<div class="why">${esc(e.note)}</div>` : ''}
      <div class="why">${s.deload ? 'Deload: 60% of ' + sg.w + ', half the sets.' : esc(sg.why)}</div>
      <div class="wt">
        <button class="btn icon ghost" data-act="wdown" data-ex="${e.id}">−</button>
        <input type="number" inputmode="decimal" step="any" value="${r.w}" data-act="w" data-ex="${e.id}" aria-label="Weight">
        <button class="btn icon ghost" data-act="wup" data-ex="${e.id}">+</button>
        <span class="tiny">${r.w === 0 ? 'bodyweight' : 'lb'}</span>
      </div>
      <div class="sets">${sets}</div>
      <div class="ex-foot">
        <button class="toggle ${r.hard ? 'on' : ''}" data-act="hard" data-ex="${e.id}">Felt hard (RPE 9+)</button>
        <button class="toggle ${editing ? 'on' : ''}" data-act="repedit" data-ex="${e.id}">Type reps</button>
      </div>
    </div>`;
  }).join('');

  // main lift progress
  const ss = C.sessions().filter(x => x.done && !x.deload);
  const mains = MAIN_LIFTS.map(([id, name]) => {
    const pts = ss.filter(x => x.ex?.[id] && x.ex[id].reps?.length).map(x => [dayNum(x.date), x.ex[id].w, `${x.date}: ${x.ex[id].w} lb`]);
    const best = ss.filter(x => x.ex?.[id]).map(x => Math.max(...(x.ex[id].reps || []).map(r => C.e1rm(x.ex[id].w, r)), 0));
    return `<div><div class="row between"><span class="tiny">${name}</span><span class="small">${pts.length ? pts.at(-1)[1] + ' lb' : '—'} <span class="muted">e1RM ${best.length ? fmt(Math.max(...best), 0) : '—'}</span></span></div>
      ${pts.length > 1 ? chart({ series: [{ pts, dots: 'solid' }], h: 110, xFmt: dayLabel }) : '<div class="small muted" style="padding:8px 0">Log two sessions to see a line.</div>'}</div>`;
  }).join('');

  const hist = C.sessions().filter(x => x.done).slice(-8).reverse();
  const isPR = x => MAIN_LIFTS.some(([id]) => { const v = C.sessionE1rm(x, id); return v > 0 && v > C.bestE1rm(id, x.key) && C.bestE1rm(id, x.key) > 0; });

  // metrics
  const t = C.today(), mon = C.mondayOf(t), done = C.sessions().filter(x => x.done);
  const thisWeek = done.filter(x => x.date >= mon).length;
  const recent = done.filter(x => x.date > C.addDays(t, -28));
  const hitTot = recent.reduce((a, x) => { const [h, n] = C.setsHit(x); return [a[0] + h, a[1] + n]; }, [0, 0]);
  let wkStreak = 0;
  for (let m = C.addDays(mon, thisWeek >= 4 ? 0 : -7); ; m = C.addDays(m, -7)) { if (done.filter(x => x.date >= m && x.date <= C.addDays(m, 6)).length >= 4) wkStreak++; else break; }
  const bw = C.avg7(t) || C.settings().startWeight;
  const prs = recent.filter(isPR).length;
  const rel = MAIN_LIFTS.map(([id, name]) => { const b = C.bestE1rm(id); return `<tr><td>${name}</td><td class="num">${b ? fmt(b, 0) : '—'}</td><td class="num">${b ? fmt(b / bw, 2) + '×' : '—'}</td></tr>`; }).join('');
  const prevSame = done.filter(x => x.day === day && x.key < s.key).at(-1);
  const [sHit, sTot] = C.setsHit(s), ton = C.tonnage(s);

  $('#v-lift').innerHTML = `
  <div class="stack">
    <div class="seg">${ROTATION.map(k => `<button class="${k === day ? 'active' : ''}" data-act="liftday" data-day="${k}">${PROGRAM[k].name}${k === next ? '<span class="nx">next</span>' : '<span class="nx">&nbsp;</span>'}</button>`).join('')}</div>
    <div class="row between">
      <div><div style="font:30px/1 var(--goth)">${prog.name}</div><div class="small muted">${prog.focus} · program wk ${Math.max(1, s.week)} · session ${doneCount + (s.done ? 0 : 1)}</div></div>
      <input type="date" value="${date}" data-act="liftdate" style="font-size:14px">
    </div>
    ${s.deload ? '<div class="banner">Deload week. Same exercises, 60% of working weight, half the sets. Recover.</div>' : ''}
    <div class="grid two">${exHtml}</div>
    <div class="card">
      <h2>Session notes <span class="right">${sHit}/${sTot} sets · ${Math.round(ton).toLocaleString()} lb moved${prevSame ? ` · last ${PROGRAM[day].name} ${Math.round(C.tonnage(prevSame)).toLocaleString()}` : ''}</span></h2>
      <textarea rows="2" style="width:100%;font-size:14px" placeholder="How it felt, machine settings, pain…" data-act="notes">${esc(s.notes || '')}</textarea>
      <div class="row" style="margin-top:10px">
        ${s.done ? `<span class="pill ok">Finished</span><button class="btn ghost sm" data-act="reopen">Reopen</button>` : `<button class="btn solid" data-act="finish">Finish workout</button>`}
        ${s.saved ? '<button class="btn ghost sm" data-act="discard">Delete session</button>' : ''}
      </div>
    </div>
    <div class="card">
      <h2>Lifting metrics</h2>
      <div class="grid three" style="gap:16px">
        <div class="row" style="gap:24px;align-items:flex-start">
          <div><div class="big">${thisWeek}<small>/ 4</small></div><div class="tiny">sessions this week</div></div>
          <div><div class="big">${wkStreak}</div><div class="tiny">full-week streak</div></div>
        </div>
        <div class="row" style="gap:24px;align-items:flex-start">
          <div><div class="big">${hitTot[1] ? Math.round(hitTot[0] / hitTot[1] * 100) : '—'}<small>%</small></div><div class="tiny">sets hit · 28 days</div></div>
          <div><div class="big">${prs}</div><div class="tiny">e1RM PRs · 28 days</div></div>
        </div>
        <div><table class="tbl"><tr><th>Best e1RM</th><th class="num">lb</th><th class="num">× BW</th></tr>${rel}</table></div>
      </div>
    </div>
    <div class="grid two">
      <div class="card"><h2>Main lifts</h2><div class="stack">${mains}</div></div>
      <div class="card"><h2>Recent sessions</h2>
        ${hist.length ? `<table class="tbl"><tr><th>Date</th><th>Day</th><th class="num">Wk</th><th class="num">Sets hit</th><th class="num">Volume</th></tr>
        ${hist.map(x => { const tot = PROGRAM[x.day].ex.reduce((a, e) => a + C.plannedSets(e, x.deload), 0); const hit = PROGRAM[x.day].ex.reduce((a, e) => a + (x.ex?.[e.id]?.reps || []).filter(r => r >= e.reps).length, 0); return `<tr><td>${C.fmtDate(x.date)}${isPR(x) ? ' <b title="e1RM PR">★</b>' : ''}</td><td>${PROGRAM[x.day].name}</td><td class="num">${x.week}</td><td class="num">${hit}/${tot}</td><td class="num">${Math.round(C.tonnage(x)).toLocaleString()}</td></tr>`; }).join('')}</table>` : '<p class="muted small">No finished sessions yet. Week 1 starts now.</p>'}
      </div>
    </div>
  </div>`;
}

function liftAction(act, el) {
  const s = liftSession(ui.liftDate, ui.liftDay);
  const exId = el.dataset.ex, e = exId && PROGRAM[ui.liftDay].ex.find(x => x.id === exId);
  const r = e && (s.ex[exId] ||= { w: e.start, reps: [] });
  switch (act) {
    case 'rep': {
      const i = +el.dataset.i, v = r.reps[i];
      r.reps[i] = v == null ? e.reps : v > 0 ? v - 1 : null;
      while (r.reps.length && r.reps.at(-1) == null) r.reps.pop();
      break;
    }
    case 'repin': { const v = num(el.value); r.reps[+el.dataset.i] = v; break; }
    case 'wup': r.w = Math.round((r.w + e.inc) * 10) / 10; break;
    case 'wdown': r.w = Math.max(0, Math.round((r.w - e.inc) * 10) / 10); break;
    case 'w': r.w = num(el.value) ?? 0; break;
    case 'hard': r.hard = !r.hard; break;
    case 'notes': s.notes = el.value; break;
    case 'finish': {
      s.done = true;
      const pr = MAIN_LIFTS.find(([id]) => { const b = C.bestE1rm(id, s.key); return b > 0 && C.sessionE1rm(s, id) > b; });
      toast(pr ? `New ${pr[1]} PR: e1RM ${fmt(C.sessionE1rm(s, pr[0]), 0)} lb` : 'Logged. ' + QUOTES[(Date.now() / 1000 | 0) % QUOTES.length]);
      break;
    }
    case 'reopen': s.done = false; break;
    case 'discard': store.remove(s.key); ui.liftDay = null; return;
    default: return;
  }
  saveSession(s);
}

// ---------- BODY ----------
function renderBody() {
  const s = C.settings(), t = C.today();
  const ws = C.weights();
  const from = C.addDays(s.programStart, -28), to = C.addDays(t > s.programStart ? t : s.programStart, 42);
  const vis = ws.filter(([d]) => d >= from);
  const avgPts = vis.map(([d]) => [dayNum(d), C.avg7(d, ws)]);
  const tgt = [];
  for (let d = s.programStart; d <= to; d = C.addDays(d, 7)) tgt.push([dayNum(d), C.phaseInfo(d, s).target]);
  const wchart = chart({
    series: [{ pts: tgt, cls: 'ln2' }, { pts: avgPts, area: false }, { pts: vis.map(([d, w]) => [dayNum(d), w, `${d}: ${w}`]), line: false, dots: true }],
    wide: true, h: 240, xFmt: dayLabel, xMin: dayNum(from), xMax: dayNum(to),
  });

  // weekly table: program weeks up to current + 2
  const curWk = C.programWeek(t, s);
  let rows = '';
  for (let wk = Math.max(1, curWk - 6); wk <= Math.max(1, curWk) + 2; wk++) {
    const start = C.addDays(s.programStart, (wk - 1) * 7), end = C.addDays(start, 6);
    const inWk = ws.filter(([d]) => d >= start && d <= end);
    const vals = inWk.map(([, w]) => w);
    // compare against the plan at the average date of this week's weigh-ins
    const mid = inWk.length ? C.addDays(start, Math.round(inWk.reduce((a, [d]) => a + C.diffDays(d, start), 0) / inWk.length)) : end;
    const p = C.phaseInfo(mid, s);
    const a = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
    const diff = a == null ? null : a - p.target;
    rows += `<tr class="${wk === curWk ? 'next' : ''}"><td>${wk}</td><td>${C.fmtDate(start, { month: 'short', day: 'numeric' })}</td><td>${C.PHASE_LABEL[p.phase]}</td><td class="num">${fmt(p.target)}</td><td class="num">${fmt(a)}</td><td class="num">${diff == null ? '—' : (diff > 0 ? '+' : '') + fmt(diff)}</td><td>${diff == null ? '' : Math.abs(diff) <= 1 ? 'On track' : diff > 0 ? 'Above' : 'Below'}</td></tr>`;
  }

  // diet history (28 days)
  let diet = '', hitK = 0, hitP = 0, logged = 0;
  for (let i = 0; i < 14; i++) {
    const d = C.addDays(t, -i), x = C.dayDoc(d), p = C.phaseInfo(d, s);
    if (x.kcal == null && x.protein == null) continue;
    logged++;
    const ko = x.kcal != null && x.kcal <= p.kcal, po = x.protein != null && x.protein >= p.protein;
    hitK += ko; hitP += po;
    diet += `<tr><td>${C.fmtDate(d)}</td><td class="num">${x.kcal ?? '—'}</td><td class="num">${x.protein ?? '—'}</td><td>${ko ? '■' : '□'} kcal</td><td>${po ? '■' : '□'} protein</td></tr>`;
  }
  const kcalPts = [], protPts = [];
  for (let i = 13; i >= 0; i--) { const d = C.addDays(t, -i), x = C.dayDoc(d); if (x.kcal != null) kcalPts.push([dayNum(d), x.kcal]); if (x.protein != null) protPts.push([dayNum(d), x.protein]); }

  const cutEnd = C.addDays(s.programStart, s.cutWeeks * 7 - 1), revEnd = C.addDays(cutEnd, s.reverseWeeks * 7);
  const bulkEnd = C.addDays(s.programStart, 52 * 7 - 1);
  const pNow = C.phaseInfo(t, s);
  // trend metrics
  const rate = C.weightRate(t, 21, ws);
  const planRate = pNow.phase === 'cut' ? -(s.startWeight - s.cutGoal) / s.cutWeeks : pNow.phase === 'bulk' ? s.bulkRate : s.reverseRebound / s.reverseWeeks;
  const a7now = C.avg7(t, ws);
  const lost = a7now != null ? a7now - s.startWeight : null;
  const eta = rate && rate < -0.05 && a7now > s.cutGoal ? C.addDays(t, Math.round((a7now - s.cutGoal) / -rate * 7)) : null;
  let k7 = 0, p7 = 0, n7 = 0, adh7 = 0;
  for (let i = 0; i < 7; i++) { const d = C.addDays(t, -i), x = C.dayDoc(d), pp = C.phaseInfo(d, s); if (x.kcal == null) continue; n7++; k7 += x.kcal; p7 += x.protein || 0; adh7 += x.kcal <= pp.kcal && (x.protein || 0) >= pp.protein; }
  const dietStreak = C.streak(t, d => { const x = C.dayDoc(d), pp = C.phaseInfo(d, s); return x.kcal != null && x.kcal <= pp.kcal && (x.protein || 0) >= pp.protein; });
  const weighStreak = C.streak(t, d => C.dayDoc(d).weight != null);

  $('#v-body').innerHTML = `
  <div class="grid two">
    <div class="card span2">
      <h2>Bodyweight <span class="right">now ${fmt(C.avg7(t, ws))} avg · target ${fmt(pNow.target)}</span></h2>
      ${wchart}
      <div class="legend"><span>▪ weigh-in</span><span><i></i>7-day avg</span><span><i class="d"></i>plan</span></div>
    </div>
    <div class="card span2">
      <h2>Trend</h2>
      <div class="grid three" style="gap:16px">
        <div class="row" style="gap:24px;align-items:flex-start">
          <div><div class="big">${rate == null ? '—' : (rate > 0 ? '+' : '') + fmt(rate, 2)}<small>lb/wk</small></div><div class="tiny">actual, 21-day fit</div></div>
          <div><div class="big">${(planRate > 0 ? '+' : '') + fmt(planRate, 2)}<small>lb/wk</small></div><div class="tiny">plan</div></div>
        </div>
        <div class="row" style="gap:24px;align-items:flex-start">
          <div><div class="big">${lost == null ? '—' : (lost > 0 ? '+' : '') + fmt(lost)}<small>lb</small></div><div class="tiny">change since ${C.fmtDate(s.programStart, { month: 'short', day: 'numeric' })}</div></div>
          <div><div class="big" style="font-size:24px">${eta ? C.fmtDate(eta, { month: 'short', day: 'numeric' }) : '—'}</div><div class="tiny">${s.cutGoal} lb at this rate</div></div>
        </div>
        <div class="row" style="gap:24px;align-items:flex-start">
          <div><div class="big">${n7 ? Math.round(k7 / n7) : '—'}</div><div class="tiny">avg kcal · 7d</div></div>
          <div><div class="big">${n7 ? Math.round(p7 / n7) : '—'}<small>g</small></div><div class="tiny">avg protein · 7d</div></div>
          <div><div class="big">${n7 ? adh7 + '/' + n7 : '—'}</div><div class="tiny">diet days hit</div></div>
        </div>
      </div>
      <p class="tiny" style="margin-top:12px">Streaks: ${dietStreak} day${dietStreak === 1 ? '' : 's'} on diet · ${weighStreak} day${weighStreak === 1 ? '' : 's'} weighed in.${rate == null ? ' Loss rate needs 4 weigh-ins in 3 weeks.' : rate > planRate + 0.5 && pNow.phase === 'cut' ? ' Losing slower than plan. Two weeks like this means cut 150–200 kcal.' : ''}</p>
    </div>
    <div class="card">
      <h2>Weekly check</h2>
      <div class="scroll-x"><table class="tbl"><tr><th>Wk</th><th>Start</th><th>Phase</th><th class="num">Target</th><th class="num">Avg</th><th class="num">Δ</th><th></th></tr>${rows}</table></div>
      <p class="tiny" style="margin-top:10px">On track = within 1 lb. Change calories only after two weeks off, by 150–200.</p>
    </div>
    <div class="card">
      <h2>Phases</h2>
      <table class="tbl">
        <tr><th>Phase</th><th>Dates</th><th class="num">kcal</th><th class="num">Protein</th></tr>
        <tr class="${pNow.phase === 'cut' ? 'next' : ''}"><td>Cut</td><td>${C.fmtDate(s.programStart, { month: 'short', day: 'numeric' })} – ${C.fmtDate(cutEnd, { month: 'short', day: 'numeric' })}</td><td class="num">${s.phases.cut.kcal}</td><td class="num">${s.phases.cut.protein}</td></tr>
        <tr class="${pNow.phase === 'reverse' ? 'next' : ''}"><td>Reverse</td><td>to ${C.fmtDate(revEnd, { month: 'short', day: 'numeric' })}</td><td class="num">→${s.phases.reverse.kcal}</td><td class="num">${s.phases.reverse.protein}</td></tr>
        <tr class="${pNow.phase === 'bulk' ? 'next' : ''}"><td>Lean bulk</td><td>to ${C.fmtDate(bulkEnd, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td class="num">${s.phases.bulk.kcal}</td><td class="num">${s.phases.bulk.protein}</td></tr>
      </table>
      <p class="small muted" style="margin-top:10px">${s.startWeight} → ${s.cutGoal} lb over ${s.cutWeeks} weeks (${fmt((s.startWeight - s.cutGoal) / s.cutWeeks, 2)} lb/wk). If the deficit collides with a heavy exam block, hold maintenance and extend the cut.</p>
    </div>
    <div class="card span2">
      <h2>Diet, last 14 days <span class="right">${logged ? `kcal ${hitK}/${logged} · protein ${hitP}/${logged}` : ''}</span></h2>
      ${kcalPts.length > 1 ? `<div class="grid two"><div><div class="tiny">Calories vs ${pNow.kcal}</div>${chart({ series: [{ pts: kcalPts.map(p => [p[0], pNow.kcal]), cls: 'ln2' }, { pts: kcalPts, dots: 'solid' }], h: 140, xFmt: dayLabel })}</div><div><div class="tiny">Protein vs ${pNow.protein}</div>${chart({ series: [{ pts: protPts.map(p => [p[0], pNow.protein]), cls: 'ln2' }, { pts: protPts, dots: 'solid' }], h: 140, xFmt: dayLabel })}</div></div>` : ''}
      ${diet ? `<div class="scroll-x"><table class="tbl"><tr><th>Day</th><th class="num">kcal</th><th class="num">Protein</th><th></th><th></th></tr>${diet}</table></div>` : '<p class="muted small">Log calories and protein on the Today tab.</p>'}
    </div>
  </div>`;
}

// ---------- MCAT ----------
function renderMcat() {
  const s = C.settings(), t = C.today();
  const mon = C.mondayOf(t);
  const task = C.mcatTask(t, s);
  let week = '';
  for (let i = 0; i < 7; i++) {
    const d = C.addDays(mon, i), x = C.dayDoc(d), tk = C.mcatTask(d, s);
    week += `<div class="wd ${d === t ? 'today' : ''} ${tk.exam ? 'exam' : ''}">
      <div class="h"><span>${C.fmtDate(d, { weekday: 'short' })}</span><span>${C.fmtDate(d, { day: 'numeric' })}</span></div>
      <div>${esc(tk.label)}</div>
      <div class="marks">${C.MCAT_ITEMS.map(([k, n]) => `<i class="${x[k] ? 'on' : ''}" title="${n}"></i>`).join('')}</div>
    </div>`;
  }
  // consistency: last 28 days, share of the 4 items done
  let dots = '', done = 0;
  for (let i = 27; i >= 0; i--) {
    const d = C.addDays(t, -i), x = C.dayDoc(d);
    const n = C.MCAT_ITEMS.filter(([k]) => x[k]).length; done += n;
    dots += `<i class="${n === 4 ? 'full' : n ? 'half' : ''} ${i === 0 ? 'today' : ''}" title="${d}: ${n}/4"></i>`;
  }

  const sc = C.examScores();
  const nextExam = EXAMS.find(e => e.slot !== false && !C.examTotal(sc[e.id]));
  const exRows = EXAMS.map(e => {
    const x = sc[e.id] || {};
    const tot = C.examTotal(x);
    const inp = f => `<input type="number" inputmode="numeric" min="118" max="132" value="${x[f] ?? ''}" data-act="exam" data-id="${e.id}" data-f="${f}">`;
    return `<tr class="${nextExam?.id === e.id ? 'next' : ''}"><td>${esc(e.name)}</td><td><input type="date" value="${x.date ?? ''}" data-act="exam" data-id="${e.id}" data-f="date"></td>
      <td class="num">${inp('cp')}</td><td class="num">${inp('cars')}</td><td class="num">${inp('bb')}</td><td class="num">${inp('ps')}</td><td class="num"><b>${tot ?? ''}</b></td></tr>`;
  }).join('');
  const scored = EXAMS.filter(e => C.examTotal(sc[e.id]));
  const exPts = scored.map((e, i) => [i, C.examTotal(sc[e.id]), e.name + ': ' + C.examTotal(sc[e.id])]);

  // CARS log
  const cars = store.keys('day:').map(k => [k.slice(4), store.get(k)]).filter(([, x]) => x.carsQ && x.carsC != null);
  const last = cars.slice(-30);
  const roll = last.map(([d], i) => { const w = last.slice(Math.max(0, i - 6), i + 1); const q = w.reduce((a, [, x]) => a + x.carsQ, 0), c = w.reduce((a, [, x]) => a + x.carsC, 0); return [dayNum(d), c / q * 100]; });
  const accAll = last.length ? last.reduce((a, [, x]) => a + x.carsC, 0) / last.reduce((a, [, x]) => a + x.carsQ, 0) * 100 : null;
  const timed = last.filter(([, x]) => x.carsT);
  const avgT = timed.length ? timed.reduce((a, [, x]) => a + x.carsT, 0) / timed.length : null;
  const mmss = sec => sec == null ? '—' : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
  const perQ = timed.length ? timed.reduce((a, [, x]) => a + x.carsT, 0) / timed.reduce((a, [, x]) => a + x.carsQ, 0) : null;

  // question bank (UWorld, QPs, section banks)
  const uw = store.keys('day:').map(k => [k.slice(4), store.get(k)]).filter(([, x]) => x.uwQ && x.uwPct != null);
  const uwQ = uw.reduce((a, [, x]) => a + x.uwQ, 0);
  const uwPct = uwQ ? uw.reduce((a, [, x]) => a + x.uwQ * x.uwPct, 0) / uwQ : null;
  const uw7 = uw.filter(([d]) => d > C.addDays(t, -7)), uw7Q = uw7.reduce((a, [, x]) => a + x.uwQ, 0);
  const uw7Pct = uw7Q ? uw7.reduce((a, [, x]) => a + x.uwQ * x.uwPct, 0) / uw7Q : null;
  const uwRoll = uw.slice(-30).map(([d], i, arr) => { const w = arr.slice(Math.max(0, i - 4), i + 1); const q = w.reduce((a, [, x]) => a + x.uwQ, 0); return [dayNum(d), w.reduce((a, [, x]) => a + x.uwQ * x.uwPct, 0) / q]; });

  // sections
  const SECS = [['cp', 'Chem/Phys'], ['cars', 'CARS'], ['bb', 'Bio/Biochem'], ['ps', 'Psych/Soc']];
  const full = scored.map(e => sc[e.id]);
  const first = full[0], latest = full.at(-1), recent3 = full.slice(-3);
  const secAvg = k => recent3.length ? recent3.reduce((a, x) => a + x[k], 0) / recent3.length : null;
  const weakest = recent3.length ? SECS.reduce((a, b) => secAvg(b[0]) < secAvg(a[0]) ? b : a)[0] : null;
  const goal = s.goalScore || 515;
  const latestTot = latest ? C.examTotal(latest) : null;
  const secRows = SECS.map(([k, n]) => `<tr class="${k === weakest ? 'next' : ''}"><td>${n}${k === weakest ? ' <span class="tiny">weakest</span>' : ''}</td><td class="num">${latest ? latest[k] : '—'}</td><td class="num">${recent3.length ? fmt(secAvg(k)) : '—'}</td><td class="num">${full.length ? Math.max(...full.map(x => x[k])) : '—'}</td><td class="num">${first && latest && full.length > 1 ? (latest[k] - first[k] >= 0 ? '+' : '') + (latest[k] - first[k]) : '—'}</td></tr>`).join('');

  // streaks and per-task completion (14 days)
  const allDone = d => C.MCAT_ITEMS.every(([k]) => C.dayDoc(d)[k]);
  const mStreak = C.streak(t, allDone);
  const perTask = C.MCAT_ITEMS.map(([k, n]) => { let c = 0; for (let i = 0; i < 14; i++) c += !!C.dayDoc(C.addDays(t, -i))[k]; return [n, c]; });

  $('#v-mcat').innerHTML = `
  <div class="grid two">
    <div class="card span2">
      <h2>Week ${task.week} <span class="right">${C.diffDays(s.mcatDate, t)} days to test · ${C.fmtDate(s.mcatDate, { month: 'short', day: 'numeric' })}</span></h2>
      <div class="week">${week}</div>
      <p class="tiny" style="margin-top:10px">Marks: CARS · Anki · Psych/Soc · practice block. Exam slots take the next exam you haven't scored.</p>
    </div>
    <div class="card span2">
      <h2>Practice exams <span class="right">${nextExam ? 'Next: ' + esc(nextExam.name) : ''}</span></h2>
      <div class="scroll-x"><table class="tbl"><tr><th>Exam</th><th>Date</th><th class="num">C/P</th><th class="num">CARS</th><th class="num">B/B</th><th class="num">P/S</th><th class="num">Total</th></tr>${exRows}</table></div>
      ${exPts.length > 1 ? chart({ series: [{ pts: exPts, dots: 'solid' }], wide: true, h: 160, xTicks: exPts.map(p => p[0]), xFmt: i => (scored[Math.round(i)]?.name || '').replace('AAMC ', ''), yFmt: v => fmt(v, 0) }) : ''}
    </div>
    <div class="card">
      <h2>Score gap <span class="right">goal ${goal}</span></h2>
      <div class="row" style="gap:24px;align-items:flex-start">
        <div><div class="big">${latestTot ?? '—'}</div><div class="tiny">latest total</div></div>
        <div><div class="big">${latestTot ? (goal - latestTot > 0 ? goal - latestTot : '✓') : '—'}</div><div class="tiny">${latestTot && goal - latestTot <= 0 ? 'at goal' : 'points to goal'}</div></div>
        <div><div class="big">${full.length > 1 ? (latestTot - C.examTotal(first) >= 0 ? '+' : '') + (latestTot - C.examTotal(first)) : '—'}</div><div class="tiny">since diagnostic</div></div>
      </div>
      <table class="tbl" style="margin-top:12px"><tr><th>Section</th><th class="num">Latest</th><th class="num">Last 3</th><th class="num">Best</th><th class="num">Δ diag</th></tr>${secRows}</table>
      <p class="tiny" style="margin-top:8px">Goal needs about ${fmt(goal / 4, 1)} per section. Weakest = lowest average over your last 3 exams.</p>
    </div>
    <div class="card">
      <h2>Question bank <span class="right">${uwQ} Qs logged</span></h2>
      <div class="row" style="gap:24px;align-items:flex-start">
        <div><div class="big">${fmt(uwPct, 0)}<small>%</small></div><div class="tiny">all time</div></div>
        <div><div class="big">${fmt(uw7Pct, 0)}<small>%</small></div><div class="tiny">last 7 days</div></div>
        <div><div class="big">${uw7Q}</div><div class="tiny">Qs this week</div></div>
      </div>
      ${uwRoll.length > 1 ? chart({ series: [{ pts: uwRoll, dots: 'solid' }], h: 130, xFmt: dayLabel, yMin: 0, yMax: 100, yFmt: v => fmt(v, 0) + '%' }) : '<p class="small muted" style="margin-top:10px">Log Qs and % correct on the practice-block task each day.</p>'}
    </div>
    <div class="card">
      <h2>CARS <span class="right">last ${last.length}</span></h2>
      <div class="row" style="gap:28px">
        <div><div class="big">${fmt(accAll, 0)}<small>%</small></div><div class="tiny">accuracy</div></div>
        <div><div class="big">${mmss(avgT)}</div><div class="tiny">avg / passage</div></div>
        <div><div class="big">${perQ ? Math.round(perQ) + '<small>s</small>' : '—'}</div><div class="tiny">per question</div></div>
      </div>
      ${roll.length > 1 ? chart({ series: [{ pts: roll }], h: 130, xFmt: dayLabel, yMin: 0, yMax: 100, yFmt: v => fmt(v, 0) + '%' }) : ''}
      <div class="tiny">7-passage rolling accuracy</div>
    </div>
    <div class="card">
      <h2>Consistency <span class="right">${Math.round(done / 112 * 100)}% of tasks · 28 days</span></h2>
      <div class="dots">${dots}</div>
      <div class="row" style="gap:24px;margin-top:12px;align-items:flex-start">
        <div><div class="big">${mStreak}</div><div class="tiny">day streak, all 4</div></div>
        <table class="tbl" style="flex:1;min-width:180px">${perTask.map(([n, c]) => `<tr><td>${n}</td><td class="num">${c}/14</td></tr>`).join('')}</table>
      </div>
      <hr>
      <h2>Key dates</h2>
      <table class="tbl">${MCAT_KEY_DATES.map(([d, l]) => `<tr class="${d >= t && MCAT_KEY_DATES.find(([x]) => x >= t)?.[0] === d ? 'next' : ''}"><td>${C.fmtDate(d, { month: 'short', day: 'numeric' })}</td><td>${esc(l)}</td><td class="num muted">${C.diffDays(d, t) >= 0 ? C.diffDays(d, t) + 'd' : 'past'}</td></tr>`).join('')}</table>
    </div>
  </div>`;
}

// ---------- SETTINGS ----------
function renderSettings() {
  const s = C.settings(), sy = store.sync();
  const ew = C.exWeights();
  const syncBox = !store.syncEnabled()
    ? `<p class="small">Sync isn't switched on yet, so everything is saved on this device only. Once the Firebase config is added to <code>config.js</code>, sign in here on your phone and desktop and they share one log.</p>`
    : sy.email
      ? `<p class="small">Signed in as <b>${esc(sy.email)}</b>. Status: ${esc(sy.state)}${sy.error ? ' · ' + esc(sy.error) : ''}</p><button class="btn ghost" data-act="signout">Sign out</button>`
      : `<p class="small">Sign in with the same account on every device. Status: ${esc(sy.state)}${sy.error ? ' · ' + esc(sy.error) : ''}</p>
         <div class="row"><button class="btn solid" data-act="google">Sign in with Google</button></div>
`;
  const ph = k => `<tr><td>${C.PHASE_LABEL[k]}</td><td class="num"><input type="number" style="width:70px" value="${s.phases[k].kcal}" data-set="phases.${k}.kcal"></td><td class="num"><input type="number" style="width:60px" value="${s.phases[k].protein}" data-set="phases.${k}.protein"></td></tr>`;
  $('#v-settings').innerHTML = `
  <div class="grid two">
    <div class="card"><h2>Sync</h2>${syncBox}</div>
    <div class="card">
      <h2>Look</h2>
      <div class="seg" style="max-width:260px"><button class="${s.theme !== 'light' ? 'active' : ''}" data-act="theme" data-v="dark">Ink</button><button class="${s.theme === 'light' ? 'active' : ''}" data-act="theme" data-v="light">Paper</button></div>
      <hr>
      <h2>Backup</h2>
      <div class="row"><button class="btn sm" data-act="export">Export JSON</button><label class="btn sm ghost">Import<input type="file" accept="application/json" data-act="import" hidden></label></div>
    </div>
    <div class="card">
      <h2>Diet targets</h2>
      <table class="tbl"><tr><th>Phase</th><th class="num">kcal</th><th class="num">Protein g</th></tr>${ph('cut')}${ph('reverse')}${ph('bulk')}</table>
      <p class="tiny" style="margin-top:8px">Reverse ramps from the cut number to this one.</p>
      <hr>
      <h2>Quick-add meals</h2>
      <table class="tbl"><tr><th>Name</th><th class="num">kcal</th><th class="num">P</th><th></th></tr>
      ${s.meals.map((m, i) => `<tr><td><input type="text" style="width:100%;font-size:14px;text-align:left" value="${esc(m.name)}" data-meal="${i}" data-f="name"></td><td class="num"><input type="number" style="width:60px" value="${m.kcal}" data-meal="${i}" data-f="kcal"></td><td class="num"><input type="number" style="width:50px" value="${m.protein}" data-meal="${i}" data-f="protein"></td><td class="num"><button class="btn sm ghost" data-act="delmeal" data-i="${i}">×</button></td></tr>`).join('')}
      </table>
      <div style="margin-top:8px"><button class="btn sm" data-act="addmeal">Add meal</button></div>
    </div>
    <div class="card">
      <h2>Plan</h2>
      <div class="grid two">
        <label class="field"><label>Program start (week 1)</label><input type="date" value="${s.programStart}" data-set="programStart"></label>
        <label class="field"><label>Start weight</label><input type="number" step="0.1" value="${s.startWeight}" data-set="startWeight"></label>
        <label class="field"><label>Cut goal</label><input type="number" step="0.1" value="${s.cutGoal}" data-set="cutGoal"></label>
        <label class="field"><label>Cut weeks</label><input type="number" value="${s.cutWeeks}" data-set="cutWeeks"></label>
        <label class="field"><label>MCAT goal score</label><input type="number" value="${s.goalScore}" data-set="goalScore"></label>
        <label class="field"><label>MCAT date</label><input type="date" value="${s.mcatDate}" data-set="mcatDate"></label>
        <label class="field"><label>MCAT week 11 starts</label><input type="date" value="${s.mcatWeek11Start}" data-set="mcatWeek11Start"></label>
      </div>
    </div>
    <div class="card span2">
      <h2>Starting weights <span class="right">used until you log a session</span></h2>
      <div class="grid two">
      ${ROTATION.map(k => `<div><div class="tiny" style="margin:6px 0">${PROGRAM[k].name}</div><table class="tbl">${PROGRAM[k].ex.map(e => `<tr><td>${esc(e.name)} <span class="muted">${e.sets}×${e.reps}</span></td><td class="num"><input type="number" step="any" style="width:64px" value="${ew[e.id] ?? e.start}" data-exw="${e.id}"></td></tr>`).join('')}</table></div>`).join('')}
      </div>
      <p class="tiny" style="margin-top:8px">0 means bodyweight or empty machine.</p>
    </div>
  </div>`;
}

function setPath(obj, path, val) {
  const ks = path.split('.'); let o = obj;
  for (const k of ks.slice(0, -1)) o = o[k] = { ...(o[k] || {}) };
  o[ks.at(-1)] = val;
}
function saveSetting(path, val) {
  const cur = store.get('settings', {});
  const s = structuredClone(cur);
  if (path.startsWith('phases.')) s.phases = { ...DEFAULT_SETTINGS.phases, ...(s.phases || {}) };
  setPath(s, path, val);
  store.set('settings', s);
}

// ---------- router + events ----------
const RENDER = { today: renderToday, lift: renderLift, body: renderBody, mcat: renderMcat, plan: () => renderPlan($('#v-plan')), settings: renderSettings };
function render() {
  const a = document.activeElement;
  if (a && a.closest('main') && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== 'checkbox') { ui.pendingRender = true; return; }
  ui.pendingRender = false;
  RENDER[ui.view]();
  const sy = store.sync(), dot = $('#syncdot');
  dot.className = 'sync-dot' + (sy.state === 'synced' ? ' on' : sy.state === 'error' ? ' err' : '');
  dot.querySelector('span').textContent = { local: 'This device', 'signed-out': 'Sign in', connecting: 'Syncing', synced: 'Synced', offline: 'Offline', error: 'Sync error' }[sy.state];
  $('#topdate').textContent = C.fmtDate(C.today(), { month: 'short', day: 'numeric' });
}
function go(view) {
  ui.view = view;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + view));
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.go === view));
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  render();
  window.scrollTo(0, 0);
}

function parseMmss(v) {
  if (!v) return null;
  const m = String(v).trim().match(/^(\d+)(?::(\d{1,2}))?$/);
  return m ? (+m[1]) * 60 + (+(m[2] || 0)) : null;
}

document.addEventListener('click', async e => {
  const nav = e.target.closest('[data-go]');
  if (nav) { go(nav.dataset.go); return; }
  if (e.target.closest('[data-stop]')) return;
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
  const act = el.dataset.act;
  const date = ui.date;
  switch (act) {
    case 'day-prev': ui.date = C.addDays(ui.date, -1); render(); break;
    case 'day-next': ui.date = C.addDays(ui.date, 1); render(); break;
    case 'day-today': ui.date = C.today(); render(); break;
    case 'toggle': { const d = C.dayDoc(date); C.patchDay(date, { [el.dataset.k]: !d[el.dataset.k] }); break; }
    case 'meal': { const m = C.settings().meals[+el.dataset.i], d = C.dayDoc(date); C.patchDay(date, { kcal: (d.kcal || 0) + m.kcal, protein: (d.protein || 0) + m.protein }); toast('+ ' + m.name); break; }
    case 'addfood': { const k = num($('#addk').value) || 0, p = num($('#addp').value) || 0; if (!k && !p) return; const d = C.dayDoc(date); C.patchDay(date, { kcal: (d.kcal || 0) + k, protein: (d.protein || 0) + p }); break; }
    case 'openlift': ui.liftDate = date; ui.liftDay = el.dataset.day; go('lift'); break;
    case 'liftday': ui.liftDay = el.dataset.day; ui.repEdit = {}; render(); break;
    case 'repedit': ui.repEdit[el.dataset.ex] = !ui.repEdit[el.dataset.ex]; render(); break;
    case 'rep': case 'wup': case 'wdown': case 'hard': case 'finish': case 'reopen': case 'discard': liftAction(act, el); if (act === 'discard') render(); break;
    case 'theme': saveSetting('theme', el.dataset.v); document.documentElement.dataset.theme = el.dataset.v; break;
    case 'addmeal': { const s = C.settings(); saveSetting('meals', [...s.meals, { name: 'New meal', kcal: 0, protein: 0 }]); break; }
    case 'delmeal': { const s = C.settings(); saveSetting('meals', s.meals.filter((_, i) => i !== +el.dataset.i)); break; }
    case 'export': {
      const blob = new Blob([JSON.stringify(store.allDocs(), null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `forge-backup-${C.today()}.json`; a.click(); break;
    }
    case 'google': try { await store.signInGoogle(); } catch (err) { toast(err.code || err.message); } break;
    case 'signout': await store.signOut(); break;
    default: handlePlan(act, el, { toast, render });
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  const date = ui.date;
  if (el.dataset.field) {
    const f = el.dataset.field;
    const v = f === 'carsT' ? parseMmss(el.value) : 'text' in el.dataset ? (el.value || null) : num(el.value);
    const patch = { [f]: v };
    if (f === 'carsQ' || f === 'carsC' || f === 'carsT') { if (v != null) patch.cars = true; }
    if ((f === 'uwQ' || f === 'uwPct') && v != null) patch.uw = true;
    if (f === 'psPages' && v != null && v >= C.settings().psPagesTarget) patch.ps = true;
    C.patchDay(date, patch);
  } else if (el.dataset.set) {
    const v = el.type === 'number' ? num(el.value) : el.value;
    if (v != null && v !== '') saveSetting(el.dataset.set, v);
  } else if (el.dataset.meal) {
    const meals = structuredClone(C.settings().meals);
    meals[+el.dataset.meal][el.dataset.f] = el.dataset.f === 'name' ? el.value : (num(el.value) || 0);
    saveSetting('meals', meals);
  } else if (el.dataset.exw) {
    const ew = C.exWeights(); const v = num(el.value);
    if (v != null) { ew[el.dataset.exw] = v; store.set('exweights', ew); }
  } else if (el.dataset.act === 'exam') {
    const sc = C.examScores(); const x = sc[el.dataset.id] ||= {};
    x[el.dataset.f] = el.dataset.f === 'date' ? el.value : num(el.value);
    if (el.dataset.f !== 'date' && !x.date && C.examTotal(x)) x.date = C.today();
    store.set('exams', sc);
  } else if (el.dataset.act === 'liftdate') {
    if (el.value) { ui.liftDate = el.value; ui.liftDay = null; }
  } else if (el.dataset.act === 'import') {
    const f = el.files[0]; if (!f) return;
    f.text().then(t => { store.importDocs(JSON.parse(t)); toast('Imported'); }).catch(() => toast('Not a valid backup'));
  } else if (el.dataset.act === 'notes' || el.dataset.act === 'w' || el.dataset.act === 'repin') {
    liftAction(el.dataset.act, el);
  } else if (el.dataset.plan) {
    handlePlan('planset', el, { toast, render });
  }
  if (document.activeElement === el) el.blur();
  if (el.dataset.act === 'liftdate') render();
});
document.addEventListener('focusout', () => setTimeout(() => { if (ui.pendingRender) render(); }, 0));
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('main input:not([type=date])')) e.target.blur(); });

store.onChange(() => render());
let rsz; window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(render, 200); });
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (RENDER[v] && v !== ui.view) go(v); });
// roll over to the new day if the app stays open past midnight
let lastDay = C.today();
setInterval(() => { const t = C.today(); if (t !== lastDay) { if (ui.date === lastDay) ui.date = t; if (ui.liftDate === lastDay) ui.liftDate = t; lastDay = t; render(); } }, 60000);

await store.initSync();
seedAll();
const start = location.hash.slice(1);
go(RENDER[start] ? start : 'today');

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
