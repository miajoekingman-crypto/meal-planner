'use strict';
/*
 * .and — Guest Welcome. One small Express server:
 *   /guest      guest iPad          /reception  staff: hand over to guest
 *   /orders     assistant's phone   /admin      staff: menu, portfolio, news, settings
 * Storage: data/db.json.  Live updates: Server-Sent Events (auto-reconnect in the browser).
 */
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Shared = require('./public/js/shared.js');
const seed = require('./seed.js');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DEFAULT_PINS = {
  reception: process.env.RECEPTION_PIN || '1234',
  admin: process.env.ADMIN_PIN || '4321',
};
const ORDERS_PIN = process.env.ORDERS_PIN || ''; // optional; empty = open on the local network

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ------------------------------------------------------------------ storage */
let db;
function loadDb() {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { db = {}; }
  db.menu = db.menu || JSON.parse(JSON.stringify(seed.menu));
  db.portfolio = db.portfolio || JSON.parse(JSON.stringify(seed.portfolio));
  db.news = db.news || JSON.parse(JSON.stringify(seed.news));
  db.settings = Object.assign({}, seed.settings, db.settings || {});
  db.pins = db.pins || {};      // hashed overrides set from Admin → Settings
  db.orders = db.orders || [];
  db.session = db.session || null;
  db.version = db.version || 1;
  save();
}
function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

/* --------------------------------------------------------------------- auth */
const fails = new Map(); // ip -> { n, until }
function hashPin(pin, salt = crypto.randomBytes(8).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(pin), salt, 32).toString('hex') };
}
function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function pinOk(scope, pin) {
  pin = String(pin || '');
  const stored = db.pins[scope];
  if (stored) return safeEq(hashPin(pin, stored.salt).hash, stored.hash);
  return safeEq(pin, DEFAULT_PINS[scope]);
}
function requirePin(scope) {
  return (req, res, next) => {
    const ip = req.ip;
    const f = fails.get(ip);
    if (f && f.until > Date.now()) return res.status(429).json({ error: 'Too many attempts. Please wait a minute.' });
    // The admin PIN also opens reception.
    const pin = req.get('x-pin');
    if (pinOk(scope, pin) || (scope === 'reception' && pinOk('admin', pin))) { fails.delete(ip); return next(); }
    const n = (f ? f.n : 0) + 1;
    fails.set(ip, n >= 5 ? { n: 0, until: Date.now() + 60000 } : { n, until: 0 }); // 5 misses → 1 minute lockout
    res.status(401).json({ error: 'Incorrect PIN' });
  };
}
const ordersGuard = (req, res, next) => {
  if (!ORDERS_PIN) return next();
  const pin = req.get('x-pin') || req.query.pin;
  return safeEq(pin || '', ORDERS_PIN) ? next() : res.status(401).json({ error: 'PIN required' });
};

