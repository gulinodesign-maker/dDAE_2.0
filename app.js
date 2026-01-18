/* global API_BASE_URL, API_KEY */

/**
 * Build: incrementa questa stringa alla prossima modifica (es. 1.001)
 */
const BUILD_VERSION = "dDAE_2.023";


function __parseBuildVersion(v){
  try{
    const m = String(v||'').match(/dDAE_(\d+)\.(\d+)/);
    if(!m) return null;
    return {maj:Number(m[1]), min:Number(m[2])};
  }catch(_){ return null; }
}
function __isRemoteNewer(remote, local){
  const r = __parseBuildVersion(remote);
  const l = __parseBuildVersion(local);
  if(!r || !l) return String(remote).trim() !== String(local).trim();
  if(r.maj !== l.maj) return r.maj > l.maj;
  return r.min > l.min;
}

// =========================
// AUTH + SESSION (dDAE_2.019)
// =========================

const __SESSION_KEY = "dDAE_session_v2";
const __YEAR_KEY = "dDAE_exerciseYear";

function loadSession(){
  try{
    const raw = localStorage.getItem(__SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.user_id) return null;
    return s;
  } catch(_){ return null; }
}

function saveSession(session){
  try{ localStorage.setItem(__SESSION_KEY, JSON.stringify(session || null)); } catch(_){ }
}

function clearSession(){
  try{ localStorage.removeItem(__SESSION_KEY); } catch(_){ }
}

function loadExerciseYear(){
  try{
    const v = String(localStorage.getItem(__YEAR_KEY) || "").trim();
    const n = Number(v);
    if (isFinite(n) && n >= 2000 && n <= 2100) return String(n);
  } catch(_){ }
  return String(new Date().getFullYear());
}

function saveExerciseYear(year){
  try{ localStorage.setItem(__YEAR_KEY, String(year || "")); } catch(_){ }
}

function updateYearPill(){
  const pill = document.getElementById("yearPill");
  if (!pill) return;
  const y = state.exerciseYear;
  if (!y){ pill.hidden = true; return; }
  pill.textContent = `ANNO ${y}`;
  pill.hidden = false;
  try{ updateSettingsTabs(); }catch(_){ }
}

function updateSettingsTabs(){
  try{
    const yEl = document.getElementById("settingsYearTab");
    const aEl = document.getElementById("settingsAccountTab");

    if (yEl){
      const y = String(state.exerciseYear || "").trim();
      yEl.textContent = y ? `${y}` : "—";
    }

    if (aEl){
      const s = state.session || {};
      const raw = (s.username || s.user || s.nome || s.name || s.email || "").toString().trim();
      const label = raw ? raw : "—";
      aEl.textContent = `${label}`;
    }
  }catch(_){ }
}


