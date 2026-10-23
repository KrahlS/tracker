// UWorld misses. Log the question IDs you get wrong (any device, synced). On the computer
// with Anki open, Forge talks to the AnkiConnect add-on: cards tagged with a missed ID go back
// to new at the front of the queue, and IDs with no card get a new AnKing-style card drafted
// by Claude from the explanation you paste. Anki's own sync then carries it to the phone.
import * as store from './store.js';
import * as C from './calc.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ANKI_URLS = ['http://127.0.0.1:8765', 'http://localhost:8765'];
const AK_TAG = id => `#AK_MCAT_v2::#UWorld::${id}`;
const OWN_TAG = 'Forge::UWorld_Miss';
const LOCAL = 'forge:anki'; // this device only: Claude key, deck name, AnKing note type
const MODEL = 'claude-opus-5-5';

const st = { anki: null, ankiErr: '', working: '', open: {}, err: {} };

function local() { try { return JSON.parse(localStorage.getItem(LOCAL) || '{}'); } catch { return {}; } }
function setLocal(patch) { try { localStorage.setItem(LOCAL, JSON.stringify({ ...local(), ...patch })); } catch {} }
const deckName = () => local().deck || 'UWorld Misses';

// ---- misses: one synced doc per question, uwmiss:<id> ----
const missKey = id => 'uwmiss:' + id;
export const misses = () => store.keys('uwmiss:').map(k => store.get(k)).sort((a, b) => (b.missed.at(-1) || '').localeCompare(a.missed.at(-1) || '') || b.id.localeCompare(a.id));
const getMiss = id => store.get(missKey(id));
const saveMiss = m => store.set(missKey(m.id), m);

export function parseIds(text) { return [...new Set(String(text).match(/\d{5,9}/g) || [])]; }
export function addMisses(text, date = C.today()) {
  const ids = parseIds(text);
  for (const id of ids) {
    const m = getMiss(id);
    if (!m) saveMiss({ id, missed: [date], status: 'pending', note: '', src: '', drafts: [] });
    // a repeat miss sends its cards (including one Forge made) back to new again
    else if (!m.missed.includes(date)) saveMiss({ ...m, missed: [...m.missed, date], status: m.status === 'skip' ? 'skip' : 'pending' });
  }
  return ids.length;
}

// ---- AnkiConnect ----
let ankiUrl = null;
class AnkiError extends Error {}
async function anki(action, params = {}) {
  // a plain string body is sent as text/plain, which AnkiConnect accepts without a CORS preflight
  const body = JSON.stringify({ action, version: 6, params });
  let lastErr;
  for (const url of ankiUrl ? [ankiUrl] : ANKI_URLS) {
    try {
      const j = await (await fetch(url, { method: 'POST', body })).json();
      ankiUrl = url;
      if (j.error) throw new AnkiError(j.error);
      return j.result;
    } catch (e) { if (e instanceof AnkiError) throw e; lastErr = e; }
  }
  ankiUrl = null;
  throw new Error('Anki isn’t answering (' + (lastErr?.message || 'no reply') + '). Open Anki on this computer with AnkiConnect installed.');
}
async function multi(actions) {
  const res = await anki('multi', { actions: actions.map(a => ({ ...a, version: 6 })) });
  const bad = res.find(r => r && r.error);
  if (bad) throw new AnkiError(bad.error);
  return res.map(r => r.result);
}

async function connect() {
  const p = await anki('requestPermission');
  if (p.permission !== 'granted') throw new Error('Anki said no. Allow this site in the AnkiConnect popup, or add it to webCorsOriginList.');
  st.anki = { version: p.version };
  await noteType();
}

// the note type the AnKing deck uses, read from one of its notes, so new cards look the same
async function noteType() {
  const cached = local().model;
  const names = await anki('modelNames');
  if (cached && names.includes(cached.name)) return cached;
  const [nid] = await anki('findNotes', { query: 'tag:#AK_MCAT_v2::* -tag:' + OWN_TAG });
  if (!nid) throw new Error('No AnKing MCAT notes found in this Anki profile.');
  const [info] = await anki('notesInfo', { notes: [nid] });
  const fields = Object.entries(info.fields).sort((a, b) => a[1].order - b[1].order).map(([n]) => n);
  const pick = re => fields.find(f => re.test(f));
  const model = { name: info.modelName, text: pick(/^text$/i) || fields[0], extra: pick(/^extra$/i) || fields[1] };
  setLocal({ model });
  return model;
}

const cardsFor = id => anki('findCards', { query: `"tag:${AK_TAG(id)}"` });

