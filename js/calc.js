// Pure helpers: dates, phases and targets, lifting progression, MCAT schedule.
import { PROGRAM, ROTATION, DELOAD_WEEKS, DEFAULT_SETTINGS, MCAT_WEEKS, MCAT_FIRST_WEEK, EXAMS } from './data.js';
import * as store from './store.js';

// ---- dates (local calendar days as YYYY-MM-DD) ----
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => iso(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
export const fmtDate = (s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => parse(s).toLocaleDateString('en-US', opts);
export const dayOfYear = s => diffDays(s, s.slice(0, 4) + '-01-01');
export const mondayOf = s => addDays(s, -((parse(s).getDay() + 6) % 7));

export function settings() {
  const s = store.get('settings', {});
  return { ...DEFAULT_SETTINGS, ...s, phases: { ...DEFAULT_SETTINGS.phases, ...(s.phases || {}) }, meals: s.meals || DEFAULT_SETTINGS.meals };
}
export const dayDoc = date => store.get('day:' + date, {});
export function patchDay(date, patch) { store.set('day:' + date, { ...dayDoc(date), ...patch }); }

// ---- phases ----
export function programWeek(date, s = settings()) { return Math.floor(diffDays(date, s.programStart) / 7) + 1; }
export function phaseInfo(date, s = settings()) {
  const wk = programWeek(date, s);
  const cutEnd = s.cutWeeks, revEnd = s.cutWeeks + s.reverseWeeks;
  const weekFrac = diffDays(date, s.programStart) / 7;
  let phase, target, kcal, protein;
  if (wk <= cutEnd) {
    phase = 'cut';
    target = s.startWeight - (s.startWeight - s.cutGoal) * Math.min(1, Math.max(0, weekFrac) / s.cutWeeks);
    ({ kcal, protein } = s.phases.cut);
  } else if (wk <= revEnd) {
    phase = 'reverse';
    const into = wk - cutEnd; // 1..reverseWeeks
    target = s.cutGoal + s.reverseRebound * (weekFrac - cutEnd) / s.reverseWeeks;
    kcal = Math.round(s.phases.cut.kcal + (s.phases.reverse.kcal - s.phases.cut.kcal) * into / s.reverseWeeks);
    protein = s.phases.reverse.protein;
  } else {
    phase = 'bulk';
    target = s.cutGoal + s.reverseRebound + s.bulkRate * (weekFrac - revEnd);
    ({ kcal, protein } = s.phases.bulk);
  }
  const override = store.get('targets:' + date);
  if (override) ({ kcal = kcal, protein = protein } = override);
  return { week: wk, phase, target, kcal, protein, deload: DELOAD_WEEKS.includes(wk) };
}
export const PHASE_LABEL = { cut: 'Cut', reverse: 'Reverse', bulk: 'Lean bulk' };

// ---- weight ----
export function weights() {
  return store.keys('day:').map(k => [k.slice(4), store.get(k).weight]).filter(([, w]) => typeof w === 'number');
}
export function avg7(date, ws = weights()) {
  const from = addDays(date, -6);
  const vals = ws.filter(([d]) => d >= from && d <= date).map(([, w]) => w);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// ---- lifting ----
export const sessions = () => store.keys('lift:').map(k => ({ key: k, ...store.get(k) })).sort((a, b) => (a.date + a.day).localeCompare(b.date + b.day));
export function nextDay() {
  const done = sessions().filter(s => s.done);
  if (!done.length) return ROTATION[0];
  return ROTATION[(ROTATION.indexOf(done[done.length - 1].day) + 1) % ROTATION.length];
}
export function exWeights() { return store.get('exweights', {}); }
// Last finished set of results for an exercise (before `beforeDate` if given).
export function history(exId, beforeKey) {
  return sessions().filter(s => s.done && s.ex?.[exId] && (!beforeKey || s.key < beforeKey) && !s.deload).map(s => ({ date: s.date, ...s.ex[exId] }));
}
const round = (w, step) => Math.round(w / step) * step;
// Suggested working weight for the next session, following the sheet's progression rule:
// every set hit at target reps -> add one increment; missed twice at the same load -> drop 10%.
export function suggest(ex, beforeKey) {
  const h = history(ex.id, beforeKey);
  const base = exWeights()[ex.id] ?? ex.start;
  if (!h.length) return { w: base, why: 'Starting weight' };
  const last = h[h.length - 1];
  const hit = s => s.reps && s.reps.length >= ex.sets && s.reps.slice(0, ex.sets).every(r => r >= ex.reps);
  if (hit(last) && !last.hard) return { w: last.w + ex.inc, why: `Hit all sets at ${last.w}. Add ${ex.inc}.` };
  const prev = h[h.length - 2];
  if (prev && prev.w === last.w && !hit(prev) && !hit(last) && last.w > 0) return { w: round(last.w * 0.9, ex.inc), why: `Stalled twice at ${last.w}. Drop 10% and build back.` };
  return { w: last.w, why: hit(last) ? `Last time felt hard. Hold ${last.w}.` : `Hold ${last.w} until every set hits ${ex.reps}.` };
}
export function plannedSets(ex, deload) { return deload ? Math.ceil(ex.sets / 2) : ex.sets; }
export const deloadWeight = (w, ex) => round(w * 0.6, ex.inc);
export const e1rm = (w, r) => w * (1 + r / 30);

// ---- MCAT ----
export function mcatWeek(date, s = settings()) { return 11 + Math.floor(diffDays(date, s.mcatWeek11Start) / 7); }
export function examScores() { return store.get('exams', {}); }
const examDone = (id, sc) => sc[id] && sc[id].cp && sc[id].cars && sc[id].bb && sc[id].ps;
// The scheduled task for a date. Exam slots take the next exam that has no score yet.
export function mcatTask(date, s = settings()) {
  const wk = mcatWeek(date, s);
  const row = MCAT_WEEKS[wk - MCAT_FIRST_WEEK];
  if (!row) return { label: wk < MCAT_FIRST_WEEK ? 'Content review' : 'Done. Go live.', exam: null, week: wk };
  const dow = (parse(date).getDay() + 6) % 7;
  const label = row[dow];
  if (label !== 'EXAM') return { label, exam: null, week: wk };
  const sc = examScores();
  const logged = Object.entries(sc).find(([, v]) => v.date === date);
  if (logged) return { label: EXAMS.find(e => e.id === logged[0]).name, exam: logged[0], week: wk };
  const t = today();
  const queue = EXAMS.filter(e => e.slot !== false && !examDone(e.id, sc));
  if (date < t) return { label: 'Exam slot (missed)', exam: null, week: wk };
  // count exam slots from today up to this date
  let n = 0;
  for (let d = t; d < date; d = addDays(d, 1)) {
    const r = MCAT_WEEKS[mcatWeek(d, s) - MCAT_FIRST_WEEK];
    if (r && r[(parse(d).getDay() + 6) % 7] === 'EXAM') n++;
  }
  const e = queue[n];
  return e ? { label: e.name, exam: e.id, week: wk } : { label: 'Exam review', exam: null, week: wk };
}
export const examTotal = x => (x && x.cp && x.cars && x.bb && x.ps) ? x.cp + x.cars + x.bb + x.ps : null;
export const MCAT_ITEMS = [
  ['cars', 'CARS passage'],
  ['anki', 'Anki reviews'],
  ['ps', 'Psych/Soc pages'],
  ['uw', 'Practice block'],
];

// ---- metrics ----
// Least-squares slope of weight in lb per week over the last `days` days (needs 4+ weigh-ins).
export function weightRate(date, days = 21, ws = weights()) {
  const from = addDays(date, -days);
  const pts = ws.filter(([d]) => d > from && d <= date).map(([d, w]) => [diffDays(d, date), w]);
  if (pts.length < 4) return null;
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  const num = pts.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0), den = pts.reduce((a, [x]) => a + (x - mx) ** 2, 0);
  return den ? num / den * 7 : null;
}
export function sessionE1rm(s, exId) {
  const r = s.ex?.[exId];
  if (!r || !r.reps?.length || !r.w) return 0;
  return Math.max(...r.reps.filter(x => x > 0).map(x => e1rm(r.w, x)), 0);
}
export function bestE1rm(exId, beforeKey) {
  return Math.max(0, ...sessions().filter(s => s.done && (!beforeKey || s.key < beforeKey)).map(s => sessionE1rm(s, exId)));
}
export function tonnage(s) {
  return Object.values(s.ex || {}).reduce((a, r) => a + (r.w || 0) * (r.reps || []).reduce((x, y) => x + (y || 0), 0), 0);
}
export function setsHit(s) {
  let hit = 0, tot = 0;
  for (const e of PROGRAM[s.day].ex) { const n = plannedSets(e, s.deload); tot += n; hit += (s.ex?.[e.id]?.reps || []).slice(0, n).filter(r => r >= e.reps).length; }
  return [hit, tot];
}
// Consecutive days, ending at `date` (or the day before if today is not done yet), where test(date) is true.
export function streak(date, test) {
  let d = test(date) ? date : addDays(date, -1), n = 0;
  while (test(d) && n < 999) { n++; d = addDays(d, -1); }
  return n;
}