// Mostra la build a runtime (se il JS è vecchio, lo vedi subito)
(function syncBuildLabel(){
  try{
    const el = document.getElementById("buildText");
    if (el) el.textContent = BUILD_VERSION;
  }catch(_){}
})();
// Aggiornamento "hard" anti-cache iOS:
// Legge ./version.json (sempre no-store) e se il build remoto è diverso
// svuota cache, deregistra SW e ricarica con cache-bust.
async function hardUpdateCheck(){
  try{
    const res = await fetch(`./version.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const remote = String(data?.build || "").trim();
    if (!remote || !__isRemoteNewer(remote, BUILD_VERSION)) return;

    try{ toast(`Aggiornamento ${remote}…`); } catch(_) {}

    try{
      if ("serviceWorker" in navigator){
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    }catch(_){}

    try{
      if (window.caches){
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    }catch(_){}

    location.href = `./?v=${encodeURIComponent(remote)}&r=${Date.now()}`;
  }catch(_){}
}
// ===== Performance mode (iOS/Safari PWA) =====
const IS_IOS = (() => {
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);
  return iOS || iPadOS;
})();

// Marca l'ambiente iOS (utile per CSS mirati)
try{ document.documentElement.classList.toggle("is-ios", IS_IOS); }catch(_){ }

function applyPerfMode(){
  try{
    const saved = localStorage.getItem("ddae_perf_mode"); // "full" | "lite"
    const mode = saved ? saved : (IS_IOS ? "lite" : "full");
    document.body.classList.toggle("perf-lite", mode === "lite");
  } catch(_){
    // fallback: su iOS attiva comunque lite
    if (IS_IOS) document.body.classList.add("perf-lite");
  }
}




// ===== Stato UI: evita "torna in HOME" quando iOS aggiorna il Service Worker =====
const __RESTORE_KEY = "__ddae_restore_state";
const __LAST_PAGE_KEY = "__ddae_last_page";
const __HASH_PREFIX = "#p=";

function __sanitizePage(p){
  try{
    if (!p) return null;
    const page = String(p).trim();
    if (!page) return null;
    const el = document.getElementById(`page-${page}`);
    return el ? page : null;
  } catch(_) { return null; }
}

function __readHashPage(){
  try{
    const h = (location.hash || "").trim();
    if (!h.startsWith(__HASH_PREFIX)) return null;
    const p = decodeURIComponent(h.slice(__HASH_PREFIX.length));
    return __sanitizePage(p);
  } catch(_) { return null; }
}

function __writeHashPage(page){
  try{
    const p = __sanitizePage(page) || "home";
    const newHash = __HASH_PREFIX + encodeURIComponent(p);
    if (location.hash !== newHash){
      history.replaceState(null, document.title, newHash);
    }
  } catch(_) {}
}

function __readRestoreState(){
  try{
    // 1) restore "one-shot" (session -> local)
    let raw = null;
    try { raw = sessionStorage.getItem(__RESTORE_KEY); } catch(_) {}
    if (!raw){
      try { raw = localStorage.getItem(__RESTORE_KEY); } catch(_) {}
    }
    if (raw){
      try { sessionStorage.removeItem(__RESTORE_KEY); } catch(_) {}
      try { localStorage.removeItem(__RESTORE_KEY); } catch(_) {}
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object"){
        if (!obj.page){
          let last = null;
          try { last = __sanitizePage(localStorage.getItem(__LAST_PAGE_KEY)); } catch(_) {}
          obj.page = __readHashPage() || last || "home";
        } else {
          obj.page = __sanitizePage(obj.page) || "home";
        }
        return obj;
      }
    }

    // 2) fallback: hash / last page (persistente)
    const pHash = __readHashPage();
    if (pHash) return { page: pHash };
    let pLast = null;
    try { pLast = __sanitizePage(localStorage.getItem(__LAST_PAGE_KEY)); } catch(_) {}
    if (pLast) return { page: pLast };
    return null;
  } catch(_) { return null; }
}

function __writeRestoreState(obj){
  const o = (obj && typeof obj === "object") ? obj : {};
  const page = __sanitizePage(o.page) || __sanitizePage(state.page) || "home";
  o.page = page;

  // 1) one-shot restore for SW reload (session + local for iOS reliability)
  try { sessionStorage.setItem(__RESTORE_KEY, JSON.stringify(o)); } catch(_) {}
  try { localStorage.setItem(__RESTORE_KEY, JSON.stringify(o)); } catch(_) {}

  // 2) persistent page memory (so even if iOS drops sessionStorage we stay on page)
  try { localStorage.setItem(__LAST_PAGE_KEY, page); } catch(_) {}
  __writeHashPage(page);
}

function __rememberPage(page){
  const p = __sanitizePage(page) || "home";
  try { localStorage.setItem(__LAST_PAGE_KEY, p); } catch(_) {}
  __writeHashPage(p);
}


// ===== Service Worker reload "safe": non interrompere i caricamenti DB =====
let __SW_RELOAD_PENDING = false;
let __SW_RELOADING = false;

function __performSwReload(){
  if (__SW_RELOADING) return;
  __SW_RELOADING = true;
  try { __writeRestoreState(__captureUiState()); } catch (_) {}
  location.reload();
}

function __requestSwReload(){
  try { __writeRestoreState(__captureUiState()); } catch (_) {}
  // Se stiamo caricando dati (API), rimanda il reload a fine richieste
  if (loadingState && loadingState.requestCount > 0){
    __SW_RELOAD_PENDING = true;
    return;
  }
  __performSwReload();
}

function __captureFormValue(id){
  try {
    const el = document.getElementById(id);
    if (!el) return null;
    return (el.type === "checkbox") ? !!el.checked : (el.value ?? "");
  } catch (_) { return null; }
}

function __applyFormValue(id, v){
  try {
    const el = document.getElementById(id);
    if (!el || v == null) return;
    if (el.type === "checkbox") el.checked = !!v;
    else el.value = String(v);
  } catch (_) {}
}

function __captureUiState(){
  // IMPORTANT:
  // Salviamo lo stato della scheda ospite SOLO se l'utente e' davvero nella pagina "ospite".
  // Su iOS/PWA un reload/restore puo' riportare in primo piano una scheda vecchia (mode/view + layout diverso)
  // anche se non e' stata richiamata.
  const shouldPersistGuest = (state.page === "ospite");

  const out = {
    page: state.page || "home",
    period: state.period || { from:"", to:"" },
    preset: state.periodPreset || "this_month",
    guest: shouldPersistGuest ? {
      mode: state.guestMode || "create",
      editId: state.guestEditId || null,
      depositType: state.guestDepositType || "contante",
      saldoType: state.guestSaldoType || "contante",
      depositReceipt: !!state.guestDepositReceipt,
      saldoReceipt: !!state.guestSaldoReceipt,
      marriage: !!state.guestMarriage,
      rooms: Array.from(state.guestRooms || []),
      lettiPerStanza: state.lettiPerStanza || {},
      form: {
        guestName: __captureFormValue("guestName"),
        guestAdults: __captureFormValue("guestAdults"),
        guestKidsU10: __captureFormValue("guestKidsU10"),
        guestCheckIn: __captureFormValue("guestCheckIn"),
        guestCheckOut: __captureFormValue("guestCheckOut"),
        guestTotal: __captureFormValue("guestTotal"),
        guestBooking: __captureFormValue("guestBooking"),
        guestDeposit: __captureFormValue("guestDeposit"),
        guestSaldo: __captureFormValue("guestSaldo"),
      }
    } : null,
    calendar: {
      anchor: (state.calendar && state.calendar.anchor) ? toISO(state.calendar.anchor) : ""
    }
  };
  return out;
}

function __applyUiState(restore){
  if (!restore || typeof restore !== "object") return;

  try {
    // periodo
    const p = restore.period || null;
    if (p && p.from && p.to) {
      setPeriod(p.from, p.to);
    }

    if (restore.preset) setPresetValue(restore.preset);

    // calendario
    if (restore.calendar?.anchor) {
      if (!state.calendar) state.calendar = { anchor: new Date(), ready:false, guests:[], rangeKey:"" };
      state.calendar.anchor = new Date(restore.calendar.anchor + "T00:00:00");
      state.calendar.ready = false;
    }

    // ospite (solo se eri in quella sezione)
    if (restore.guest) {
      state.guestMode = restore.guest.mode || state.guestMode;
      state.guestEditId = restore.guest.editId || state.guestEditId;
      state.guestDepositType = restore.guest.depositType || state.guestDepositType;
      state.guestSaldoType = restore.guest.saldoType || state.guestSaldoType;
      state.guestDepositReceipt = !!restore.guest.depositReceipt;
      state.guestSaldoReceipt = !!restore.guest.saldoReceipt;
      state.guestMarriage = !!restore.guest.marriage;

      // stanze selezionate
      try {
        state.guestRooms = new Set((restore.guest.rooms || []).map(n=>parseInt(n,10)).filter(n=>isFinite(n)));
        state.lettiPerStanza = restore.guest.lettiPerStanza || {};
      } catch (_) {}

      // campi form
      const f = restore.guest.form || {};
      __applyFormValue("guestName", f.guestName);
      __applyFormValue("guestAdults", f.guestAdults);
      __applyFormValue("guestKidsU10", f.guestKidsU10);
      __applyFormValue("guestCheckIn", f.guestCheckIn);
      __applyFormValue("guestCheckOut", f.guestCheckOut);
      __applyFormValue("guestTotal", f.guestTotal);
      __applyFormValue("guestBooking", f.guestBooking);
      __applyFormValue("guestDeposit", f.guestDeposit);
      __applyFormValue("guestSaldo", f.guestSaldo);
      try { updateGuestRemaining(); } catch (_) {}

      // UI rooms + pills
      try {
        document.querySelectorAll("#roomsPicker .room-dot").forEach(btn => {
          const n = parseInt(btn.getAttribute("data-room"), 10);
          const on = state.guestRooms.has(n);
          btn.classList.toggle("selected", on);
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
      } catch (_) {}
      try { setPayType("depositType", state.guestDepositType); } catch (_) {}
      try { setPayType("saldoType", state.guestSaldoType); } catch (_) {}
      try { setPayReceipt("depositType", state.guestDepositReceipt); } catch (_) {}
      try { setPayReceipt("saldoType", state.guestSaldoReceipt); } catch (_) {}
      try { setMarriage(state.guestMarriage); } catch (_) {}
    }

  } catch (_) {}
}


function genId(prefix){
  return `${prefix}_${Date.now()}_${Math.floor(Math.random()*1000000)}`;
}

const $ = (sel) => document.querySelector(sel);

function setMarriage(on){
  state.guestMarriage = !!on;
  const btn = document.getElementById("roomMarriage");
  if (!btn) return;
  btn.classList.toggle("selected", state.guestMarriage);
  btn.setAttribute("aria-pressed", state.guestMarriage ? "true" : "false");
}


function setPayType(containerId, type){
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const t = (type || "contante").toString().toLowerCase();
  wrap.querySelectorAll(".pay-dot[data-type]").forEach(b => {
    const v = (b.getAttribute("data-type") || "").toLowerCase();
    const on = v === t;
    b.classList.toggle("selected", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}


function setPayReceipt(containerId, on){
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const btn = wrap.querySelector('.pay-dot[data-receipt]');
  if (!btn) return;
  const active = !!on;
  btn.classList.toggle("selected", active);
  btn.setAttribute("aria-pressed", active ? "true" : "false");
}



function setRegFlag(containerId, flag, on){
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const btn = wrap.querySelector(`.pay-dot[data-flag="${flag}"]`);
  if (!btn) return;
  const active = !!on;
  btn.classList.toggle("selected", active);
  btn.setAttribute("aria-pressed", active ? "true" : "false");
}

function setRegFlags(containerId, psOn, istatOn){
  setRegFlag(containerId, "ps", psOn);
  setRegFlag(containerId, "istat", istatOn);
}

function truthy(v){
  if (v === true) return true;
  if (v === false || v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return (s === "1" || s === "true" || s === "yes" || s === "si" || s === "on");
}

// dDAE_2.019 — error overlay: evita blocchi silenziosi su iPhone PWA
window.addEventListener("error", (e) => {
  try {
    const msg = (e?.message || "Errore JS") + (e?.filename ? ` @ ${e.filename.split("/").pop()}:${e.lineno||0}` : "");
    console.error("JS error", e?.error || e);
    toast(msg);
  } catch (_) {}
});
window.addEventListener("unhandledrejection", (e) => {
  try {
    console.error("Unhandled promise rejection", e?.reason || e);
    const msg = (e?.reason?.message || e?.reason || "Promise rejection").toString();
    toast("Errore: " + msg);
  } catch (_) {}
});

const state = {
  navId: 0,
  cleanDay: null,

  motivazioni: [],
  spese: [],
  report: null,
  _dataKey: "",
  period: { from: "", to: "" },
  periodPreset: "this_month",
  page: "home",
  speseView: "list",
  guests: [],
  stanzeRows: [],
  stanzeByKey: {},
  guestRooms: new Set(),
  guestDepositType: "contante",
  guestEditId: null,
  guestMode: "create",
  lettiPerStanza: {},
    bedsDirty: false,
  stanzeSnapshotOriginal: "",
guestMarriage: false,
  guestSaldoType: "contante",
  guestPSRegistered: false,
  guestISTATRegistered: false,
  // Scheda ospite (sola lettura): ultimo ospite aperto
  guestViewItem: null,

  // Lavanderia (resoconti settimanali)
  laundry: { list: [], current: null },
  // Impostazioni (foglio "impostazioni")
  settings: { loaded: false, byKey: {}, rows: [], loadedAt: 0 },

  // Auth/session + anno esercizio
  session: null,
  exerciseYear: null,
};

const COLORS = {
  CONTANTI: "#2b7cb4",          // palette
  TASSA_SOGGIORNO: "#bfbea9",   // palette
  IVA_22: "#c9772b",            // palette
  IVA_10: "#6fb7d6",            // palette
  IVA_4: "#4d9cc5",             // palette
};


// Loader globale (gestisce richieste parallele + anti-flicker)
const loadingState = {
  requestCount: 0,
  showTimer: null,
  shownAt: 0,
  isVisible: false,
  delayMs: 500,      // opzionale: evita flicker se rapidissimo
  minVisibleMs: 300, // opzionale: se compare non sparisce subito
};

function showLoading(){
  const ov = document.getElementById("loadingOverlay");
  if (!ov) return;
  ov.hidden = false;
  loadingState.isVisible = true;
  loadingState.shownAt = performance.now();
}

function hideLoading(){
  const ov = document.getElementById("loadingOverlay");
  if (!ov) return;
  ov.hidden = true;
  loadingState.isVisible = false;
}

function beginRequest(){
  loadingState.requestCount += 1;
  if (loadingState.requestCount !== 1) return;

  // Programma la comparsa dopo delayMs
  if (loadingState.showTimer) clearTimeout(loadingState.showTimer);
  loadingState.showTimer = setTimeout(() => {
    if (loadingState.requestCount > 0 && !loadingState.isVisible) {
      showLoading();
    }
  }, loadingState.delayMs);
}

function endRequest(){
  loadingState.requestCount = Math.max(0, loadingState.requestCount - 1);
  if (loadingState.requestCount !== 0) return;

  if (loadingState.showTimer) {
    clearTimeout(loadingState.showTimer);
    loadingState.showTimer = null;
  }

  // Se il SW ha chiesto un reload mentre caricavamo, fallo ora che siamo "idle"
  if (__SW_RELOAD_PENDING && !__SW_RELOADING){
    __SW_RELOAD_PENDING = false;
    // micro-delay: lascia aggiornare UI/loader
    setTimeout(() => __performSwReload(), 50);
    // non serve gestire ulteriormente il loader
    return;
  }

  // Se non è mai comparso, fine.
  if (!loadingState.isVisible) return;

  const elapsed = performance.now() - (loadingState.shownAt || performance.now());
  const remaining = loadingState.minVisibleMs - elapsed;
  if (remaining > 0) {
    setTimeout(() => {
      // Ricontrollo: potrebbe essere partita un'altra richiesta.
      if (loadingState.requestCount === 0) hideLoading();
    }, remaining);
  } else {
    hideLoading();
  }
}

function euro(n){
  const x = Number(n || 0);
  return x.toLocaleString("it-IT", { style:"currency", currency:"EUR" });
}

let __toastTimer = null;
function toast(msg, kind){
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  // kind: "blue" | "orange" | "" (default)
  t.dataset.kind = kind ? String(kind) : "";
  t.classList.add("show");
  try{ if (__toastTimer) clearTimeout(__toastTimer); }catch(_ ){}
  __toastTimer = setTimeout(() => {
    t.classList.remove("show");
    t.dataset.kind = "";
  }, 1700);
}

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

// --- Guest status LED (scheda ospiti) ---
function _dayNumFromISO(iso){
  if (!iso || typeof iso !== 'string') return null;

  // ISO datetime (es: 2026-01-05T23:00:00.000Z) -> converti in data locale (YYYY-MM-DD)
  if (iso.includes("T")) {
    const dt = new Date(iso);
    if (!isNaN(dt)) {
      return Math.floor(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) / 86400000);
    }
    iso = iso.split("T")[0];
  }

  // Support both YYYY-MM-DD and DD/MM/YYYY
  if (iso.includes('/')) {
    const parts = iso.split('/').map(n=>parseInt(n,10));
    if (parts.length === 3 && parts.every(n=>isFinite(n))) {
      const [dd,mm,yy] = parts;
      return Math.floor(Date.UTC(yy, mm-1, dd) / 86400000);
    }
  }

  const parts = iso.split('-').map(n=>parseInt(n,10));
  if (parts.length !== 3 || parts.some(n=>!isFinite(n))) return null;
  const [y,m,d] = parts;
  // day number in UTC to avoid DST issues
  return Math.floor(Date.UTC(y, m-1, d) / 86400000);
}

function guestLedStatus(item){
  const ci = item?.check_in || item?.checkIn || "";
  const co = item?.check_out || item?.checkOut || "";

  const t = _dayNumFromISO(todayISO());
  const dIn = _dayNumFromISO(ci);
  const dOut = _dayNumFromISO(co);

  const isOneNight = (dIn != null && dOut != null && (dOut - dIn) === 1);

  if (t == null) return { cls: "led-gray", label: "Nessuna scadenza" };

  // Priorità: check-out (rosso) > giorno prima check-out (arancione) > dopo check-in (verde) > grigio
  if (dOut != null) {
    if (t === dOut) return { cls: "led-red", label: "Check-out oggi" };
    if (t > dOut) return { cls: "led-red", label: "Check-out passato" };

    // Giorno prima del check-out
    if (t === (dOut - 1)) {
      // Caso speciale: 1 notte -> il giorno prima del check-out coincide col check-in
      if (isOneNight && dIn === (dOut - 1)) {
        return { cls: "led-yellow", label: "1 notte: arrivo oggi (LED giallo)" };
      }
      return { cls: "led-orange", label: "Check-out domani" };
    }
  }

  if (dIn != null) {
    if (t === dIn) return { cls: "led-green", label: "Check-in oggi" };
    if (t > dIn) return { cls: "led-green", label: "In soggiorno" };
    return { cls: "led-gray", label: "In arrivo" };
  }

  return { cls: "led-gray", label: "Nessuna data" };
}





function toISO(d){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatISODateLocal(value){
  if (!value) return "";
  const s = String(value);

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // ISO datetime -> local date
  if (s.includes("T")) {
    const dt = new Date(s);
    if (!isNaN(dt)) return toISO(dt); // toISO usa date locale
    return s.split("T")[0];
  }

  // Fallback: DD/MM/YYYY
  if (s.includes("/")) {
    const parts = s.split("/").map(x=>parseInt(x,10));
    if (parts.length === 3 && parts.every(n=>isFinite(n))) {
      const [dd,mm,yy] = parts;
      const dt = new Date(yy, mm-1, dd);
      return toISO(dt);
    }
  }

  // Last resort: cut
  return s.slice(0,10);
}

// 2026-01-01 -> "1 Gennaio 2026" (mese con iniziale maiuscola)
function formatLongDateIT(value){
  const iso = formatISODateLocal(value);
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y,m,d] = iso.split("-").map(n=>parseInt(n,10));
  const dt = new Date(y, (m-1), d);
  if (isNaN(dt)) return "";
  const s = dt.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  // capitalizza il mese (in it-IT normalmente è minuscolo)
  // es: "1 gennaio 2026" -> "1 Gennaio 2026"
  const parts = s.split(" ");
  if (parts.length >= 3) {
    parts[1] = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    return parts.join(" ");
  }
  return s;
}

function formatShortDateIT(input){
  try{
    if (!input) return "";
    const s = String(input).trim();

    // ISO datetime (con T/Z): non usare slice(0,10) perché può "scalare" di 1 giorno
    if (s.includes("T")) {
      const dt = new Date(s);
      if (!isNaN(dt)){
        const dd = String(dt.getDate()).padStart(2,"0");
        const mm = String(dt.getMonth()+1).padStart(2,"0");
        const yy = String(dt.getFullYear()).slice(-2);
        return `${dd}/${mm}/${yy}`;
      }
    }

    // YYYY-MM-DD
    const iso = s.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)){
      const [y,m,d] = iso.split("-");
      return `${d}/${m}/${y.slice(-2)}`;
    }

    // fallback Date parse
    const dt = new Date(s);
    if (!isNaN(dt)){
      const dd = String(dt.getDate()).padStart(2,"0");
      const mm = String(dt.getMonth()+1).padStart(2,"0");
      const yy = String(dt.getFullYear()).slice(-2);
      return `${dd}/${mm}/${yy}`;
    }
    return iso;
  }catch(_){
    return "";
  }
}


function formatFullDateIT(d){
  try{
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt)) return "";
    const months = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
    const weekdays = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
    const wd = weekdays[dt.getDay()] || "";
    const day = dt.getDate();
    const month = months[dt.getMonth()];
    const year = dt.getFullYear();
    return `${wd} ${day} ${month} ${year}`;
  }catch(_){ return ""; }
}

function startOfLocalDay(d){
  const dt = (d instanceof Date) ? new Date(d) : new Date(d);
  dt.setHours(0,0,0,0);
  return dt;
}

function toISODateLocal(d){
  const dt = startOfLocalDay(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,"0");
  const da = String(dt.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}



function spesaCategoryClass(s){
  // "campo X": categoria (fallback: aliquotaIva)
  const catRaw = (s?.categoria ?? s?.cat ?? "").toString().trim().toLowerCase();
  const aliq = (s?.aliquotaIva ?? s?.aliquota_iva ?? "").toString().trim();

  // Normalizza varianti
  if (catRaw.includes("contant")) return "spesa-bg-contanti";
  if (catRaw.includes("tassa") && catRaw.includes("sogg")) return "spesa-bg-tassa";

  // IVA
  if (catRaw.includes("iva")){
    if (catRaw.includes("22")) return "spesa-bg-iva22";
    if (catRaw.includes("10")) return "spesa-bg-iva10";
    if (catRaw.includes("4")) return "spesa-bg-iva4";
  }

  // Fallback su aliquota numerica
  const n = parseFloat(String(aliq).replace(",", "."));
  if (!isNaN(n)){
    if (n >= 21.5) return "spesa-bg-iva22";
    if (n >= 9.5 && n < 11.5) return "spesa-bg-iva10";
    if (n >= 3.5 && n < 5.5) return "spesa-bg-iva4";
  }

  return ""; // nessun colore
}





function calcStayNights(ospite){
  // Calcola le notti tra check-in e check-out (date ISO), robusto per Safari/iOS (usa Date.UTC)
  const inRaw  = ospite?.check_in ?? ospite?.checkIn ?? "";
  const outRaw = ospite?.check_out ?? ospite?.checkOut ?? "";
  const inISO  = formatISODateLocal(inRaw);
  const outISO = formatISODateLocal(outRaw);

  if (!inISO || !outISO) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inISO) || !/^\d{4}-\d{2}-\d{2}$/.test(outISO)) return null;

  const [yi, mi, di] = inISO.split("-").map(n => parseInt(n, 10));
  const [yo, mo, do_] = outISO.split("-").map(n => parseInt(n, 10));

  const tIn  = Date.UTC(yi, mi - 1, di);
  const tOut = Date.UTC(yo, mo - 1, do_);

  const diff = Math.round((tOut - tIn) / 86400000);
  if (!isFinite(diff) || diff <= 0) return null;
  return diff;
}

function formatEUR(value){
  const n = Number(value || 0);
  try{
    return n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  }catch(_){
    // fallback
    return "€" + (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");
  }
}

function calcTouristTax(ospite, nights){
  // Tassa di soggiorno: per persona > 10 anni (usa 'adulti'), max 3 giorni consecutivi
  const adultsRaw = ospite?.adulti ?? ospite?.adults ?? 0;
  const adults = Math.max(0, parseInt(adultsRaw, 10) || 0);

  const nNights = Math.max(0, parseInt(nights, 10) || 0);
  const taxableDays = Math.min(nNights, 3);

  const rate = (state.settings && state.settings.loaded) ? getSettingNumber("tassa_soggiorno", (typeof TOURIST_TAX_EUR_PPN !== "undefined" ? TOURIST_TAX_EUR_PPN : 0)) : ((typeof TOURIST_TAX_EUR_PPN !== "undefined") ? Number(TOURIST_TAX_EUR_PPN) : 0);
  const r = isFinite(rate) ? Math.max(0, rate) : 0;

  const total = adults * taxableDays * r;
  return { total, adults, taxableDays, rate: r };
}


function monthRangeISO(date = new Date()){
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m+1, 0);
  return [toISO(start), toISO(end)];
}


// Period preset (scroll picker iOS) — nessuna API extra
let periodSyncLock = 0;
let presetSyncLock = 0;

function addDaysISO(iso, delta){
  const [y,m,d] = iso.split("-").map(n=>parseInt(n,10));
  const dt = new Date(y, (m-1), d);
  dt.setDate(dt.getDate() + delta);
  return toISO(dt);
}

function monthRangeFromYM(ym){
  const [yy,mm] = ym.split("-").map(n=>parseInt(n,10));
  const start = new Date(yy, mm-1, 1);
  const end = new Date(yy, mm, 0);
  return [toISO(start), toISO(end)];
}

function recentMonths(n=8){
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i=0;i<n;i++){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    out.push(`${y}-${m}`);
    d.setMonth(d.getMonth()-1);
  }
  return out;
}

function buildPeriodPresetOptions(){
  const opts = [
    { value:"this_month", label:"Questo mese" },
    { value:"last_month", label:"Mese scorso" },
    { value:"last_7", label:"Ultimi 7 giorni" },
    { value:"last_30", label:"Ultimi 30 giorni" },
    { value:"ytd", label:"Anno corrente" },
    { value:"all", label:"Tutto" },
  ];
  for (const ym of recentMonths(8)){
    opts.push({ value:`month:${ym}`, label: ym });
  }
  opts.push({ value:"custom", label:"Personalizzato" });
  return opts;
}

function fillPresetSelect(selectEl){
  if (!selectEl) return;
  const opts = buildPeriodPresetOptions();
  selectEl.innerHTML = "";
  for (const o of opts){
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    selectEl.appendChild(opt);
  }
}

function setPresetValue(value){
  state.periodPreset = value;
  presetSyncLock += 1;
  try {
    const sels = ["#periodPreset1","#periodPreset2","#periodPreset3"]
      .map(s => document.querySelector(s))
      .filter(Boolean);
    for (const s of sels) s.value = value;
  } finally {
    presetSyncLock -= 1;
  }
}

function presetToRange(value){
  const today = todayISO();
  if (value === "this_month") return monthRangeISO(new Date());
  if (value === "last_month"){
    const d = new Date();
    d.setMonth(d.getMonth()-1);
    return monthRangeISO(d);
  }
  if (value === "last_7") return [addDaysISO(today, -6), today];
  if (value === "last_30") return [addDaysISO(today, -29), today];
  if (value === "ytd"){
    const y = new Date().getFullYear();
    return [`${y}-01-01`, today];
  }
  if (value === "all") return ["2000-01-01", today];
  if (value && value.startsWith("month:")){
    const ym = value.split(":")[1];
    return monthRangeFromYM(ym);
  }
  return null;
}

function bindPresetSelect(sel){
  const el = document.querySelector(sel);
  if (!el) return;
  fillPresetSelect(el);
  el.value = state.periodPreset || "this_month";

  el.addEventListener("change", async () => {
    if (presetSyncLock > 0) return;
    const v = el.value;
    const range = presetToRange(v);
    setPresetValue(v);
    if (!range) return;
    const [from,to] = range;

    setPeriod(from,to);

    try { await onPeriodChanged({ showLoader:false }); } catch (e) { toast(e.message); }
  });
}

function categoriaLabel(cat){
  return ({
    CONTANTI: "Contanti",
    TASSA_SOGGIORNO: "Tassa soggiorno",
    IVA_22: "IVA 22%",
    IVA_10: "IVA 10%",
    IVA_4: "IVA 4%",
  })[cat] || cat;
}

async function api(action, { method="GET", params={}, body=null, showLoader=true } = {}){
  if (showLoader) beginRequest();
  try {
  if (!API_BASE_URL || API_BASE_URL.includes("INCOLLA_QUI")) {
    throw new Error("Config mancante: imposta API_BASE_URL in config.js");
  }

  const url = new URL(API_BASE_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("apiKey", API_KEY);
  // Cache-busting for iOS/Safari aggressive caching
  url.searchParams.set("_ts", String(Date.now()));

  // Context multi-account (user + anno)
  try{
    if (state && state.session && state.session.user_id && action !== "utenti" && action !== "ping"){
      if (!params) params = {};
      if (params.user_id === undefined || params.user_id === null || String(params.user_id).trim() === "") {
        params.user_id = String(state.session.user_id);
      }
      if (params.anno === undefined || params.anno === null || String(params.anno).trim() === "") {
        params.anno = String(state.exerciseYear || "");
      }
    }
  }catch(_){ }

  Object.entries(params || {}).forEach(([k,v]) => {
    if (v !== undefined && v !== null && String(v).length) url.searchParams.set(k, v);
  });

  let realMethod = method;
  if (method === "PUT" || method === "DELETE") {
    url.searchParams.set("_method", method);
    realMethod = "POST";
  }

  // Timeout concreto: evita loader infinito su iOS quando la rete “si pianta”
const controller = new AbortController();
const t = setTimeout(() => controller.abort(), 15000);

const fetchOpts = {
  method: realMethod,
  signal: controller.signal,
  cache: "no-store",
};

// Headers/body solo quando serve (riduce rischi di preflight su Safari iOS)
if (realMethod !== "GET") {
  fetchOpts.headers = { "Content-Type": "text/plain;charset=utf-8" };
  let payload = body;
  // Inietta user_id/anno su POST/PUT (se mancano)
  try{
    if (state && state.session && state.session.user_id && action !== "utenti"){
      const uid = String(state.session.user_id);
      const yr = String(state.exerciseYear || "");
      const addCtx = (o)=>{
        if (!o || typeof o !== "object") return o;
        if (o.user_id === undefined || o.user_id === null || String(o.user_id).trim() === "") o.user_id = uid;
        if (o.anno === undefined || o.anno === null || String(o.anno).trim() === "") o.anno = yr;
        return o;
      };

      const deep = (x, depth = 0)=>{
        if (!x || typeof x !== "object") return x;
        if (Array.isArray(x)) return x.map(v => deep(v, depth));
        addCtx(x);
        if (depth >= 1) return x;
        // pattern comuni: bulk payloads
        ["rows","items","records","data","list"].forEach((k)=>{
          const v = x[k];
          if (Array.isArray(v)) x[k] = v.map(r => deep(r, depth + 1));
        });
        return x;
      };

      payload = deep(payload, 0);
    }
  }catch(_){ }
  fetchOpts.body = payload ? JSON.stringify(payload) : "{}";
}

let res;
try {
  try {
  res = await fetch(url.toString(), fetchOpts);
} catch (err) {
  const msg = String(err && err.message || err || "");
  if (msg.toLowerCase().includes("failed to fetch")) {
    throw new Error("Failed to fetch (API). Verifica: 1) Web App Apps Script distribuita come 'Chiunque', 2) URL /exec corretto, 3) rete iPhone ok. Se hai appena aggiornato lo script, ridistribuisci una nuova versione.");
  }
  throw err;
}
} finally {
  clearTimeout(t);
}

let json;
try {
  json = await res.json();
} catch (_) {
  throw new Error("Risposta non valida dal server");
}

if (!json.ok) throw new Error(json.error || "API error");
return json.data;
  } finally { if (showLoader) endRequest(); }
}


// =========================
// IMPOSTAZIONI (foglio Google "impostazioni")
// Chiavi usate:
// - operatori  -> colonne operatore_1/2/3
// - tariffa_oraria -> value (number)
// - costo_benzina  -> value (number)
// - tassa_soggiorno -> value (number)
// =========================

function __normKey(k) {
  return String(k || "").trim().toLowerCase();
}

function __parseSettingsRows(rows) {
  const byKey = {};
  (Array.isArray(rows) ? rows : []).forEach(r => {
    const key = __normKey(r?.key ?? r?.Key ?? r?.KEY);
    if (!key) return;
    byKey[key] = r;
  });
  return byKey;
}

function getSettingRow(key) {
  const k = __normKey(key);
  return (state.settings && state.settings.byKey && state.settings.byKey[k]) ? state.settings.byKey[k] : null;
}

function getSettingText(key, fallback = "") {
  const row = getSettingRow(key);
  const v = row ? (row.value ?? row.Value ?? row.val ?? "") : "";
  const s = String(v ?? "").trim();
  return s ? s : String(fallback ?? "");
}

function getSettingNumber(key, fallback = 0) {
  const row = getSettingRow(key);
  let v = row ? (row.value ?? row.Value ?? row.val ?? "") : "";
  if (v === null || v === undefined) v = "";
  const s = String(v).trim().replace(",", ".");
  if (!s) return Number(fallback) || 0;
  const n = Number(s);
  return isFinite(n) ? n : (Number(fallback) || 0);
}

function getOperatorNamesFromSettings() {
  const row = getSettingRow("operatori");
  const op1 = String(row?.operatore_1 ?? row?.Operatore_1 ?? row?.operatore1 ?? "").trim();
  const op2 = String(row?.operatore_2 ?? row?.Operatore_2 ?? row?.operatore2 ?? "").trim();
  const op3 = String(row?.operatore_3 ?? row?.Operatore_3 ?? row?.operatore3 ?? "").trim();
  return [op1, op2, op3];
}

async function ensureSettingsLoaded({ force = false, showLoader = false } = {}) {
  try {
    if (!force && state.settings?.loaded) return state.settings;
    const data = await api("impostazioni", { method: "GET", showLoader });
    const rows = data?.rows || data?.items || [];
    state.settings.rows = Array.isArray(rows) ? rows : [];
    state.settings.byKey = __parseSettingsRows(state.settings.rows);
    state.settings.loaded = true;
    state.settings.loadedAt = Date.now();

    // Se esistono campi operatori (pulizie), mostra i nomi salvati (non editabili)
    try {
      const names = getOperatorNamesFromSettings(); // [op1, op2, op3]
const ids = ["op1Name","op2Name","op3Name"];
ids.forEach((id, idx) => {
  const el = document.getElementById(id);
  if (!el) return;
  const name = String(names[idx] || "").trim();

  // Nascondi completamente l'operatore se non è impostato
  const row = el.closest ? el.closest(".clean-op-row") : null;
  if (!name) {
    if (row) row.style.display = "none";
    el.textContent = "";
    el.classList.remove("is-placeholder");
    return;
  } else {
    if (row) row.style.display = "";
  }

  // Se è un input (compat), rendilo readOnly e compila
  if (String(el.tagName || "").toUpperCase() === "INPUT") {
    el.readOnly = true;
    el.setAttribute("readonly", "");
    el.value = name;
    return;
  }

  // Altrimenti è un testo (div/span)
  el.textContent = name;
  el.classList.remove("is-placeholder");
});

refreshFloatingLabels();
    } catch(_) {}

    return state.settings;
  } catch (e) {
    // Non bloccare l'app se il foglio non è ancora pronto
    console.warn("Impostazioni: load failed", e);
    return state.settings;
  }
}

async function loadImpostazioniPage({ force = false } = {}) {
  await ensureSettingsLoaded({ force, showLoader: true });
  try {
    const rOps = getSettingRow("operatori") || {};
    const op1 = String(rOps.operatore_1 ?? "").trim();
    const op2 = String(rOps.operatore_2 ?? "").trim();
    const op3 = String(rOps.operatore_3 ?? "").trim();

    const el1 = document.getElementById("setOp1");
    const el2 = document.getElementById("setOp2");
    const el3 = document.getElementById("setOp3");
    if (el1) el1.value = op1;
    if (el2) el2.value = op2;
    if (el3) el3.value = op3;

    const t = document.getElementById("setTariffa");
    const b = document.getElementById("setBenzina");
    const ts = document.getElementById("setTassa");

    if (t) t.value = String(getSettingNumber("tariffa_oraria", 0) || "");
    if (b) b.value = String(getSettingNumber("costo_benzina", 0) || "");
    if (ts) ts.value = String(getSettingNumber("tassa_soggiorno", (typeof TOURIST_TAX_EUR_PPN !== "undefined" ? TOURIST_TAX_EUR_PPN : 0)) || "");

    refreshFloatingLabels();
  } catch (e) {
    toast(e.message);
  }
}

function __readNumInput(id) {
  const el = document.getElementById(id);
  const raw = el ? String(el.value || "").trim() : "";
  if (!raw) return "";
  const n = Number(raw.replace(",", "."));
  if (!isFinite(n) || n < 0) return "";
  return Math.round(n * 100) / 100;
}

async function saveImpostazioniPage() {
  const op1 = String(document.getElementById("setOp1")?.value || "").trim();
  const op2 = String(document.getElementById("setOp2")?.value || "").trim();
  const op3 = String(document.getElementById("setOp3")?.value || "").trim();

  const tariffa = __readNumInput("setTariffa");
  const benzina = __readNumInput("setBenzina");
  const tassa = __readNumInput("setTassa");

  const payload = {
    operatori: [op1, op2, op3],
    tariffa_oraria: tariffa,
    costo_benzina: benzina,
    tassa_soggiorno: tassa,
  };

  await api("impostazioni", { method: "POST", body: payload, showLoader: true });
  await ensureSettingsLoaded({ force: true, showLoader: false });

  toast("Impostazioni salvate");
}

function setupImpostazioni() {
  const back = document.getElementById("settingsBackBtn");
  if (back) back.addEventListener("click", () => showPage("home"));

  const save = document.getElementById("settingsSaveBtn");
  if (save) save.addEventListener("click", async () => {
    try { await saveImpostazioniPage(); } catch (e) { toast(e.message); }
  });

  const reload = document.getElementById("settingsReloadBtn");
  if (reload) reload.addEventListener("click", async () => {
    try { await loadImpostazioniPage({ force: true }); toast("Impostazioni ricaricate"); } catch (e) { toast(e.message); }
  });

  const del = document.getElementById("settingsDeleteBtn");
  if (del) bindFastTap(del, async () => {
    try{
      const s = state.session || loadSession();
      if (!s || !s.username){ toast("Nessun account"); return; }

      const ok = confirm("Eliminare definitivamente questo account e tutti i suoi dati?");
      if (!ok) return;

      const pwd = prompt("Password dell'account da eliminare:");
      if (pwd === null) return;
      const password = String(pwd || "");
      if (!password) { toast("Password mancante"); return; }

      await api("utenti", { method:"POST", body:{ op:"delete", username: String(s.username||"").trim(), password } , showLoader:true });

      try{ clearSession(); }catch(_){ }
      try{ state.session = null; }catch(_){ }
      try{ invalidateApiCache(); }catch(_){ }
      try{ __lsClearAll(); }catch(_){ }
      toast("Account eliminato");
      try{ showPage("auth"); }catch(_){ }
    }catch(e){ toast(e.message || "Errore"); }
  });

  const logout = document.getElementById("settingsLogoutBtn");
  if (logout) logout.addEventListener("click", () => {
    try{ clearSession(); }catch(_){ }
    try{ state.session = null; }catch(_){ }
    try{ invalidateApiCache(); }catch(_){ }
    try{ showPage("auth"); }catch(_){ }
  });


  // Anno di esercizio
  const selAnno = document.getElementById("setAnno");
  if (selAnno){
    const cy = new Date().getFullYear();
    const years = [];
    for (let y = cy - 3; y <= cy + 2; y++) years.push(String(y));
    selAnno.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
    selAnno.value = String(state.exerciseYear || loadExerciseYear());
    selAnno.addEventListener("change", () => {
      state.exerciseYear = String(selAnno.value || "");
      saveExerciseYear(state.exerciseYear);
      updateYearPill();
      invalidateApiCache();
    });
  }
}


function setupAuth(){
  const u = document.getElementById("authUsername");
  const p = document.getElementById("authPassword");
  const hint = document.getElementById("authHint");

  const extra = document.getElementById("authExtra");
  const nome = document.getElementById("authNome");
  const tel = document.getElementById("authTelefono");
  const email = document.getElementById("authEmail");
  const p2 = document.getElementById("authPassword2");
  const p2Wrap = document.getElementById("authConfirmPasswordWrap");
  const np = document.getElementById("authNewPassword");
  const np2 = document.getElementById("authNewPassword2");
  const npWrap = document.getElementById("authNewPasswordWrap");

  const setHint = (msg)=>{ try{ if (hint) hint.textContent = msg || ""; }catch(_){ } };

  const btnCreate = document.getElementById("btnCreateAccount");
  const btnEdit = document.getElementById("btnEditAccount");
  const btnLogin = document.getElementById("btnLogin");

  let mode = "login"; // login | create | edit

  const setMode = (m)=>{
    mode = m;
    // active button styling
    try{
      [btnCreate, btnEdit, btnLogin].forEach(b=>b && b.classList.remove("is-active"));
      if (m === "create" && btnCreate) btnCreate.classList.add("is-active");
      if (m === "edit" && btnEdit) btnEdit.classList.add("is-active");
      if (m === "login" && btnLogin) btnLogin.classList.add("is-active");
    }catch(_){ }

    // show/hide extra form
    const needExtra = (m === "create" || m === "edit");
    if (extra) extra.hidden = !needExtra;

    if (p2Wrap) p2Wrap.hidden = (m !== "create");
    if (npWrap) npWrap.hidden = (m !== "edit");

    // reset fields that don't apply
    if (m !== "create" && p2) p2.value = "";
    if (m !== "edit"){
      if (np) np.value = "";
      if (np2) np2.value = "";
    }

    if (m === "login") setHint("");
    if (m === "create") setHint("Inserisci i dati e premi di nuovo: crea account");
    if (m === "edit") setHint("Inserisci i dati e premi di nuovo: modifica account");
  };

  const readCreds = ()=>({
    username: String(u?.value||"").trim(),
    password: String(p?.value||"")
  });

  const readProfile = ()=>({
    nome: String(nome?.value||"").trim(),
    telefono: String(tel?.value||"").trim(),
    email: String(email?.value||"").trim(),
  });

  // default state
  setMode("login");

  if (btnCreate) bindFastTap(btnCreate, async ()=>{
    if (mode !== "create"){
      setMode("create");
      try{ u && u.focus(); }catch(_){ }
      return;
    }

    const {username, password} = readCreds();
    const profile = readProfile();
    const confirm = String(p2?.value||"");

    if (!username || !password) { setHint("Inserisci username e password"); return; }
    if (password !== confirm) { setHint("Le password non coincidono"); return; }

    try{
      setHint("...");
      const data = await api("utenti", { method:"POST", body:{ op:"create", username, password, ...profile } });
      setHint("Account creato");
      if (data && data.user){
        state.session = data.user;
        saveSession(state.session);
        state.exerciseYear = loadExerciseYear();
        updateYearPill();
        showPage("home");
      }
    } catch(e){ setHint(e.message || "Errore"); }
  });

  if (btnEdit) bindFastTap(btnEdit, async ()=>{
    if (mode !== "edit"){
      setMode("edit");
      try{ u && u.focus(); }catch(_){ }
      return;
    }

    const {username, password} = readCreds();
    const profile = readProfile();
    const newPassword = String(np?.value||"");
    const newPassword2 = String(np2?.value||"");

    if (!username || !password) { setHint("Inserisci username e password"); return; }
    if ((newPassword || newPassword2) && newPassword !== newPassword2) { setHint("Le nuove password non coincidono"); return; }

    try{
      setHint("...");
      const data = await api("utenti", { method:"POST", body:{ op:"update", username, password, newPassword, ...profile } });
      setHint("Account aggiornato");
      if (data && data.user){
        state.session = data.user;
        saveSession(state.session);
      }
    } catch(e){ setHint(e.message || "Errore"); }
  });

  if (btnLogin) bindFastTap(btnLogin, async ()=>{
    if (mode !== "login"){
      setMode("login");
      try{ u && u.focus(); }catch(_){ }
      return;
    }

    const {username, password} = readCreds();
    if (!username || !password) { setHint("Inserisci username e password"); return; }
    try{
      setHint("...");
      const data = await api("utenti", { method:"POST", body:{ op:"login", username, password } });
      if (!data || !data.user) throw new Error("Credenziali non valide");
      state.session = data.user;
      saveSession(state.session);
      try{ invalidateApiCache(); }catch(_){ }
      state.exerciseYear = loadExerciseYear();
      updateYearPill();
      setHint("");
      showPage("home");
    } catch(e){ setHint(e.message || "Errore"); }
  });
}


// ===== API Cache (speed + dedupe richieste) =====
const __apiCache = new Map();      // key -> { t:number, data:any }
const __apiInflight = new Map();   // key -> Promise

function __applyCtxToParams(action, params){
  const p = Object.assign({}, params || {});
  try{
    if (state && state.session && state.session.user_id && action !== "utenti" && action !== "ping"){
      if (p.user_id === undefined || p.user_id === null || String(p.user_id).trim() === "") {
        p.user_id = String(state.session.user_id);
      }
      if (p.anno === undefined || p.anno === null || String(p.anno).trim() === "") {
        p.anno = String(state.exerciseYear || "");
      }
    }
  }catch(_){ }
  return p;
}

function __cacheKey(action, params){
  try { return action + "|" + JSON.stringify(params || {}); }
  catch (_) { return action + "|{}"; }
}

function invalidateApiCache(prefix){
  try{
    for (const k of Array.from(__apiCache.keys())){
      if (!prefix || k.startsWith(prefix)) __apiCache.delete(k);
    }
  } catch (_) {}
  try{ __lsClearAll(); }catch(_){ }
}

// ===== LocalStorage cache (perceived speed on iOS) =====
const __lsPrefix = "ddae_cache_v1:";
function __lsClearAll(){
  try{
    const keys = [];
    for (let i=0; i<localStorage.length; i++){
      const k = localStorage.key(i);
      if (k && k.startsWith(__lsPrefix)) keys.push(k);
    }
    keys.forEach(k => { try{ localStorage.removeItem(k); }catch(_){ } });
  } catch(_){ }
}
function __lsGet(key){
  try{
    const raw = localStorage.getItem(__lsPrefix + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(_){ return null; }
}
function __lsSet(key, data){
  try{
    localStorage.setItem(__lsPrefix + key, JSON.stringify({ t: Date.now(), data }));
  } catch(_){}
}



// GET con cache in-memory (non tocca SW): evita chiamate duplicate e loader continui
async function cachedGet(action, params = {}, { ttlMs = 30000, showLoader = true, force = false } = {}){
  const ctxParams = __applyCtxToParams(action, params);
  const key = __cacheKey(action, ctxParams);

  if (!force) {
    const hit = __apiCache.get(key);
    if (hit && (Date.now() - hit.t) < ttlMs) return hit.data;
  }

  if (__apiInflight.has(key)) return __apiInflight.get(key);

  const p = (async () => {
    const data = await api(action, { params: ctxParams, showLoader });
    __apiCache.set(key, { t: Date.now(), data });
    return data;
  })();

  __apiInflight.set(key, p);

  try {
    return await p;
  } finally {
    __apiInflight.delete(key);
  }
}

/* Launcher modal (popup) */



// iOS/PWA: elimina i “tap” persi (click non sempre affidabile su Safari PWA)
function bindFastTap(el, fn){
  if (!el) return;
  let last = 0;
  const handler = (e)=>{
    const now = Date.now();
    if (now - last < 450) return;
    last = now;
    try{ e.preventDefault(); }catch(_){ }
    try{ e.stopPropagation(); }catch(_){ }
    fn();
  };

  // In PWA iOS/Safari: evita doppi trigger (touch/pointer/click)
  const usePointer = (typeof window !== "undefined") && ("PointerEvent" in window);
  const events = usePointer ? ["pointerup", "click"] : ["touchend", "click"];

  for (const evt of events){
    try{ el.addEventListener(evt, handler, { passive:false }); }
    catch(_){ el.addEventListener(evt, handler); }
  }
}

let launcherDelegationBound = false;
let homeDelegationBound = false;
function bindHomeDelegation(){
  if (homeDelegationBound) return;
  homeDelegationBound = true;
  document.addEventListener("click", (e)=>{
    const o = e.target.closest && e.target.closest("#goOspite");
    if (o){ hideLauncher(); showPage("ospiti"); return; }
    const cal = e.target.closest && e.target.closest("#goCalendario");
    if (cal){ hideLauncher(); showPage("calendario"); return; }
    const tassa = e.target.closest && e.target.closest("#goTassaSoggiorno");
    if (tassa){
      hideLauncher();
      (async ()=>{ try{ await ensureSettingsLoaded({ force:false, showLoader:false }); }catch(_){} showPage("tassa"); try{ initTassaPage(); }catch(_){} })();
      return;
    }
    const pul = e.target.closest && e.target.closest("#goPulizie");
    if (pul){ hideLauncher(); showPage("pulizie"); return; }
        const opcal = e.target.closest && e.target.closest("#goOrePulizia") || e.target.closest("#goOrePuliziaTop");
    if (opcal){ hideLauncher(); showPage("orepulizia"); return; }

const lav = e.target.closest && e.target.closest("#goLavanderia") || e.target.closest("#goLavanderiaTop");
    if (lav){ hideLauncher(); showPage("lavanderia"); return; }

    const imp = e.target.closest && e.target.closest("#goImpostazioni");
    if (imp){ hideLauncher(); showPage("impostazioni"); return; }

    const g = e.target.closest && e.target.closest("#goStatistiche");
    if (g){ hideLauncher(); showPage("statistiche"); return; }

    // STATISTICHE (icone)
    const s1 = e.target.closest && e.target.closest("#goStatGen");
    if (s1){ hideLauncher(); showPage("statgen"); return; }
    const s2 = e.target.closest && e.target.closest("#goStatMensili");
    if (s2){ hideLauncher(); showPage("statmensili"); return; }
    const s3 = e.target.closest && e.target.closest("#goStatSpese");
    if (s3){ hideLauncher(); showPage("statspese"); return; }
    const s4 = e.target.closest && e.target.closest("#goStatPrenotazioni");
    if (s4){ hideLauncher(); toast("Statistiche prenotazioni: in arrivo"); return; }

  });
}

function bindLauncherDelegation(){
  if (launcherDelegationBound) return;
  launcherDelegationBound = true;

  document.addEventListener("click", (e) => {
    const goBtn = e.target.closest && e.target.closest("#launcherModal [data-go]");
    if (goBtn){
      const page = goBtn.getAttribute("data-go");
      hideLauncher();
      showPage(page);
      return;
    }
    const close = e.target.closest && e.target.closest("#launcherModal [data-close], #closeLauncher");
    if (close){
      hideLauncher();
    }
  });
}

function showLauncher(){
  const m = document.getElementById("launcherModal");
  if (!m) return;
  m.hidden = false;
  m.setAttribute("aria-hidden", "false");
}
function hideLauncher(){
  const m = document.getElementById("launcherModal");
  if (!m) return;
  m.hidden = true;
  m.setAttribute("aria-hidden", "true");
}


function setSpeseView(view, { render=false } = {}){
  state.speseView = view;
  const list = document.getElementById("speseViewList");
  const ins = document.getElementById("speseViewInsights");
  if (list) list.hidden = (view !== "list");
  if (ins) ins.hidden = (view !== "insights");

  const btn = document.getElementById("btnSpeseInsights");
  if (btn){
    btn.setAttribute("aria-pressed", view === "insights" ? "true" : "false");
    btn.classList.toggle("is-active", view === "insights");
  }

  if (render){
    if (view === "list") {
      try{ renderSpese(); }catch(_){}
    } else {
      try{ renderRiepilogo(); }catch(_){}
      try{ renderGrafico(); }catch(_){}
    }
  }
}

/* NAV pages (5 pagine interne: home + 4 funzioni) */
function showPage(page){
  // Redirect: grafico/riepilogo ora sono dentro "Spese" (videata unica)
  if (page === "riepilogo" || page === "grafico"){
    page = "spese";
    state.speseView = "insights";
  }
  if (page === "spese" && !state.speseView) state.speseView = "list";

  // Gate: senza sessione si rimane in AUTH
  try{
    if (page !== "auth" && (!state.session || !state.session.user_id)) {
      page = "auth";
    }
  }catch(_){ page = "auth"; }


  // Token navigazione: impedisce render/loader fuori contesto quando cambi pagina durante fetch
  const navId = ++state.navId;

  const prevPage = state.page;
  if (page === "calendario" && prevPage && prevPage !== "calendario") {
    state._calendarPrev = prevPage;
  }

state.page = page;
  document.body.dataset.page = page;

  try { __rememberPage(page); } catch (_) {}
  document.querySelectorAll(".page").forEach(s => s.hidden = true);
  const el = $(`#page-${page}`);
  if (el) el.hidden = false;

  // Impostazioni: aggiorna tabs (account + anno)
  if (page === "impostazioni"){
    try{ updateSettingsTabs(); }catch(_){ }
  }

  // Sotto-viste della pagina Spese (lista ↔ grafico+riepilogo)
  if (page === "spese") {
    try { setSpeseView(state.speseView || "list"); } catch (_) {}
  }

  // Period chip: nascosto in HOME (per rispettare "nessun altro testo" sulla home)
  const chip = $("#periodChip");
  if (chip){
    if (page === "home" || page === "ospite" || page === "ospiti") {
      chip.hidden = true;
    } else {
      chip.hidden = false;
      chip.textContent = `${state.period.from} → ${state.period.to}`;
    }
  }


  // Top back button (Ore pulizia + Calendario)
  const backBtnTop = $("#backBtnTop");
  if (backBtnTop){
    backBtnTop.hidden = !(page === "orepulizia" || page === "calendario");
  }


  // Top tools (solo Pulizie) — lavanderia + ore lavoro accanto al tasto Home
  const pulizieTopTools = $("#pulizieTopTools");
  if (pulizieTopTools){
    pulizieTopTools.hidden = (page !== "pulizie");
  }


  // Top tools (Ospiti) — nuovo ospite + calendario accanto al tasto Home
  const ospitiTopTools = $("#ospitiTopTools");
  if (ospitiTopTools){
    ospitiTopTools.hidden = (page !== "ospiti");
  }

  
  // Top tools (Spese) — + e grafico accanto al tasto Home
  const speseTopTools = $("#speseTopTools");
  if (speseTopTools){
    speseTopTools.hidden = (page !== "spese");
  }

  // Top tools (Statistiche → Conteggio generale)
  const statGenTopTools = $("#statGenTopTools");
  if (statGenTopTools){
    statGenTopTools.hidden = (page !== "statgen");
  }

  // Top tools (Statistiche → Incassi mensili)
  const statMensiliTopTools = $("#statMensiliTopTools");
  if (statMensiliTopTools){
    statMensiliTopTools.hidden = (page !== "statmensili");
  }

  // Top tools (Statistiche → Spese generali)
  const statSpeseTopTools = $("#statSpeseTopTools");
  if (statSpeseTopTools){
    statSpeseTopTools.hidden = (page !== "statspese");
  }

// render on demand
  if (page === "spese") {
    const _nav = navId;
    ensurePeriodData({ showLoader:true })
      .then(()=>{ if (state.navId !== _nav || state.page !== "spese") return; renderSpese(); })
      .catch(e=>toast(e.message));
  }
  if (page === "riepilogo") {
    const _nav = navId;
    ensurePeriodData({ showLoader:true })
      .then(()=>{ if (state.navId !== _nav || state.page !== "riepilogo") return; renderRiepilogo(); })
      .catch(e=>toast(e.message));
  }
  if (page === "grafico") {
    const _nav = navId;
    ensurePeriodData({ showLoader:true })
      .then(()=>{ if (state.navId !== _nav || state.page !== "grafico") return; renderGrafico(); })
      .catch(e=>toast(e.message));
  }
  if (page === "calendario") {
    const _nav = navId;
    // Entrando in Calendario vogliamo SEMPRE dati freschi.
    // 1) invalida lo stato "ready" e bypassa la cache in-memory (ttl) con force:true.
    try{ if (state.calendar) state.calendar.ready = false; }catch(_){ }
    ensureCalendarData({ force:true })
      .then(()=>{ if (state.navId !== _nav || state.page !== "calendario") return; renderCalendario(); })
      .catch(e=>toast(e.message));
  }
  if (page === "ospiti") {
    // Difesa anti-stato sporco: quando torno alla lista, la scheda ospite NON deve restare in "view"
    // (layout diverso) o con valori vecchi.
    try { enterGuestCreateMode(); } catch (_) {}
    loadOspiti(state.period || {}).catch(e => toast(e.message));
  }
  if (page === "lavanderia") loadLavanderia().catch(e => toast(e.message));

  if (page === "statistiche") {
    try{ closeStatPieModal(); }catch(_){ }
    try{ closeStatSpesePieModal(); }catch(_){ }
  }

  if (page === "statgen") {
    const _nav = navId;
    Promise.all([
      ensurePeriodData({ showLoader:true }),
      loadOspiti({ ...(state.period || {}), force:false }),
    ])
      .then(()=>{ if (state.navId !== _nav || state.page !== "statgen") return; renderStatGen(); })
      .catch(e=>toast(e.message));
  }

  if (page === "statspese") {
    const _nav = navId;
    ensurePeriodData({ showLoader:true })
      .then(()=>{ if (state.navId !== _nav || state.page !== "statspese") return; renderStatSpese(); })
      .catch(e=>toast(e.message));
  }

  if (page === "statmensili") {
    const _nav = navId;
    ensureStatMensiliData({ showLoader:true })
      .then(()=>{ if (state.navId !== _nav || state.page !== "statmensili") return; renderStatMensili(); })
      .catch(e=>toast(e.message));
  }

  if (page === "orepulizia") { initOrePuliziaPage().catch(e=>toast(e.message)); }


  // dDAE_2.019: fallback visualizzazione Pulizie
  try{
    if (page === "pulizie"){
      const el = document.getElementById("page-pulizie");
      if (el) el.style.display = "block";
    }
  }catch(_){}

}

function setupHeader(){
  const hb = $("#hamburgerBtn");
  if (hb) hb.addEventListener("click", () => { hideLauncher(); showPage("home"); });

  // Back (ore pulizia + calendario)
  const bb = $("#backBtnTop");
  if (bb) bb.addEventListener("click", () => {
    if (state.page === "orepulizia") { showPage("pulizie"); return; }
    if (state.page === "calendario") { showPage("ospiti"); return; }
    showPage("home");
  });
}
function setupHome(){
  bindLauncherDelegation();
  // stampa build
  const build = $("#buildText");
  if (build) build.textContent = `${BUILD_VERSION}`;

  // SPESE: pulsante + (nuova spesa) e pulsante grafico+riepilogo
  const btnAdd = $("#btnAddSpesa");
  if (btnAdd){
    bindFastTap(btnAdd, () => { hideLauncher(); showPage("inserisci"); });
  }
  const btnInsights = $("#btnSpeseInsights");
  if (btnInsights){
    bindFastTap(btnInsights, async () => {
      // toggle vista
      const next = (state.speseView === "insights") ? "list" : "insights";
      if (next === "insights"){
        try{
          await ensurePeriodData({ showLoader:true });
          setSpeseView("insights", { render:true });
        }catch(e){ toast(e.message); }
      } else {
        setSpeseView("list");
      }
    });
  }


  // HOME: tasto Spese apre direttamente la pagina "spese" (senza launcher)
  const openBtn = $("#openLauncher");
  if (openBtn){
    bindFastTap(openBtn, () => { try{ setSpeseView("list"); }catch(_){} hideLauncher(); showPage("spese"); });
  }

  // HOME: icona Ospite va alla pagina ospite
  const goO = $("#goOspite");
  if (goO){
    bindFastTap(goO, () => { hideLauncher(); showPage("ospiti"); });
  }
  // HOME: icona Ospiti va alla pagina elenco ospiti
  const goOs = $("#goOspiti");
  if (goOs){
    bindFastTap(goOs, () => { hideLauncher(); showPage("ospiti"); });
  }


// OSPITI: pulsante + (nuovo ospite)
const btnNewGuestOspiti = $("#btnNewGuestOspiti");
if (btnNewGuestOspiti){
  btnNewGuestOspiti.addEventListener("click", () => { enterGuestCreateMode(); showPage("ospite"); });
}


// OSPITI: topbar — nuovo ospite + calendario
const btnNewGuestTop = $("#btnNewGuestTop");
if (btnNewGuestTop){
  btnNewGuestTop.addEventListener("click", () => { enterGuestCreateMode(); showPage("ospite"); });
}
const goCalendarioTopOspiti = $("#goCalendarioTopOspiti");
if (goCalendarioTopOspiti){
  bindFastTap(goCalendarioTopOspiti, () => showPage("calendario"));
}



  // HOME: icona Impostazioni
  const goImp = $("#goImpostazioni");
  if (goImp){
    bindFastTap(goImp, () => showPage("impostazioni"));
  }

  // HOME: icona Calendario (tap-safe su iOS PWA)
  const goCal = $("#goCalendario");
  if (goCal){
    goCal.disabled = false;
    goCal.removeAttribute("aria-disabled");
    bindFastTap(goCal, () => { hideLauncher(); showPage("calendario"); });
  }

  // HOME: icona Pulizie
  const goPul = $("#goPulizie");
  if (goPul){
    bindFastTap(goPul, () => { hideLauncher(); showPage("pulizie"); });
  }

  // HOME: icona Lavanderia (anche pulsante top)
  const goLav = $("#goLavanderia");
  if (goLav){
    bindFastTap(goLav, () => { hideLauncher(); showPage("lavanderia"); });
  }
  const goLavTop = $("#goLavanderiaTop");
  if (goLavTop){
    bindFastTap(goLavTop, () => { hideLauncher(); showPage("lavanderia"); });
  }

  // HOME: ore pulizie (se presente)
  const goOrePul = $("#goOrePulizia");
  if (goOrePul){
    bindFastTap(goOrePul, () => { hideLauncher(); showPage("orepulizia"); });
  }
  const goOrePulTop = $("#goOrePuliziaTop");
  if (goOrePulTop){
    bindFastTap(goOrePulTop, () => { hideLauncher(); showPage("orepulizia"); });
  }

  // HOME: tassa soggiorno (se presente)
  const goTassa = $("#goTassaSoggiorno");
  if (goTassa){
    bindFastTap(goTassa, async () => {
      hideLauncher();
      try{ await ensureSettingsLoaded({ force:false, showLoader:false }); }catch(_){ }
      showPage("tassa");
      try{ initTassaPage(); }catch(_){ }
    });
  }

  // HOME: Statistiche
  const goG = $("#goStatistiche");
  if (goG){
    bindFastTap(goG, () => { hideLauncher(); showPage("statistiche"); });
  }

  // STATISTICHE: icone
  const s1 = $("#goStatGen");
  if (s1){ bindFastTap(s1, () => { hideLauncher(); showPage("statgen"); }); }
  const s2 = $("#goStatMensili");
  if (s2){ bindFastTap(s2, () => { hideLauncher(); showPage("statmensili"); }); }
  const s3 = $("#goStatSpese");
  if (s3){ bindFastTap(s3, () => { hideLauncher(); showPage("statspese"); }); }
  const s4 = $("#goStatPrenotazioni");
  if (s4){ bindFastTap(s4, () => toast("Statistiche prenotazioni: in arrivo")); }

  // STATGEN: topbar tools
  const btnBackStats = $("#btnBackStatistiche");
  if (btnBackStats){ bindFastTap(btnBackStats, () => { closeStatPieModal(); showPage("statistiche"); }); }
  const btnBackStatsMensili = $("#btnBackStatisticheMensili");
  if (btnBackStatsMensili){ bindFastTap(btnBackStatsMensili, () => { showPage("statistiche"); }); }
  const btnPie = $("#btnStatPie");
  if (btnPie){ bindFastTap(btnPie, () => { openStatPieModal(); }); }
  const statPieClose = $("#statPieClose");
  if (statPieClose){ bindFastTap(statPieClose, () => closeStatPieModal()); }
  const statPieModal = $("#statPieModal");
  if (statPieModal){
    statPieModal.addEventListener("click", (e)=>{
      if (e.target === statPieModal) closeStatPieModal();
    });
  }

  // STATISTICHE: Spese generali topbar tools
  const btnBackStatsSpese = $("#btnBackStatisticheSpese");
  if (btnBackStatsSpese){ bindFastTap(btnBackStatsSpese, () => { closeStatSpesePieModal(); showPage("statistiche"); }); }
  const btnPieSpese = $("#btnStatSpesePie");
  if (btnPieSpese){ bindFastTap(btnPieSpese, () => { openStatSpesePieModal(); }); }

  const statSpesePieClose = $("#statSpesePieClose");
  if (statSpesePieClose){ bindFastTap(statSpesePieClose, () => closeStatSpesePieModal()); }
  const statSpesePieModal = $("#statSpesePieModal");
  if (statSpesePieModal){
    statSpesePieModal.addEventListener("click", (e)=>{
      if (e.target === statSpesePieModal) closeStatSpesePieModal();
    });
  }


  // Escape chiude il launcher
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideLauncher();
  });
}