/* ---------------------------------------------------------------------- SSE */
const clients = new Set(); // { res, role }
function send(c, event, data) { c.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcast(event, data, roles) {
  for (const c of clients) if (!roles || roles.includes(c.role)) send(c, event, data);
}
const presence = () => ({ guestOnline: [...clients].filter((c) => c.role === 'guest').length });
const publicSession = () => db.session && { id: db.session.id, name: db.session.name, meeting: db.session.meeting };
function waitMinutes() {
  const s = db.settings;
  return Math.round(s.waitBaseMinutes + s.waitPerOrderMinutes * db.orders.length);
}

setInterval(() => broadcast('ping', Date.now()), 20000); // keeps proxies/Safari from idling the stream

/* ---------------------------------------------------------------------- app */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', false);
app.use(express.json({ limit: '200kb' }));

const publicContent = () => ({
  menu: db.menu,
  portfolio: db.portfolio,
  news: [...db.news].sort((a, b) => String(b.date).localeCompare(String(a.date))),
  settings: db.settings,
  version: db.version,
});
const touch = () => { db.version++; save(); broadcast('content', { version: db.version }); };

app.get('/api/public', (req, res) => { res.set('Cache-Control', 'no-store'); res.json(publicContent()); });
app.get('/api/config', (req, res) => res.json({ ordersPinRequired: !!ORDERS_PIN }));

app.get('/api/events', (req, res) => {
  const role = ['guest', 'orders', 'reception', 'admin'].includes(req.query.role) ? req.query.role : 'guest';
  if (role === 'orders' && ORDERS_PIN && !safeEq(req.query.pin || '', ORDERS_PIN)) return res.status(401).end();
  if ((role === 'reception' || role === 'admin') && !(pinOk(role, req.query.pin) || pinOk('admin', req.query.pin))) return res.status(401).end();
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 2000\n\n');
  const c = { res, role };
  clients.add(c);
  send(c, 'hello', { session: publicSession(), version: db.version, presence: presence() });
  if (role === 'orders' || role === 'reception') send(c, 'orders', { orders: db.orders });
  if (role === 'guest') broadcast('presence', presence(), ['reception']);
  else if (role === 'reception') send(c, 'presence', presence());
  req.on('close', () => { clients.delete(c); if (role === 'guest') broadcast('presence', presence(), ['reception']); });
});

/* ---- reception: hand over to guest ---- */
app.post('/api/auth/:scope', (req, res, next) => {
  if (req.params.scope === 'orders') return ordersGuard(req, res, () => res.json({ ok: true }));
  if (!['reception', 'admin'].includes(req.params.scope)) return res.status(404).end();
  requirePin(req.params.scope)(req, res, () => res.json({ ok: true }));
});

const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

app.post('/api/session', requirePin('reception'), (req, res) => {
  const name = clean(req.body.name, 60);
  if (!name) return res.status(400).json({ error: 'Please enter the guest’s name.' });
  db.session = { id: crypto.randomUUID(), name, meeting: clean(req.body.meeting, 80), startedAt: Date.now() };
  save();
  broadcast('session', publicSession());
  res.json(publicSession());
});
app.delete('/api/session', requirePin('reception'), (req, res) => {
  db.session = null; save(); broadcast('session', null); res.json({ ok: true });
});

/* ---- guest: place an order ---- */
app.post('/api/orders', (req, res) => {
  const body = req.body || {};
  const avoid = (Array.isArray(body.avoid) ? body.avoid : []).filter((a) => Shared.ALLERGENS.some((x) => x.id === a));
  const find = (id, type) => db.menu.find((m) => m.id === id && m.type === type);
  const out = { drink: null, snack: null };
  const fail = (msg) => res.status(400).json({ error: msg });

  if (body.drink) {
    const item = find(body.drink.id, 'drink');
    if (!item) return fail('That drink is no longer on the menu.');
    if (item.soldOut) return fail(item.name + ' has just run out.');
    const o = item.options || {};
    const c = body.drink.choices || {}, choices = {};
    if (o.milk) { if (!Shared.milkById(c.milk)) return fail('Please choose a milk.'); choices.milk = c.milk; }
    if (o.sugar) { choices.sugar = Shared.SUGARS.includes(c.sugar) ? c.sugar : 0; }
    if (o.ice) { choices.ice = Shared.ICES.includes(c.ice) ? c.ice : 'none'; }
    if (o.temps && o.temps.length) { choices.temp = o.temps.includes(c.temp) ? c.temp : o.temps[0]; }
    if (o.variants && o.variants.length) { choices.variant = o.variants.includes(c.variant) ? c.variant : o.variants[0]; }
    const eff = Shared.effective(item, choices);
    out.drink = { id: item.id, name: item.name, choices, summary: Shared.describeChoices(item, choices), kcal: eff.kcal, allergens: eff.allergens };
  }
  if (body.snack) {
    const item = find(body.snack.id, 'snack');
    if (!item) return fail('That snack is no longer on the menu.');
    if (item.soldOut) return fail(item.name + ' has just run out.');
    out.snack = { id: item.id, name: item.name, kcal: item.kcal, allergens: item.allergens || [], diet: item.diet || [] };
  }
  if (!out.drink && !out.snack) return fail('Nothing selected.');

  const present = new Set([...(out.drink ? out.drink.allergens : []), ...(out.snack ? out.snack.allergens : [])]);
  const order = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    guest: db.session ? db.session.name : 'Guest',
    meeting: db.session ? db.session.meeting : '',
    avoid,
    conflicts: avoid.filter((a) => present.has(a)), // guest declared this allergy but chose an item containing it
    ...out,
  };
  const wait = waitMinutes();
  db.orders.push(order);
  db.session = null; // the name is not kept once the order is in
  save();
  broadcast('session', null);
  broadcast('orders', { orders: db.orders, newId: order.id });
  res.json({ ok: true, wait, name: order.guest });
});

