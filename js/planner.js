// Weekly planner: reads busy times from Google Calendar, fits lifting and MCAT blocks into
// the gaps, and writes them to a separate "Forge" calendar (replacing only its own events).
import * as store from './store.js';
import * as C from './calc.js';
import { PROGRAM, ROTATION } from './data.js';

const API = 'https://www.googleapis.com/calendar/v3';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.app.created',
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const PLAN_DEFAULTS = {
  start: '06:00', end: '22:00', buffer: 15,
  liftDays: [0, 1, 3, 5],
  dur: { lift: 75, uw: 180, exam: 480, review: 240, cars: 30, anki: 45, ps: 30 },
  calendars: null, // null = every calendar you have selected in Google Calendar
  calId: null,
};
const DUR_LABEL = { lift: 'Lift', uw: 'UWorld / QBank block', exam: 'Practice exam', review: 'Exam review', cars: 'CARS', anki: 'Anki', ps: 'Psych/Soc' };

const st = { week: 'this', busy: null, cals: null, plan: null, busyErr: '', working: false };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function planSettings() {
  const p = C.settings().plan || {};
  return { ...PLAN_DEFAULTS, ...p, dur: { ...PLAN_DEFAULTS.dur, ...(p.dur || {}) } };
}
function savePlanSettings(p) { store.set('settings', { ...store.get('settings', {}), plan: p }); }