function setupGuestListControls(){
  const sortSel = $("#guestSortBy");
  const dirBtn = $("#guestSortDir");
  const todayBtn = $("#guestToday");
  if (!sortSel) return;

  const savedBy = localStorage.getItem("dDAE_guestSortBy");
  const savedDir = localStorage.getItem("dDAE_guestSortDir");
  state.guestSortBy = savedBy || state.guestSortBy || "arrivo";
  state.guestSortDir = savedDir || state.guestSortDir || "asc";

  try { sortSel.value = state.guestSortBy; } catch(_) {}

  const paintDir = () => {
    if (!dirBtn) return;
    const asc = (state.guestSortDir !== "desc");
    dirBtn.textContent = asc ? "↑" : "↓";
    dirBtn.setAttribute("aria-pressed", asc ? "false" : "true");
  };
  paintDir();
  // Filtro rapido: Oggi (arrivo = oggi)
  const savedToday = localStorage.getItem("dDAE_guestTodayOnly");
  state.guestTodayOnly = (savedToday === "1") ? true : (savedToday === "0") ? false : (state.guestTodayOnly || false);

  const paintToday = () => {
    if (!todayBtn) return;
    todayBtn.classList.toggle("is-active", !!state.guestTodayOnly);
    todayBtn.setAttribute("aria-pressed", state.guestTodayOnly ? "true" : "false");
  };
  paintToday();

  if (todayBtn){
    todayBtn.addEventListener("click", () => {
      state.guestTodayOnly = !state.guestTodayOnly;
      try { localStorage.setItem("dDAE_guestTodayOnly", state.guestTodayOnly ? "1" : "0"); } catch(_){}
      paintToday();
      renderGuestCards();
    });
  }


  sortSel.addEventListener("change", () => {
    state.guestSortBy = sortSel.value;
    try { localStorage.setItem("dDAE_guestSortBy", state.guestSortBy); } catch(_){}
    renderGuestCards();
  });

  if (dirBtn){
    dirBtn.addEventListener("click", () => {
      state.guestSortDir = (state.guestSortDir === "desc") ? "asc" : "desc";
      try { localStorage.setItem("dDAE_guestSortDir", state.guestSortDir); } catch(_){}
      paintDir();
      renderGuestCards();
    });
  }
}

