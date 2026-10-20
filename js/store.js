// Key/value store. Everything lives in localStorage first, so the app works offline
// and without an account. When Firebase is configured and you sign in, each key is
// mirrored to Firestore at users/{uid}/docs/{key}; the newest write per key wins.
import { FIREBASE_CONFIG } from '../config.js';

const LS_KEY = 'forge:v1';
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

let docs = {};          // key -> { v, t }
let dirty = new Set();  // keys written locally that the server has not acknowledged
const listeners = new Set();
let fb = null;          // loaded Firebase handles
let user = null;
let syncState = 'local'; // local | signed-out | connecting | synced | offline | error
let syncError = '';

function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    docs = raw.docs || {};
    dirty = new Set(raw.dirty || []);
  } catch { docs = {}; dirty = new Set(); }
}
function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ docs, dirty: [...dirty] })); } catch { /* storage full or blocked */ }
}
function emit(keys) { for (const fn of listeners) fn(keys); }

export function get(key, fallback) {
  const d = docs[key];
  return d === undefined || d.v === null ? fallback : structuredClone(d.v);
}
export function keys(prefix) { return Object.keys(docs).filter(k => k.startsWith(prefix) && docs[k].v !== null).sort(); }
export function set(key, value) {
  docs[key] = { v: value, t: Date.now() };
  dirty.add(key);
  saveLocal();
  emit([key]);
  push(key);
}
// Starter data gets timestamp 1 so any real copy on the server always wins over it.
export function seed(key, value) {
  if (docs[key]) return;
  docs[key] = { v: value, t: 1 };
  dirty.add(key);
  saveLocal();
}
export function remove(key) { set(key, null); }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function allDocs() { return structuredClone(docs); }
export function importDocs(incoming) {
  for (const [k, d] of Object.entries(incoming)) {
    if (!docs[k] || (d.t || 0) > docs[k].t) { docs[k] = d; dirty.add(k); }
  }
  saveLocal(); emit(Object.keys(incoming)); flush();
}

// ---- sync ----
export const syncEnabled = () => !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey);
export const sync = () => ({ state: syncState, error: syncError, email: user?.email || '' });
function setSync(s, err = '') { syncState = s; syncError = err; emit(['__sync']); }

async function push(key) {
  if (!fb || !user) return;
  const d = docs[key];
  try {
    await fb.fs.setDoc(fb.fs.doc(fb.db, 'users', user.uid, 'docs', encodeKey(key)), { k: key, v: JSON.stringify(d.v), t: d.t });
    if (docs[key] === d) { dirty.delete(key); saveLocal(); }
  } catch (e) { setSync('error', e.message); }
}
function flush() { for (const k of [...dirty]) push(k); }
// Firestore ids cannot contain '/'.
const encodeKey = k => k.replace(/\//g, '_');

export async function initSync() {
  loadLocal();
  if (!syncEnabled()) { setSync('local'); return; }
  setSync('connecting');
  try {
    const [app, auth, fs] = await Promise.all([
      import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js'),
    ]);
    const a = app.initializeApp(FIREBASE_CONFIG);
    let db;
    try { db = fs.initializeFirestore(a, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); }
    catch { db = fs.getFirestore(a); }
    fb = { app: a, auth: auth.getAuth(a), authMod: auth, fs, db, unsub: null };
    auth.onAuthStateChanged(fb.auth, u => {
      user = u;
      if (fb.unsub) { fb.unsub(); fb.unsub = null; }
      if (!u) { setSync('signed-out'); return; }
      setSync('connecting');
      const col = fs.collection(db, 'users', u.uid, 'docs');
      let first = true;
      fb.unsub = fs.onSnapshot(col, { includeMetadataChanges: true }, snap => {
        const changed = [];
        const seen = new Set();
        snap.forEach(s => {
          const r = s.data();
          seen.add(r.k);
          const local = docs[r.k];
          if (!local || r.t > local.t) {
            docs[r.k] = { v: JSON.parse(r.v), t: r.t }; dirty.delete(r.k); changed.push(r.k);
          } else if (r.t === local.t) dirty.delete(r.k);
        });
        if (first && !snap.metadata.fromCache) {
          // Push anything written on this device before signing in, or newer than the server copy.
          for (const k of Object.keys(docs)) if (!seen.has(k)) dirty.add(k);
          first = false; flush();
        }
        saveLocal();
        if (changed.length) emit(changed);
        setSync(snap.metadata.fromCache ? 'offline' : 'synced');
      }, e => setSync('error', e.message));
    });
    window.addEventListener('online', flush);
  } catch (e) {
    setSync('error', 'Could not load sync: ' + e.message);
  }
}

export async function signInGoogle() {
  const { authMod, auth } = fb;
  const provider = new authMod.GoogleAuthProvider();
  try { await authMod.signInWithPopup(auth, provider); }
  catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await authMod.signInWithRedirect(auth, provider);
    else throw e;
  }
}
export async function signOut() { dropGoogleToken(); await fb.authMod.signOut(fb.auth); }

// Google OAuth access token with extra scopes (for Calendar). Firebase does not refresh it,
// so it is cached for 50 minutes and a new popup is shown after that.
// the Calendar access token lives about an hour; keep it across reloads so syncing doesn't
// prompt every time, and when it runs out ask Google again with your account pre-filled
// (Google skips the chooser and consent screens once you've granted them, so the popup just closes).
const TOK_KEY = 'forge:caltok';
let calTok = null;
try { calTok = JSON.parse(localStorage.getItem(TOK_KEY) || 'null'); } catch { calTok = null; }
export function dropGoogleToken() { calTok = null; try { localStorage.removeItem(TOK_KEY); } catch {} }
export async function googleToken(scopes) {
  const uid = user?.uid || null;
  if (calTok && calTok.exp > Date.now() && calTok.uid === uid && scopes.every(s => calTok.scopes?.includes(s))) return calTok.token;
  if (!fb) throw new Error('Sync is not set up yet, so Google sign-in is unavailable.');
  const { authMod: A, auth } = fb;
  const provider = new A.GoogleAuthProvider();
  scopes.forEach(s => provider.addScope(s));
  if (user?.email) provider.setCustomParameters({ login_hint: user.email });
  let res;
  if (user && user.providerData.some(p => p.providerId === 'google.com')) res = await A.reauthenticateWithPopup(user, provider);
  else res = await A.signInWithPopup(auth, provider);
  const token = A.GoogleAuthProvider.credentialFromResult(res)?.accessToken;
  if (!token) throw new Error('Google did not return calendar access.');
  calTok = { token, exp: Date.now() + 55 * 60e3, uid: res.user?.uid || uid, scopes };
  try { localStorage.setItem(TOK_KEY, JSON.stringify(calTok)); } catch {}
  return token;
}