app.post('/api/orders/:id/done', ordersGuard, (req, res) => {
  db.orders = db.orders.filter((o) => o.id !== req.params.id);
  save();
  broadcast('orders', { orders: db.orders });
  res.json({ ok: true });
});

/* ---- admin: content CRUD ---- */
const admin = express.Router();
admin.use(requirePin('admin'));

const arr = (v, allowed) => (Array.isArray(v) ? v : []).filter((x) => allowed.includes(x));
const num = (v, d = 0, min = 0, max = 100000) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d; };
const safeUrl = (u) => { u = clean(u, 600); return /^(https?:)?\/\//.test(u) || u.startsWith('/uploads/') || u.startsWith('/assets/') ? u : ''; };

const sanitizers = {
  menu(b) {
    const type = b.type === 'snack' ? 'snack' : 'drink';
    const item = {
      type,
      name: clean(b.name, 60),
      desc: clean(b.desc, 140),
      kcal: num(b.kcal, 0, 0, 3000),
      allergens: arr(b.allergens, Shared.ALLERGENS.map((a) => a.id)),
      diet: arr(b.diet, Shared.DIET_TAGS.map((a) => a.id)),
      soldOut: !!b.soldOut,
    };
    if (type === 'drink') {
      const o = b.options || {};
      item.options = {
        milk: !!o.milk,
        defaultMilk: Shared.milkById(o.defaultMilk) ? o.defaultMilk : 'none',
        sugar: !!o.sugar,
        ice: !!o.ice,
        temps: arr(o.temps, Shared.TEMPS),
        variants: (Array.isArray(o.variants) ? o.variants : []).map((v) => clean(v, 30)).filter(Boolean).slice(0, 6),
      };
    }
    return item.name ? item : null;
  },
  portfolio(b) {
    const it = { title: clean(b.title, 80), location: clean(b.location, 60), type: clean(b.type, 60), image: safeUrl(b.image) };
    return it.title && it.image ? it : null;
  },
  news(b) {
    const it = { title: clean(b.title, 100), body: clean(b.body, 300), date: /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10) };
    return it.title ? it : null;
  },
};
for (const col of ['menu', 'portfolio', 'news']) {
  admin.post(`/${col}`, (req, res) => {
    const item = sanitizers[col](req.body || {});
    if (!item) return res.status(400).json({ error: 'Please complete the required fields.' });
    item.id = col[0] + '-' + crypto.randomBytes(4).toString('hex');
    db[col].push(item); touch(); res.json(item);
  });
  admin.put(`/${col}/:id`, (req, res) => {
    const i = db[col].findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Not found' });
    const item = sanitizers[col](req.body || {});
    if (!item) return res.status(400).json({ error: 'Please complete the required fields.' });
    db[col][i] = Object.assign(item, { id: req.params.id }); touch(); res.json(db[col][i]);
  });
  admin.delete(`/${col}/:id`, (req, res) => {
    db[col] = db[col].filter((x) => x.id !== req.params.id); touch(); res.json({ ok: true });
  });
}
admin.patch('/menu/:id/stock', (req, res) => {
  const it = db.menu.find((x) => x.id === req.params.id);
  if (!it) return res.status(404).json({ error: 'Not found' });
  it.soldOut = !!req.body.soldOut; touch(); res.json(it);
});
admin.put('/portfolio-order', (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const by = new Map(db.portfolio.map((p) => [p.id, p]));
  const next = ids.map((id) => by.get(id)).filter(Boolean);
  db.portfolio.forEach((p) => { if (!next.includes(p)) next.push(p); });
  db.portfolio = next; touch(); res.json({ ok: true });
});
admin.put('/settings', (req, res) => {
  const b = req.body || {}, s = db.settings;
  s.idleMessage = clean(b.idleMessage, 120);
  s.welcomeLine = clean(b.welcomeLine, 120);
  s.inactivitySeconds = num(b.inactivitySeconds, s.inactivitySeconds, 15, 600);
  s.confirmSeconds = num(b.confirmSeconds, s.confirmSeconds, 5, 120);
  s.slideSeconds = num(b.slideSeconds, s.slideSeconds, 4, 60);
  s.waitBaseMinutes = num(b.waitBaseMinutes, s.waitBaseMinutes, 0, 120);
  s.waitPerOrderMinutes = num(b.waitPerOrderMinutes, s.waitPerOrderMinutes, 0, 60);
  s.retentionHours = num(b.retentionHours, s.retentionHours, 1, 48);
  touch(); res.json(s);
});
admin.put('/pins', (req, res) => {
  for (const scope of ['reception', 'admin']) {
    const p = req.body && req.body[scope];
    if (p) {
      if (!/^\d{4,8}$/.test(p)) return res.status(400).json({ error: 'PINs must be 4–8 digits.' });
      db.pins[scope] = hashPin(p);
    }
  }
  save(); res.json({ ok: true });
});
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
admin.post('/upload', express.raw({ type: Object.keys(EXT), limit: '12mb' }), (req, res) => {
  const ext = EXT[(req.get('content-type') || '').split(';')[0]];
  if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Please upload a JPG, PNG, WebP or GIF image.' });
  const name = crypto.randomBytes(8).toString('hex') + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
  res.json({ url: '/uploads/' + name });
});
app.use('/api/admin', admin);
app.use('/api', (err, req, res, next) => res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong.' }));

/* ------------------------------------------------------------------- static */
const PUB = path.join(__dirname, 'public');
const page = (name) => (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(PUB, name, 'index.html'));
for (const r of ['guest', 'reception', 'orders', 'admin']) app.get('/' + r, page(r));

app.get('/manifest/:name.webmanifest', (req, res) => {
  const titles = { guest: '.and Welcome', orders: '.and Orders', reception: '.and Reception', admin: '.and Admin' };
  const n = titles[req.params.name] ? req.params.name : 'guest';
  res.type('application/manifest+json').json({
    name: titles[n], short_name: titles[n], start_url: '/' + n, scope: '/', display: 'standalone',
    orientation: n === 'guest' ? 'landscape' : 'any', background_color: '#faf8f4', theme_color: '#faf8f4',
    icons: [{ src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' }],
  });
});
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use(express.static(PUB, {
  setHeaders(res, file) {
    res.set('Cache-Control', /\.(woff2|png|jpg)$/.test(file) ? 'public, max-age=86400' : 'no-cache');
  },
}));

/* ------------------------------------------------------------------ privacy */
// Guest names and orders never outlive the visit: orders vanish on "Done",
// and anything left over is purged after `retentionHours`.
function purge() {
  const cutoff = Date.now() - db.settings.retentionHours * 3600e3;
  const before = db.orders.length;
  db.orders = db.orders.filter((o) => o.createdAt > cutoff);
  let changed = db.orders.length !== before;
  if (db.session && db.session.startedAt < cutoff) { db.session = null; broadcast('session', null); changed = true; }
  if (changed) { save(); broadcast('orders', { orders: db.orders }); }
}

loadDb();
purge();
setInterval(purge, 60000);

const server = app.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  const base = `http://${ips[0] || 'localhost'}:${PORT}`;
  console.log(`\n  .and Guest Welcome is running\n`);
  console.log(`  This computer    http://localhost:${PORT}`);
  console.log(`  On your Wi-Fi    ${base}\n`);
  for (const r of ['guest', 'reception', 'orders', 'admin']) console.log(`  ${r.padEnd(10)} ${base}/${r}`);
  console.log(`\n  Default PINs → reception ${DEFAULT_PINS.reception} · admin ${DEFAULT_PINS.admin}\n`);
});
module.exports = { app, server };