function guestIdOf(g){
  return String(g?.id ?? g?.ID ?? g?.ospite_id ?? g?.ospiteId ?? g?.guest_id ?? g?.guestId ?? "").trim();
}

function parseDateTs(v){
  const s = String(v ?? "").trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function computeInsertionMap(guests){
  const arr = (guests || []).map((g, idx) => {
    const id = guestIdOf(g);
    const c = g?.created_at ?? g?.createdAt ?? "";
    const t = parseDateTs(c);
    return { id, idx, t };
  });

  arr.sort((a,b) => {
    const at = a.t, bt = b.t;
    if (at != null && bt != null) return at - bt;
    if (at != null) return -1;
    if (bt != null) return 1;
    return a.idx - b.idx;
  });

  const map = {};
  let n = 1;
  for (const x of arr){
    if (!x.id) continue;
    map[x.id] = n++;
  }
  return map;
}

function sortGuestsList(items){
  const by = state.guestSortBy || "arrivo";
  const dir = (state.guestSortDir === "desc") ? -1 : 1;
  const nameKey = (s) => String(s ?? "").trim().toLowerCase();

  const out = items.slice();
  out.sort((a,b) => {
    if (by === "nome") {
      return nameKey(a.nome).localeCompare(nameKey(b.nome), "it") * dir;
    }
    if (by === "inserimento") {
      const aa = Number(a._insNo) || 1e18;
      const bb = Number(b._insNo) || 1e18;
      return (aa - bb) * dir;
    }
    const ta = parseDateTs(a.check_in ?? a.checkIn);
    const tb = parseDateTs(b.check_in ?? b.checkIn);
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return (ta - tb) * dir;
  });
  return out;
}

/* PERIOD SYNC */
function setPeriod(from, to){
  state.period = { from, to };

  periodSyncLock += 1;
  try {
    const map = [
      ["#fromDate", "#toDate"],
      ["#fromDate2", "#toDate2"],
      ["#fromDate3", "#toDate3"],
      ["#fromDate4", "#toDate4"],
    ];
    for (const [fSel,tSel] of map){
      const f = $(fSel), t = $(tSel);
      if (f) f.value = from;
      if (t) t.value = to;
    }
  } finally {
    periodSyncLock -= 1;
  }

  const chip = $("#periodChip");
  if (chip && state.page !== "home") chip.textContent = `${from} → ${to}`;
}


async function onPeriodChanged({ showLoader=false } = {}){
  // Quando cambia il periodo, i dati “period-based” vanno considerati obsoleti
  state._dataKey = "";

  // Aggiorna solo ciò che serve (evita chiamate inutili e loader continui)
  if (state.page === "ospiti") {
    await loadOspiti({ ...(state.period || {}), force:true });
    return;
  }
  if (state.page === "calendario") {
    if (state.calendar) state.calendar.ready = false;
    await ensureCalendarData();
    renderCalendario();
    return;
  }
  if (state.page === "spese") {
    await ensurePeriodData({ showLoader });
    // Se siamo nella sotto-vista "grafico+riepilogo", aggiorna anche quella
    if (state.speseView === "insights") {
      renderRiepilogo();
      renderGrafico();
    } else {
      renderSpese();
    }
    return;
  }
  if (state.page === "riepilogo") {
    await ensurePeriodData({ showLoader });
    renderRiepilogo();
    return;
  }
  if (state.page === "grafico") {
    await ensurePeriodData({ showLoader });
    renderGrafico();
    return;
  }
}

/* DATA LOAD */
async function loadMotivazioni(){
  const data = await cachedGet("motivazioni", {}, { showLoader:false, ttlMs: 5*60*1000 });
  state.motivazioni = data;

  const list = $("#motivazioniList");
  if (list) {
    list.innerHTML = "";
    data.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.motivazione;
      list.appendChild(opt);
    });
  }
}