// Back to new, first in line (due position 0). Set through the card object so Anki marks it
// changed and the reset syncs to the phone. memory_state clears FSRS's memory of the card.
const NEW_KEYS = ['type', 'queue', 'due', 'ivl', 'factor', 'left', 'memory_state'];
const NEW_VALS = [0, 0, 0, 0, 0, 0, null];
async function resetCards(cards) {
  if (!cards.length) return;
  const res = await multi(cards.map(card => ({ action: 'setSpecificValueOfCard', params: { card, keys: NEW_KEYS, newValues: NEW_VALS, warning_check: true } })));
  const fail = res.find(r => !Array.isArray(r) || r[0] !== true);
  if (fail) throw new Error('Anki refused a reset: ' + JSON.stringify(fail));
}

async function addNotes(m, drafts) {
  const model = await noteType();
  await anki('createDeck', { deck: deckName() });
  const ids = [];
  for (const d of drafts) {
    ids.push(await anki('addNote', { note: {
      deckName: deckName(), modelName: model.name,
      fields: { [model.text]: d.text, [model.extra]: d.extra || '' },
      tags: [AK_TAG(m.id), OWN_TAG],
      options: { allowDuplicate: false, duplicateScope: 'deck' },
    } }));
  }
  return ids;
}

// Check every pending miss: reset matches, mark the rest as needing a card.
async function syncAnki() {
  const todo = misses().filter(m => m.status === 'pending');
  let reset = 0, cards = 0, none = 0;
  for (const m of todo) {
    st.working = `Checking ${m.id}…`; emitRender();
    const found = await cardsFor(m.id);
    if (found.length) {
      await resetCards(found);
      saveMiss({ ...getMiss(m.id), status: 'reset', cards: found.length, doneAt: C.today() });
      reset++; cards += found.length;
    } else {
      saveMiss({ ...getMiss(m.id), status: 'nocard', cards: 0 });
      none++;
    }
  }
  await ankiSyncQuietly();
  return { reset, cards, none };
}
async function ankiSyncQuietly() { try { await anki('sync'); } catch { /* AnkiWeb not set up or busy; the next manual sync covers it */ } }

// ---- Claude drafts ----
const SYSTEM = `You write Anki cloze cards for an MCAT student, in the exact style of the AnKing MCAT deck.

The student missed a UWorld question. From their notes and the explanation, find the one to three facts they need so they don't miss it again, and write one note per fact.

AnKing style:
- Text: one short, self-contained statement (one or two sentences) with the testable term or relationship clozed as {{c1::...}}. Use c2 or c3 only when a second deletion in the same sentence is worth testing on its own card. Never cloze filler words.
- Bold key terms with <b>, underline contrasts or the mechanism word with <u>. Use HTML only, no Markdown. Use \\(...\\) for math or chemistry if needed.
- Extra: brief context that helps the card stick: the why, a contrast, or a mnemonic, as lines starting with "- " separated by <br>. No more than four lines.
- Test the concept, not this question's scenario, and don't mention UWorld.

Examples of real AnKing cards:
Text: In <u>size-exclusion</u><u> chromatography</u>, large molecules will elute {{c1::first}}.
Extra: - <b>Larger molecules</b> do not fit in the pores so they <b>elute faster</b><br>- <i>Smaller</i> molecules enter the porous gel beads causing them to <i>elute later</i>
Text: {{c1::MHC-I}} displays {{c2::endogenous antigen}} to {{c3::<i>cytotoxic CD8<sup>+</sup> T-cells</i>}}.
Extra:
Text: What is an <b>Ecclesia</b>?<br><br>{{c1::<b>Dominant </b><u>religious organizations</u> that include <b>most </b>members of <b>society</b>}}
Extra: - Lutheranism in Sweden<br>- Islam in Iran`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['notes'],
  properties: { notes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'extra'], properties: { text: { type: 'string' }, extra: { type: 'string' } } } } },
};

async function draft(m) {
  const key = local().claudeKey;
  if (!key) throw new Error('Add your Anthropic API key below to draft cards on this device.');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-api-key': key,
      'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 16000, fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Why I missed it: ${m.note || '(not given)'}\n\nExplanation:\n${m.src}` }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'Claude request failed (' + r.status + ')');
  if (j.stop_reason === 'refusal') throw new Error('Claude declined this one. Write the card by hand.');
  const text = j.content.find(b => b.type === 'text')?.text;
  return JSON.parse(text).notes.slice(0, 3);
}

// ---- view ----
let emitRender = () => {};
const STATUS = { pending: 'waiting for Anki', reset: 'reset', nocard: 'needs a card', added: 'card added', skip: 'skipped' };

