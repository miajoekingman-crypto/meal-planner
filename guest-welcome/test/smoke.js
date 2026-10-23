/* End-to-end API smoke test: node test/smoke.js  (starts its own server on a temp data dir) */
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'and-test-'));
process.env.PORT = '3199';
const { server } = require('../server.js');
const base = 'http://127.0.0.1:3199';
const j = async (m, u, b, pin) => {
  const r = await fetch(base + u, { method: m, headers: { 'Content-Type': 'application/json', ...(pin ? { 'x-pin': pin } : {}) }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
(async () => {
  const pub = (await j('GET', '/api/public')).body;
  assert.equal(pub.menu.filter((m) => m.type === 'drink').length, 8);
  assert.equal(pub.menu.filter((m) => m.type === 'snack').length, 8);
  assert.equal(pub.portfolio.length, 6);

  // Auth
  assert.equal((await j('POST', '/api/session', { name: 'X' }, '0000')).status, 401);
  assert.equal((await j('POST', '/api/auth/admin', {}, '4321')).status, 200);
  assert.equal((await j('POST', '/api/admin/menu', { name: 'Hack' })).status, 401);

  // Live feed (SSE) – connect an "orders" client and wait for the new order
  const got = [];
  const ctl = new AbortController();
  fetch(base + '/api/events?role=orders', { signal: ctl.signal }).then(async (r) => {
    const rd = r.body.getReader(); const dec = new TextDecoder();
    for (;;) { const { value, done } = await rd.read(); if (done) break; got.push(dec.decode(value)); }
  }).catch(() => {});

  // Reception hands over; guest orders a cappuccino with oat milk, avoiding nuts + gluten
  assert.equal((await j('POST', '/api/session', { name: 'Priya Sharma', meeting: 'Ananya' }, '1234')).status, 200);
  const r = await j('POST', '/api/orders', {
    drink: { id: 'd-cappuccino', choices: { milk: 'oat', sugar: 25, temp: 'hot' } }, snack: { id: 's-biscotti' }, avoid: ['gluten', 'nuts'],
  });
  assert.equal(r.status, 200); assert.equal(r.body.name, 'Priya Sharma');
  await new Promise((x) => setTimeout(x, 200));
  const feed = got.join('');
  assert.ok(feed.includes('event: orders') && feed.includes('Priya Sharma'), 'order reached the live feed');
  const order = JSON.parse(feed.split('event: orders').pop().split('data: ')[1].split('\n')[0]).orders[0];
  assert.deepEqual(order.drink.allergens, ['gluten']);            // oat milk brings gluten
  assert.deepEqual(order.conflicts.sort(), ['gluten', 'nuts']);   // guest avoids both and picked items with them
  assert.ok(order.drink.kcal >= 8 + 45);

  // Sold out + invalid items are refused
  await j('PATCH', '/api/admin/menu/s-cheese/stock', { soldOut: true }, '4321');
  assert.equal((await j('POST', '/api/orders', { snack: { id: 's-cheese' } })).status, 400);
  assert.equal((await j('POST', '/api/orders', {})).status, 400);

  // Done removes the order
  assert.equal((await j('POST', `/api/orders/${order.id}/done`)).status, 200);
  ctl.abort();

  // Admin CRUD
  const add = await j('POST', '/api/admin/news', { title: 'Hello', body: 'World' }, '4321');
  assert.equal(add.status, 200);
  assert.equal((await j('PUT', '/api/admin/settings', { idleMessage: 'Hi', inactivitySeconds: 5000 }, '4321')).body.inactivitySeconds, 600);
  assert.equal((await j('DELETE', `/api/admin/news/${add.body.id}`, null, '4321')).status, 200);
  assert.equal((await j('POST', '/api/admin/portfolio', { title: 'x', image: 'javascript:alert(1)' }, '4321')).status, 400);
  console.log('smoke test passed');
  server.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