async function load({ showLoader=true } = {}){
  // Prefill rapido da cache locale (aiuta dopo reload PWA)
  if (!state.stanzeRows || !state.stanzeRows.length){
    const hit = __lsGet("stanze");
    if (hit && Array.isArray(hit.data) && hit.data.length){
      try{
        const rows0 = hit.data;
        state.stanzeRows = rows0;
        // ricostruisci indicizzazione
        const map0 = {};
        for (const r of rows0){
          const gid = String(r.ospite_id ?? r.ospiteId ?? r.guest_id ?? r.guestId ?? "").trim();
          const sn = String(r.stanza_num ?? r.stanzaNum ?? r.room_number ?? r.roomNumber ?? r.stanza ?? r.room ?? "").trim();
          if (!gid || !sn) continue;
          const key = `${gid}:${sn}`;
          map0[key] = {
            letto_m: Number(r.letto_m ?? r.lettoM ?? 0) || 0,
            letto_s: Number(r.letto_s ?? r.lettoS ?? 0) || 0,
            culla: Number(r.culla ?? r.crib ?? 0) || 0,
          };
        }
        state.stanzeByKey = map0;
      } catch(_){}
    }
  }
  const data = await cachedGet("stanze", {}, { showLoader, ttlMs: 60*1000 });
  const rows = Array.isArray(data) ? data : [];
  state.stanzeRows = rows;

  // indicizza per ospite_id + stanza_num
  const map = {};
  for (const r of rows){
    const gid = String(r.ospite_id ?? r.ospiteId ?? r.guest_id ?? r.guestId ?? "").trim();
    const sn = String(r.stanza_num ?? r.stanzaNum ?? r.room_number ?? r.roomNumber ?? r.stanza ?? r.room ?? "").trim();
    if (!gid || !sn) continue;
    const key = `${gid}:${sn}`;
    map[key] = {
      letto_m: Number(r.letto_m ?? r.lettoM ?? 0) || 0,
      letto_s: Number(r.letto_s ?? r.lettoS ?? 0) || 0,
      culla: Number(r.culla ?? r.crib ?? 0) || 0,
    };
  }
  state.stanzeByKey = map;
  __lsSet("stanze", rows);
}

