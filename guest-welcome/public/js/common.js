/* Small helpers shared by every screen. No frameworks, no third-party requests. */
const $ = (sel, root = document) => root.querySelector(sel);

// Element builder — text goes in via textContent, so names/menu text can never inject markup.
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}

// replaceChildren that ignores null/false (the native one would print "null").
function fill(el, ...kids) { el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false)); }

const PinStore = {
  get: (scope) => { try { return sessionStorage.getItem('pin:' + scope) || ''; } catch { return ''; } },
  set: (scope, v) => { try { sessionStorage.setItem('pin:' + scope, v); } catch { /* private mode */ } },
  clear: (scope) => { try { sessionStorage.removeItem('pin:' + scope); } catch { /* ignore */ } },
};

async function api(method, url, body, scope) {
  const headers = {};
  if (body !== undefined && !(body instanceof Blob)) headers['Content-Type'] = 'application/json';
  if (body instanceof Blob) headers['Content-Type'] = body.type;
  if (scope) headers['x-pin'] = PinStore.get(scope);
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body) });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) { const e = new Error(data.error || 'Something went wrong'); e.status = res.status; throw e; }
  return data;
}

/* Server-Sent Events with a watchdog. EventSource reconnects by itself; the watchdog
   also rebuilds it if the stream goes silent (e.g. iPad slept, Wi-Fi roamed).
   The server pings every 20s, so 50s of silence means the link is dead. */
function connectStream(role, handlers, opts = {}) {
  let es, last = Date.now(), closed = false;
  const status = (ok) => handlers.status && handlers.status(ok);
  function open() {
    if (closed) return;
    try { es && es.close(); } catch { /* ignore */ }
    const q = new URLSearchParams({ role });
    if (opts.pin) q.set('pin', opts.pin());
    es = new EventSource('/api/events?' + q);
    es.onopen = () => { last = Date.now(); status(true); };
    es.onerror = () => status(false);
    es.addEventListener('ping', () => { last = Date.now(); status(true); });
    for (const [name, fn] of Object.entries(handlers)) {
      if (name === 'status') continue;
      es.addEventListener(name, (e) => { last = Date.now(); status(true); fn(JSON.parse(e.data)); });
    }
  }
  setInterval(() => { if (!closed && Date.now() - last > 50000) { status(false); open(); } }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - last > 30000) open(); });
  window.addEventListener('online', open);
  open();
  return { close() { closed = true; es && es.close(); } };
}

/* Keep the screen awake where the browser allows it (iOS 16.4+ / Android). */
function keepAwake() {
  let lock;
  const grab = async () => { try { lock = await navigator.wakeLock.request('screen'); } catch { /* unsupported or denied */ } };
  if ('wakeLock' in navigator) {
    grab();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) grab(); });
  }
}

const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const ago = (t) => { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'just now' : m + ' min ago'; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* Shared PIN gate used by reception + admin. Calls onReady() once authenticated. */
async function pinGate(scope, title, blurb, onReady) {
  const root = $('#app');
  async function check(pin) {
    PinStore.set(scope, pin);
    await api('POST', '/api/auth/' + scope, {}, scope);
  }
  if (PinStore.get(scope)) { try { await check(PinStore.get(scope)); return onReady(); } catch { PinStore.clear(scope); } }
  const err = h('div', { class: 'error', role: 'alert' });
  const input = h('input', { class: 'input pin-input', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 8, 'aria-label': 'PIN', placeholder: '••••' });
  const go = async () => {
    err.textContent = '';
    try { await check(input.value); root.replaceChildren(); onReady(); }
    catch (e) { PinStore.clear(scope); err.textContent = e.message; input.value = ''; input.focus(); }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  root.replaceChildren(h('div', { class: 'gate' }, h('div', { class: 'card' },
    h('img', { class: 'logo', src: '/assets/logo.png', alt: '.and' }),
    h('h1', null, title), h('p', null, blurb), input, h('div', { style: { height: '10px' } }), err,
    h('button', { class: 'btn primary', style: { width: '100%' }, onclick: go }, 'Enter'))));
  input.focus();
}