export function renderMisses() {
  const all = misses(), L = local();
  const pending = all.filter(m => m.status === 'pending').length;
  const needCard = all.filter(m => m.status === 'nocard');
  const week = all.filter(m => m.missed.some(d => d > C.addDays(C.today(), -7))).length;
  const repeat = all.filter(m => m.missed.length > 1).length;
  const ankiLine = st.anki
    ? `<span class="tiny">Anki connected · new cards go to <b>${esc(deckName())}</b></span>`
    : `<span class="tiny">${st.ankiErr ? esc(st.ankiErr) : 'Open Anki on your Mac, then connect.'}</span>`;
  const rows = [...needCard, ...all.filter(m => m.status !== 'nocard')].slice(0, 40).map(m => {
    const open = st.open[m.id] ?? m.status === 'nocard';
    const body = !open ? '' : `
      <div class="uw-body">
        <label class="field"><label>Why I missed it</label><input type="text" value="${esc(m.note)}" data-uw="note" data-id="${m.id}" placeholder="mixed up MHC I and II"></label>
        ${m.status === 'reset' || m.status === 'added' ? '' : `
        <label class="field"><label>Explanation or takeaway (paste from UWorld)</label><textarea rows="4" data-uw="src" data-id="${m.id}">${esc(m.src)}</textarea></label>
        <div class="row"><button class="btn sm" data-act="uwdraft" data-id="${m.id}" ${m.src ? '' : 'disabled'}>${m.drafts?.length ? 'Redraft' : 'Draft card'}</button>
          <button class="btn sm ghost" data-act="uwmanual" data-id="${m.id}">Write my own</button>
          <button class="btn sm ghost" data-act="uwskip" data-id="${m.id}">Skip</button></div>`}
        ${(m.drafts || []).map((d, i) => `
          <div class="uw-draft">
            <label class="field"><label>Card ${i + 1} text</label><textarea rows="3" data-uw="dtext" data-id="${m.id}" data-i="${i}">${esc(d.text)}</textarea></label>
            <label class="field"><label>Extra</label><textarea rows="2" data-uw="dextra" data-id="${m.id}" data-i="${i}">${esc(d.extra)}</textarea></label>
            <div class="preview small">${clozePreview(d.text)}</div>
            <button class="btn sm ghost" data-act="uwdropdraft" data-id="${m.id}" data-i="${i}">Remove</button>
          </div>`).join('')}
        ${m.drafts?.length && m.status === 'nocard' ? `<div class="row"><button class="btn sm solid" data-act="uwadd" data-id="${m.id}" ${st.anki ? '' : 'disabled'}>Add ${m.drafts.length} to Anki</button>${st.anki ? '' : '<span class="tiny">connect Anki on your Mac to add</span>'}</div>` : ''}
        ${st.err[m.id] ? `<p class="small err">${esc(st.err[m.id])}</p>` : ''}
        <button class="btn sm ghost" data-act="uwdel" data-id="${m.id}">Delete miss</button>
      </div>`;
    return `<div class="uw-row ${m.status}">
      <div class="uw-head" data-act="uwopen" data-id="${m.id}">
        <b>${esc(m.id)}</b><span class="tiny">${C.fmtDate(m.missed.at(-1), { month: 'short', day: 'numeric' })}${m.missed.length > 1 ? ' · missed ' + m.missed.length + '×' : ''}</span>
        <span class="right tiny">${STATUS[m.status]}${m.status === 'reset' ? ` · ${m.cards} card${m.cards === 1 ? '' : 's'}` : ''}</span>
      </div>${body}</div>`;
  }).join('');
  return `
    <div class="card span2" id="uw-misses">
      <h2>UWorld misses <span class="right">${week} this week · ${repeat} repeat${repeat === 1 ? '' : 's'}</span></h2>
      <div class="row" style="align-items:flex-end">
        <label class="field" style="flex:1;min-width:200px"><label>Missed question IDs</label><input type="text" inputmode="numeric" id="uw-add" data-uw="add" placeholder="401649 402586 403112"></label>
        <button class="btn sm" data-act="uwaddids">Log</button>
      </div>
      <div class="row" style="margin-top:12px">
        ${st.anki
          ? `<button class="btn sm solid" data-act="uwsync" ${st.working || !pending ? 'disabled' : ''}>Reset ${pending} in Anki</button>`
          : `<button class="btn sm" data-act="uwconnect" ${st.working ? 'disabled' : ''}>Connect Anki</button>`}
        ${st.working ? `<span class="tiny">${esc(st.working)}</span>` : ankiLine}
      </div>
      <div class="uw-list">${rows || '<p class="small muted">Log the IDs of questions you miss. On your Mac with Anki open, one tap resets the matching AnKing cards to new, and IDs without a card get drafted into new ones.</p>'}</div>
      <details class="uw-setup"><summary class="tiny">Setup on this device</summary>
        <label class="field"><label>Anthropic API key (stays on this device)</label><input type="password" value="${esc(L.claudeKey || '')}" data-uw="key" placeholder="sk-ant-…" autocomplete="off"></label>
        <label class="field"><label>Deck for new cards</label><input type="text" value="${esc(deckName())}" data-uw="deck"></label>
        <p class="tiny">Anki needs the AnkiConnect add-on (code 2055492159). The first connect shows a popup in Anki asking to allow this site (and Chrome may ask to allow local network access). If Safari can’t reach Anki, use Chrome.</p>
      </details>
    </div>`;
}