async function loadOspiti({ from="", to="", force=false } = {}){
  // Prefill rapido da cache locale (poi refresh in background)
  const lsKey = `ospiti|${from}|${to}`;
  const hit = __lsGet(lsKey);
  if (hit && Array.isArray(hit.data) && hit.data.length){
    state.guests = hit.data;
    // render subito (perceived speed)
    try{ requestAnimationFrame(renderGuestCards); } catch(_){ renderGuestCards(); }
  }

  // ✅ Necessario per mostrare i "pallini letti" stanza-per-stanza nelle schede ospiti
  const p = load({ showLoader:false });
  const pOspiti = cachedGet("ospiti", { from, to }, { showLoader:true, ttlMs: 30*1000, force });

  const [ , data ] = await Promise.all([p, pOspiti]);
  state.guests = Array.isArray(data) ? data : [];
  __lsSet(lsKey, state.guests);
  renderGuestCards();
}


async function ensurePeriodData({ showLoader=true, force=false } = {}){
  const { from, to } = state.period;
  const key = `${from}|${to}`;

  if (!force && state._dataKey === key && state.report && Array.isArray(state.spese)) {
    return;
  }

  const [report, spese] = await Promise.all([
    cachedGet("report", { from, to }, { showLoader, ttlMs: 15*1000, force }),
    cachedGet("spese", { from, to }, { showLoader, ttlMs: 15*1000, force }),
  ]);

  state.report = report;
  state.spese = spese;
  state._dataKey = key;
}