const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const at = (date, min) => { const d = C.parse(date); d.setMinutes(min); return d; };
const clock = d => { const h = d.getHours(), m = d.getMinutes(); return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'a' : 'p'}`; };
function weekStart() {
  const mon = C.mondayOf(C.today());
  return st.week === 'next' ? C.addDays(mon, 7) : mon;
}

// What MCAT work a date calls for, as [kind, label, minutes] blocks.
function mcatBlocks(date, p) {
  const t = C.mcatTask(date), prev = C.mcatTask(C.addDays(date, -1));
  const L = t.label;
  const off = /^(rest|sleep|thanksgiving|christmas|new year|pray)/i.test(L) || /\(off\)/i.test(L);
  const testDay = L === 'MCAT';
  const out = [];
  if (testDay) return [['note', 'MCAT test day', 0]];
  const examDay = !!t.exam || /exam slot/i.test(L);
  if (examDay) out.push(['exam', `Practice exam: ${L}`, p.dur.exam]);
  else if (prev.exam || /exam review|review fl/i.test(L)) out.push(['review', `Exam review${prev.exam ? ': ' + prev.label : ''}`, p.dur.review]);
  else if (/uworld|qp|sec bank|review|catch-up/i.test(L)) out.push(['uw', L.replace('(60, untimed)', '60 Qs untimed'), /light/i.test(L) ? Math.round(p.dur.uw * 2 / 3) : p.dur.uw]);
  if (!off && !examDay) {
    out.push(['cars', date > '2026-12-13' ? 'CARS: AAMC QBank' : 'CARS: Jack Westin passage', p.dur.cars]);
    out.push(['ps', 'Psych/Soc 6-7 pages', p.dur.ps]);
  }
  out.push(['anki', 'Anki reviews', p.dur.anki]);
  return out;
}

// Which days of the week get a lift: preferred days, shifted off exam/test days.
function liftDates(mon, p) {
  const isExam = d => { const t = C.mcatTask(d); return !!t.exam || t.label === 'MCAT'; };
  const doneThisWeek = C.sessions().filter(s => s.done && s.date >= mon && s.date <= C.addDays(mon, 6)).length;
  const want = Math.max(0, p.liftDays.length - doneThisWeek);
  const picked = [];
  for (const i of [...p.liftDays].sort()) {
    let j = i;
    while (j < 7 && (isExam(C.addDays(mon, j)) || picked.includes(j))) j++;
    if (j < 7) picked.push(j);
  }
  const t = C.today();
  return picked.map(j => C.addDays(mon, j)).filter(d => d >= t).slice(0, want);
}

function buildPlan(busy) {
  const p = planSettings(), mon = weekStart(), now = new Date();
  const lifts = liftDates(mon, p);
  let rot = ROTATION.indexOf(C.nextDay());
  // next week continues the rotation after the lifts still planned for this week
  if (st.week === 'next') rot += liftDates(C.mondayOf(C.today()), p).length;
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = C.addDays(mon, i);
    const dayStart = at(date, hm(p.start)), dayEnd = at(date, hm(p.end));
    const ev = (busy || []).map(b => [new Date(b.start), new Date(b.end)]).filter(([s, e]) => e > dayStart && s < dayEnd);
    // free intervals = window minus padded busy, minus the past
    let free = [[Math.max(dayStart, now > dayStart ? roundUp(now) : dayStart), +dayEnd]];
    for (const [s, e] of ev) free = subtract(free, +s - p.buffer * 6e4, +e + p.buffer * 6e4);
    const tasks = [];
    if (lifts.includes(date)) { const k = ROTATION[rot++ % 4]; tasks.push(['lift', `Lift: ${PROGRAM[k].name} (${PROGRAM[k].focus})`, p.dur.lift]); }
    tasks.push(...mcatBlocks(date, p));
    const placed = [], missed = [];
    for (const [kind, label, mins] of tasks) {
      if (!mins) { placed.push({ kind, label, allDay: true }); continue; }
      const len = mins * 6e4;
      let slot = free.find(([s, e]) => e - s >= len);
      if (slot) {
        placed.push({ kind, label, start: slot[0], end: slot[0] + len });
        free = subtract(free, slot[0], slot[0] + len + p.buffer * 6e4);
      } else if (kind === 'uw' || kind === 'review') {
        // split long study blocks into chunks of at least an hour
        let left = len; const parts = [];
        for (const [s, e] of [...free]) { if (left <= 0) break; if (e - s < 60 * 6e4) continue; const take = Math.min(left, e - s); parts.push([s, s + take]); left -= take; }
        if (left > 0) missed.push({ kind, label, mins });
        else for (const [s, e] of parts) { placed.push({ kind, label: label + ' (part)', start: s, end: e }); free = subtract(free, s, e + p.buffer * 6e4); }
      } else missed.push({ kind, label, mins });
    }
    placed.sort((a, b) => (a.start || 0) - (b.start || 0));
    days.push({ date, busy: ev, placed, missed });
  }
  return days;
}
const roundUp = d => { const x = new Date(d); x.setSeconds(0, 0); x.setMinutes(Math.ceil(x.getMinutes() / 15) * 15); return +x; };
function subtract(free, s, e) {
  const out = [];
  for (const [a, b] of free) {
    if (e <= a || s >= b) { out.push([a, b]); continue; }
    if (s > a) out.push([a, s]);
    if (e < b) out.push([e, b]);
  }
  return out;
}

// ---- Google Calendar API ----
async function gapi(token, path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || 'Calendar error ' + r.status);
  return j;
}
async function loadBusy() {
  const token = await store.googleToken(SCOPES);
  const p = planSettings();
  const list = (await gapi(token, '/users/me/calendarList?minAccessRole=freeBusyReader')).items || [];
  st.cals = list.filter(c => c.id !== p.calId && c.summary !== 'Forge');
  const ids = (p.calendars || st.cals.filter(c => c.selected !== false).map(c => c.id)).filter(id => st.cals.some(c => c.id === id));
  const mon = weekStart();
  const fb = await gapi(token, '/freeBusy', { method: 'POST', body: JSON.stringify({ timeMin: at(mon, 0).toISOString(), timeMax: at(C.addDays(mon, 7), 0).toISOString(), items: ids.map(id => ({ id })) }) });
  st.busy = Object.values(fb.calendars || {}).flatMap(c => c.busy || []);
}
async function pushPlan(days) {
  const token = await store.googleToken(SCOPES);
  const p = planSettings();
  let calId = p.calId;
  if (calId) { try { await gapi(token, `/calendars/${encodeURIComponent(calId)}`); } catch { calId = null; } }
  if (!calId) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    calId = (await gapi(token, '/calendars', { method: 'POST', body: JSON.stringify({ summary: 'Forge', description: 'Blocks planned by the Forge tracker. Safe to hide or delete.', timeZone: tz }) })).id;
    savePlanSettings({ ...p, calId });
  }
  const mon = weekStart(), cid = encodeURIComponent(calId);
  // clear this week's existing Forge blocks (from now on, so past ones stay as a record)
  const from = new Date(Math.max(+at(mon, 0), Date.now()));
  const old = (await gapi(token, `/calendars/${cid}/events?singleEvents=true&maxResults=250&timeMin=${from.toISOString()}&timeMax=${at(C.addDays(mon, 7), 0).toISOString()}`)).items || [];
  for (const e of old) await gapi(token, `/calendars/${cid}/events/${e.id}`, { method: 'DELETE' });
  let n = 0;
  for (const d of days) for (const b of d.placed) {
    const body = b.allDay
      ? { summary: b.label, start: { date: d.date }, end: { date: C.addDays(d.date, 1) } }
      : { summary: b.label, start: { dateTime: new Date(b.start).toISOString() }, end: { dateTime: new Date(b.end).toISOString() }, description: 'Planned by Forge', reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] } };
    await gapi(token, `/calendars/${cid}/events`, { method: 'POST', body: JSON.stringify(body) });
    n++;
  }
  store.set('plan:' + mon, days.map(d => ({ date: d.date, blocks: d.placed })));
  return n;
}

// ---- view ----
export function renderPlan(root) {
  const p = planSettings(), mon = weekStart(), t = C.today();
  if (!st.plan || st.plan.mon !== mon) st.plan = { mon, days: buildPlan(st.busy) };
  const days = st.plan.days;
  const canCal = store.syncEnabled();
  const saved = store.get('plan:' + mon);
  const dayHtml = days.map(d => `
    <div class="plan-day" ${d.date < t ? 'style="opacity:.45"' : ''}>
      <div class="tiny">${C.fmtDate(d.date)}${d.date === t ? ' · today' : ''} · ${esc(C.mcatTask(d.date).label)}</div>
      ${d.placed.map(b => `<div class="plan-ev"><span>${b.allDay ? 'all day' : clock(new Date(b.start)) + '–' + clock(new Date(b.end))}</span><span>${esc(b.label)}</span></div>`).join('')}
      ${d.busy.map(([s, e]) => `<div class="plan-ev busy"><span>${clock(s)}–${clock(e)}</span><span>busy</span></div>`).join('')}
      ${d.missed.map(b => `<div class="plan-ev"><span>didn't fit</span><span><b>${esc(b.label)}</b> (${b.mins} min)</span></div>`).join('')}
      ${!d.placed.length && !d.missed.length ? '<div class="plan-ev busy"><span></span><span>Nothing planned</span></div>' : ''}
    </div>`).join('');
  const durRow = k => `<label class="field"><label>${DUR_LABEL[k]} (min)</label><input type="number" value="${p.dur[k]}" data-plan="dur.${k}"></label>`;
  root.innerHTML = `
  <div class="grid two">
    <div class="card span2">
      <h2>Plan my week <span class="right">${saved ? 'on calendar' : ''}</span></h2>
      <div class="row">
        <div class="seg" style="min-width:220px"><button class="${st.week === 'this' ? 'active' : ''}" data-act="planweek" data-v="this">This week</button><button class="${st.week === 'next' ? 'active' : ''}" data-act="planweek" data-v="next">Next week</button></div>
        <span class="spacer"></span>
        ${canCal ? `<button class="btn" data-act="planbusy" ${st.working ? 'disabled' : ''}>${st.busy ? 'Refresh calendar' : 'Read my calendar'}</button>
        <button class="btn solid" data-act="planpush" ${st.working ? 'disabled' : ''}>Add to Google Calendar</button>` : ''}
      </div>
      <p class="small muted" style="margin-top:10px">${!canCal ? 'Calendar connects once sync is set up (Setup tab). This preview ignores your other events until then.'
        : st.busyErr ? 'Calendar error: ' + esc(st.busyErr)
        : st.busy ? `Fitted around ${st.busy.length} busy blocks from your calendars.` : 'Preview ignores your events until you read your calendar.'}
        Lifts go first thing in the morning; the day after a practice exam gets a ${p.dur.review / 60}-hour review. Re-running replaces only Forge's own blocks.</p>
      ${dayHtml}
    </div>
    <div class="card">
      <h2>Rules</h2>
      <div class="grid two">
        <label class="field"><label>Day starts</label><input type="time" value="${p.start}" data-plan="start"></label>
        <label class="field"><label>Day ends</label><input type="time" value="${p.end}" data-plan="end"></label>
        <label class="field"><label>Buffer (min)</label><input type="number" value="${p.buffer}" data-plan="buffer"></label>
      </div>
      <div class="tiny" style="margin:14px 0 6px">Lift days</div>
      <div class="row">${DAYS.map((n, i) => `<button class="toggle ${p.liftDays.includes(i) ? 'on' : ''}" data-act="liftdaypick" data-i="${i}">${n}</button>`).join('')}</div>
      <p class="tiny" style="margin-top:6px">A lift on an exam day moves to the next open day.</p>
    </div>
    <div class="card">
      <h2>Block lengths</h2>
      <div class="grid two">${Object.keys(DUR_LABEL).map(durRow).join('')}</div>
    </div>
    ${st.cals ? `<div class="card span2"><h2>Calendars to plan around</h2>
      ${st.cals.map(c => { const on = p.calendars ? p.calendars.includes(c.id) : c.selected !== false; return `<div class="check ${on ? 'done' : ''}" data-act="calpick" data-id="${esc(c.id)}"><span class="box"><svg><use href="#i-check"/></svg></span><span class="t"><b>${esc(c.summaryOverride || c.summary)}</b></span></div>`; }).join('')}
    </div>` : ''}
  </div>`;
}

export async function handlePlan(act, el, { toast, render }) {
  const p = planSettings();
  const replan = () => { st.plan = null; render(); };
  switch (act) {
    case 'planweek': st.week = el.dataset.v; st.busy = null; replan(); break;
    case 'liftdaypick': {
      const i = +el.dataset.i;
      savePlanSettings({ ...p, liftDays: p.liftDays.includes(i) ? p.liftDays.filter(x => x !== i) : [...p.liftDays, i].sort() });
      st.plan = null; break;
    }
    case 'calpick': {
      const cur = p.calendars || st.cals.filter(c => c.selected !== false).map(c => c.id);
      const id = el.dataset.id;
      savePlanSettings({ ...p, calendars: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] });
      st.plan = null; break;
    }
    case 'planset': {
      const k = el.dataset.plan, v = el.type === 'number' ? Number(el.value) : el.value;
      if (k.startsWith('dur.')) savePlanSettings({ ...p, dur: { ...p.dur, [k.slice(4)]: v } });
      else savePlanSettings({ ...p, [k]: v });
      st.plan = null; break;
    }
    case 'planbusy':
      st.working = true; render();
      try { await loadBusy(); st.busyErr = ''; } catch (e) { st.busyErr = e.code || e.message; }
      st.working = false; replan(); break;
    case 'planpush':
      st.working = true; render();
      try {
        if (!st.busy) { await loadBusy(); st.plan = null; renderPlanNow(); }
        const n = await pushPlan(st.plan.days);
        toast(`${n} blocks added to your Forge calendar`);
      } catch (e) { st.busyErr = e.code || e.message; toast('Calendar error'); }
      st.working = false; render(); break;
  }
  function renderPlanNow() { st.plan = { mon: weekStart(), days: buildPlan(st.busy) }; }
}

// Today's planned blocks, for the Today tab.
export { clock };
export function todaysBlocks(date) {
  const saved = store.get('plan:' + C.mondayOf(date));
  return saved?.find(d => d.date === date)?.blocks || null;
}