// the front as it reads with every deletion hidden; only plain formatting tags are let through
function clozePreview(text) {
  return esc(String(text || '').replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, '\u0001'))
    .replace(/&lt;(\/?)(b|i|u|sup|sub|br|div|span)\b[^&]*?&gt;/g, '<$1$2>')
    .replace(/\u0001/g, '<span class="cl">[…]</span>');
}

export async function handleMisses(act, el, { toast, render }) {
  emitRender = render;
  const id = el.dataset.id, m = id && getMiss(id);
  const busy = async (label, fn) => {
    st.working = label; render();
    try { await fn(); } catch (e) { if (id) st.err[id] = e.message; else st.ankiErr = e.message; if (!(e instanceof AnkiError) && !id) st.anki = null; toast(e.message.slice(0, 60)); }
    st.working = ''; render();
  };
  switch (act) {
    case 'uwaddids': { const inp = document.getElementById('uw-add'); const n = addMisses(inp.value); inp.value = ''; if (n) toast(`${n} logged`); break; }
    case 'uwopen': st.open[id] = !(st.open[id] ?? m.status === 'nocard'); render(); break;
    case 'uwconnect': await busy('Connecting to Anki…', async () => { await connect(); st.ankiErr = ''; }); break;
    case 'uwsync': await busy('Resetting…', async () => {
      const r = await syncAnki();
      toast(`${r.cards} cards reset · ${r.none} need a card`);
    }); break;
    case 'uwdraft': delete st.err[id]; await busy(`Drafting ${id}…`, async () => {
      const drafts = await draft(m);
      saveMiss({ ...getMiss(id), drafts, status: 'nocard' });
      st.open[id] = true;
    }); break;
    case 'uwmanual': saveMiss({ ...m, status: 'nocard', drafts: [...(m.drafts || []), { text: '{{c1::}}', extra: '' }] }); st.open[id] = true; break;
    case 'uwdropdraft': saveMiss({ ...m, drafts: m.drafts.filter((_, i) => i !== +el.dataset.i) }); break;
    case 'uwadd': delete st.err[id]; await busy(`Adding ${id}…`, async () => {
      const drafts = m.drafts.filter(d => /\{\{c\d+::.+?\}\}/.test(d.text));
      if (!drafts.length) throw new Error('Each card needs at least one {{c1::…}} deletion.');
      const noteIds = await addNotes(m, drafts);
      // new notes land at the back of the new queue; pull them to the front like the resets
      await resetCards(await anki('findCards', { query: 'nid:' + noteIds.join(',') }));
      saveMiss({ ...getMiss(id), status: 'added', noteIds, doneAt: C.today() });
      st.open[id] = false;
      await ankiSyncQuietly();
      toast(`${noteIds.length} card${noteIds.length === 1 ? '' : 's'} added`);
    }); break;
    case 'uwskip': saveMiss({ ...m, status: 'skip' }); st.open[id] = false; break;
    case 'uwdel': store.remove(missKey(id)); break;
    default: return false;
  }
  return true;
}

// text fields: typed notes sync with the miss, the key and deck stay on this device
export function handleMissField(el) {
  const k = el.dataset.uw, id = el.dataset.id;
  if (k === 'key') { setLocal({ claudeKey: el.value.trim() }); return; }
  if (k === 'deck') { setLocal({ deck: el.value.trim() || 'UWorld Misses' }); return; }
  if (k === 'add') { const n = addMisses(el.value); el.value = ''; return n; }
  const m = getMiss(id); if (!m) return;
  if (k === 'note' || k === 'src') saveMiss({ ...m, [k]: el.value });
  else {
    const drafts = structuredClone(m.drafts); drafts[+el.dataset.i][k === 'dtext' ? 'text' : 'extra'] = el.value;
    saveMiss({ ...m, drafts });
  }
}