// Compat: vecchi call-site
async function loadData({ showLoader=true } = {}){
  return ensurePeriodData({ showLoader });
}


/* 1) INSERISCI */
function resetInserisci(){
  $("#spesaImporto").value = "";
  $("#spesaMotivazione").value = "";
  $("#spesaCategoria").value = "";
  $("#spesaData").value = todayISO();

  // Motivazione: se l'utente scrive una variante già esistente, usa la versione canonica
  const mot = $("#spesaMotivazione");
  if (mot) {
    mot.addEventListener("blur", () => {
      const v = collapseSpaces((mot.value || "").trim());
      if (!v) return;
      const canonical = findCanonicalMotivazione(v);
      if (canonical) mot.value = canonical;
      else mot.value = v; // pulizia spazi multipli
    });
  } // lascia oggi
}


function collapseSpaces(s){
  return String(s || "").replace(/\s+/g, " ");
}

// Normalizza SOLO per confronto (non altera la stringa salvata se già esistente)
function normalizeMotivazioneForCompare(s){
  let x = collapseSpaces(String(s || "").trim()).toLowerCase();
  // rimuove accenti SOLO per confronto
  try {
    x = x.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch (_) {}
  return x;
}

function findCanonicalMotivazione(input){
  const needle = normalizeMotivazioneForCompare(input);
  for (const m of (state.motivazioni || [])){
    const val = m?.motivazione ?? "";
    if (normalizeMotivazioneForCompare(val) === needle) return val;
  }
  return null;
}

async function saveSpesa(){
  const dataSpesa = $("#spesaData").value;
  const categoria = $("#spesaCategoria").value;
  const importoLordo = Number($("#spesaImporto").value);
  const motivazione = ($("#spesaMotivazione").value || "").trim();

  if (!isFinite(importoLordo) || importoLordo <= 0) return toast("Importo non valido");
  if (!motivazione) return toast("Motivazione obbligatoria");
  if (!dataSpesa) return toast("Data obbligatoria");
  if (!categoria) return toast("Categoria obbligatoria");

  // se motivazione nuova => salva per futuro
  const canonical = findCanonicalMotivazione(motivazione);
  // Se esiste già (spazi/case/accenti diversi), non salvare duplicati
  if (canonical) {
    $("#spesaMotivazione").value = canonical; // versione canonica
  } else {
    try {
      await api("motivazioni", { method:"POST", body:{ motivazione }, showLoader:false });
      await loadMotivazioni();
    } catch (_) {}
  }

  await api("spese", { method:"POST", body:{ dataSpesa, categoria, motivazione, importoLordo, note: "" } });

  toast("Salvato");
  resetInserisci();

  // aggiorna dati
  try {
    invalidateApiCache("spese|");
    invalidateApiCache("report|");
    await ensurePeriodData({ showLoader:false, force:true });
    if (state.page === "spese") renderSpese();
    if (state.page === "riepilogo") renderRiepilogo();
    if (state.page === "grafico") renderGrafico();
  } catch(_) {}


  // Dopo salvataggio: torna alla pagina Spese
  try { setSpeseView("list"); } catch (_) {}
  try { showPage("spese"); } catch (_) {}

}

/* 2) SPESE */
function renderSpese(){
  const list = document.getElementById("speseList");
  if (!list) return;
  list.innerHTML = "";

  const items = Array.isArray(state.spese) ? state.spese : [];
  if (!items.length){
    list.innerHTML = '<div style="font-size:13px; opacity:.75; padding:8px 2px;">Nessuna spesa nel periodo.</div>';
    return;
  }

  items.forEach(s => {
    const el = document.createElement("div");
    el.className = "item";

    const importo = Number(s.importoLordo || 0);
    const data = formatShortDateIT(s.dataSpesa || s.data || s.data_spesa || "");
    const motivo = escapeHtml((s.motivazione || s.motivo || "").toString());

    el.innerHTML = `
      <div class="item-top">
        <div class="spesa-line" title="${motivo}">
          <span class="spesa-imp">${euro(importo)}</span>
          <span class="spesa-sep">·</span>
          <span class="spesa-date">${data}</span>
          <span class="spesa-sep">·</span>
          <span class="spesa-motivo">${motivo}</span>
        </div>
        <button class="delbtn delbtn-x" type="button" aria-label="Elimina record" data-del="${s.id}">Elimina</button>
      </div>
    `;

    const btn = el.querySelector("[data-del]");
    if (btn){
      btn.addEventListener("click", async () => {
        if (!confirm("Eliminare definitivamente questa spesa?")) return;
        await api("spese", { method:"DELETE", params:{ id: s.id } });
        toast("Spesa eliminata");
        invalidateApiCache("spese|");
        invalidateApiCache("report|");
        await ensurePeriodData({ showLoader:false, force:true });
        renderSpese();
      });
    }

    list.appendChild(el);
  });
}


/* 3) RIEPILOGO */
function renderRiepilogo(){
  const r = state.report;
  if (!r) return;

  $("#kpiTotSpese").textContent = euro(r.totals.importoLordo);
  $("#kpiIvaDetraibile").textContent = euro(r.totals.ivaDetraibile);
  $("#kpiImponibile").textContent = euro(r.totals.imponibile);

  // Lista semplice: 5 righe (categoria + totale lordo)
  const container = $("#byCat");
  if (!container) return;

  const by = r.byCategoria || {};
  const order = ["CONTANTI","TASSA_SOGGIORNO","IVA_22","IVA_10","IVA_4"];

  container.innerHTML = "";
  for (const k of order){
    const o = by[k] || { importoLordo: 0 };
    const row = document.createElement("div");
    row.className = "catitem";
    row.innerHTML = `
      <div class="catitem-left">
        <span class="badge" style="background:${hexToRgba(COLORS[k] || "#d8bd97", 0.20)}">${categoriaLabel(k)}</span>
        <div class="catitem-name">Totale</div>
      </div>
      <div class="catitem-total">${euro(o.importoLordo)}</div>
    `;
    container.appendChild(row);
  }
}

/* 4) GRAFICO */
function renderGrafico(){
  const r = state.report;
  if (!r) return;

  const by = r.byCategoria || {};
  const order = ["CONTANTI","TASSA_SOGGIORNO","IVA_22","IVA_10","IVA_4"];
  const values = order.map(k => Number(by[k]?.importoLordo || 0));
  const total = values.reduce((a,b)=>a+b,0);

  drawPie("pieCanvas", order.map((k,i)=>({
    key: k,
    label: categoriaLabel(k),
    value: values[i],
    color: COLORS[k] || "#999999"
  })));

  const leg = $("#pieLegend");
  if (!leg) return;
  leg.innerHTML = "";

  order.forEach((k,i) => {
    const v = values[i];
    const pct = total > 0 ? (v/total*100) : 0;
    const row = document.createElement("div");
    row.className = "legrow";
    row.innerHTML = `
      <div class="legleft">
        <div class="dot" style="background:${COLORS[k] || "#999"}"></div>
        <div class="legname">${categoriaLabel(k)}</div>
      </div>
      <div class="legright">${pct.toFixed(1)}% · ${euro(v)}</div>
    `;
    leg.appendChild(row);
  });
}

/* PIE DRAW (no librerie) */
function drawPie(canvasId, slices){
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const cssSize = Math.min(320, Math.floor(window.innerWidth * 0.78));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = cssSize + "px";
  canvas.style.height = cssSize + "px";
  canvas.width = Math.floor(cssSize * dpr);
  canvas.height = Math.floor(cssSize * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cssSize,cssSize);

  const total = slices.reduce((a,s)=>a+Math.max(0,Number(s.value||0)),0);
  const cx = cssSize/2, cy = cssSize/2;
  const r = cssSize/2 - 10;

  // Glass ring background
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(15,23,42,0.08)";
  ctx.stroke();

  let ang = -Math.PI/2;
  if (total <= 0){
    ctx.beginPath();
    ctx.arc(cx, cy, r-8, 0, Math.PI*2);
    ctx.fillStyle = "rgba(43,124,180,0.10)";
    ctx.fill();
    ctx.fillStyle = "rgba(15,23,42,0.55)";
    ctx.font = "600 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Nessun dato", cx, cy+4);
    return;
  }

  slices.forEach(s => {
    const v = Math.max(0, Number(s.value||0));
    const a = (v/total) * Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r-8,ang,ang+a);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ang += a;
  });

  // inner hole
  ctx.beginPath();
  ctx.arc(cx, cy, r*0.58, 0, Math.PI*2);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fill();
  ctx.strokeStyle = "rgba(15,23,42,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // center label
  ctx.fillStyle = "rgba(15,23,42,0.75)";
  ctx.font = "900 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Totale", cx, cy-4);
  ctx.fillStyle = "rgba(15,23,42,0.92)";
  ctx.font = "950 14px system-ui";
  ctx.fillText(euro(total), cx, cy+14);
}

/* Helpers */
function hexToRgba(hex, a){
  const h = (hex || "").replace("#","");
  if (h.length !== 6) return `rgba(0,0,0,${a})`;
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
function escapeHtml(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

// =========================
// STATISTICHE (dDAE_2.019)
// =========================

function computeStatGen(){
  const guests = Array.isArray(state.guests) ? state.guests : [];
  const report = state.report || null;

  let fatturato = 0;
  let cash = 0;
  let conRicevuta = 0;
  let senzaRicevuta = 0;

  for (const g of guests){
    const dep = Number(g?.acconto_importo || 0) || 0;
    const saldo = Number(g?.saldo_pagato ?? g?.saldoPagato ?? g?.saldo ?? 0) || 0;
    const depType = String(g?.acconto_tipo || g?.depositType || "contante").toLowerCase();
    const saldoType = String(g?.saldo_tipo || g?.saldoTipo || g?.saldoType || "").toLowerCase();

    // receipt flags
    const depRec = truthy(g?.acconto_ricevuta ?? g?.accontoRicevuta ?? g?.ricevuta_acconto ?? g?.ricevutaAcconto ?? g?.acconto_ricevutain);
    const saldoRec = truthy(g?.saldo_ricevuta ?? g?.saldoRicevuta ?? g?.ricevuta_saldo ?? g?.ricevutaSaldo ?? g?.saldo_ricevutain);

    fatturato += dep + saldo;

    if (dep > 0){
      if (depRec) conRicevuta += dep;
      else senzaRicevuta += dep;
      if (!depType.includes("elet")) cash += dep;
    }
    if (saldo > 0){
      if (saldoRec) conRicevuta += saldo;
      else senzaRicevuta += saldo;
      if (!saldoType.includes("elet")) cash += saldo;
    }
  }

  const speseTot = Number(report?.totals?.importoLordo || 0) || 0;

  // IVA da versare = IVA su incassi (10%) - IVA detraibile su spese (4/10/22)
  let ivaSpese = Number(report?.totals?.ivaDetraibile || 0) || 0;
  if (!isFinite(ivaSpese) || ivaSpese === 0){
    try{
      const items = Array.isArray(state.spese) ? state.spese : [];
      let sum = 0;
      for (const s of items){
        const lordo = Number(s?.importoLordo || 0);
        if (!isFinite(lordo) || lordo <= 0) continue;

        const catRaw = (s?.categoria ?? s?.cat ?? "").toString().trim().toLowerCase();
        let rate = 0;
        if (catRaw.includes("iva")) {
          if (catRaw.includes("22")) rate = 22;
          else if (catRaw.includes("10")) rate = 10;
          else if (catRaw.includes("4")) rate = 4;
        } else {
          const n = parseFloat(String(s?.aliquotaIva ?? s?.aliquota_iva ?? "").replace(",", "."));
          if (!isNaN(n)) {
            if (n >= 21.5) rate = 22;
            else if (n >= 9.5 && n < 11.5) rate = 10;
            else if (n >= 3.5 && n < 5.5) rate = 4;
          }
        }

        if (rate > 0){
          const imponibile = lordo / (1 + rate/100);
          const iva = lordo - imponibile;
          if (isFinite(iva)) sum += iva;
        }
      }
      if (sum > 0) ivaSpese = sum;
    }catch(_){ }
  }

  const ivaDaVersare = (conRicevuta * 0.10) - (Number(ivaSpese) || 0);
  const guadagno = fatturato - speseTot;

  return {
    fatturatoTotale: fatturato,
    speseTotali: speseTot,
    senzaRicevuta,
    conRicevuta,
    ivaDaVersare,
    guadagnoTotale: guadagno,
    giacenzaCassa: cash,
  };
}

function renderStatGen(){
  const s = computeStatGen();
  state.statGen = s;

  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = euro(Number(v || 0));
  };

  set("sgFatturato", s.fatturatoTotale);
  set("sgSpese", s.speseTotali);
  set("sgNoRicevuta", s.senzaRicevuta);
  set("sgRicevuta", s.conRicevuta);
  set("sgIva", s.ivaDaVersare);
  set("sgGuadagno", s.guadagnoTotale);
  set("sgCassa", s.giacenzaCassa);
}

// ===== STATISTICHE: INCASSI MENSILI (dDAE_2.023) =====
const __MONTHS_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

function __gradientRedToIndigo(n=12){
  const start = [255, 0, 0];
  const end   = [75, 0, 130]; // indigo
  const out = [];
  const denom = (n<=1) ? 1 : (n-1);
  for (let i=0; i<n; i++){
    const t = i / denom;
    const r = Math.round(start[0] + (end[0]-start[0]) * t);
    const g = Math.round(start[1] + (end[1]-start[1]) * t);
    const b = Math.round(start[2] + (end[2]-start[2]) * t);
    out.push(`rgb(${r},${g},${b})`);
  }
  return out;
}

async function ensureStatMensiliData({ showLoader=true, force=false } = {}){
  const year = String(state.exerciseYear || loadExerciseYear());
  const key = `y:${year}`;
  if (!force && state._statMensiliKey === key && Array.isArray(state.statMensiliGuests)) return;
  const from = `${year}-01-01`;
  const to   = `${year}-12-31`;
  const data = await cachedGet("ospiti", { from, to }, { showLoader, ttlMs: 30*1000, force });
  state.statMensiliGuests = Array.isArray(data) ? data : [];
  state._statMensiliKey = key;
}

function computeIncassiMensili(guests, year){
  const yStr = String(year || '').trim();
  const out = Array(12).fill(0);
  const items = Array.isArray(guests) ? guests : [];
  for (const g of items){
    const ci = formatISODateLocal(g?.check_in ?? g?.checkIn ?? '');
    if (!ci || ci.length < 10) continue;
    if (ci.slice(0,4) !== yStr) continue;
    const m = parseInt(ci.slice(5,7), 10);
    if (!m || m < 1 || m > 12) continue;
    const dep = Number(g?.acconto_importo || 0) || 0;
    const saldo = Number(g?.saldo_pagato ?? g?.saldoPagato ?? g?.saldo ?? 0) || 0;
    const v = dep + saldo;
    if (isFinite(v) && v > 0) out[m-1] += v;
  }
  return out;
}

function renderStatMensili(){
  const list = document.getElementById('smList');
  if (!list) return;
  const year = String(state.exerciseYear || loadExerciseYear());
  const guests = Array.isArray(state.statMensiliGuests) ? state.statMensiliGuests : [];
  const months = computeIncassiMensili(guests, year);
  const max = Math.max(0, ...months.map(x => Number(x||0) || 0));
  const colors = __gradientRedToIndigo(12);
  list.innerHTML = '';
  for (let i=0; i<12; i++){
    const amt = Number(months[i] || 0) || 0;
    const pct = (max > 0) ? Math.max(0, Math.min(100, (amt / max) * 100)) : 0;
    const row = document.createElement('div');
    row.className = 'mensile-row';
    row.innerHTML = `
      <div class="mensile-head">
        <div class="mensile-name">${__MONTHS_IT[i]}</div>
        <div class="mensile-val">${euro(amt)}</div>
      </div>
      <div class="mensile-bar">
        <div class="mensile-fill" style="--mcolor:${colors[i]}; width:0%"></div>
      </div>
    `;
    list.appendChild(row);
    const fill = row.querySelector('.mensile-fill');
    if (fill){
      try{ requestAnimationFrame(() => { fill.style.width = pct.toFixed(2) + '%'; }); }
      catch(_){ fill.style.width = pct.toFixed(2) + '%'; }
    }
  }
}


function openStatPieModal(