/* Assistant's phone: live order feed with chime + visual alert. */
(async () => {
  const S = Shared;
  const label = (id) => S.allergenLabel(id);
  let orders = [], seen = null;           // seen = ids we've already alerted for (null until first snapshot)
  const fresh = new Set();                // ids still marked NEW until tapped

  /* ---------- sound (iOS needs a tap to unlock audio) ---------- */
  let ctx = null;
  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function chime() {
    const c = audio(); if (!c || c.state !== 'running') return;
    [[880, 0], [1175, .22], [1480, .44]].forEach(([f, t]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, c.currentTime + t);
      g.gain.linearRampToValueAtTime(.35, c.currentTime + t + .02);
      g.gain.exponentialRampToValueAtTime(.001, c.currentTime + t + .9);
      o.connect(g).connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + 1);
    });
  }
  function soundBanner() {
    $('#sound').hidden = !!ctx && ctx.state === 'running';
  }
  function alertNew(count) {
    chime();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }

  /* ---------- rendering ---------- */
  function render() {
    $('#count').textContent = orders.length;
    document.title = (orders.length ? `(${orders.length}) ` : '') + '.and — Orders';
    const list = $('#list');
    if (!orders.length) {
      list.replaceChildren(h('div', { class: 'empty' }, h('div', { class: 'serif' }, 'All quiet.'), h('div', null, 'New orders will appear here, with a chime.')));
      return;
    }
    list.replaceChildren(...[...orders].sort((a, b) => b.createdAt - a.createdAt).map(card));
  }
  function itemLine(kind, it) {
    return h('div', null, h('div', { class: 'k' }, kind),
      h('div', { class: 'v' }, it.name),
      it.summary ? h('div', { class: 's' }, it.summary) : null,
      h('div', { class: 'contains' }, it.allergens.length ? [h('span', { class: 'k', style: { alignSelf: 'center' } }, 'Contains'), ...it.allergens.map((a) => h('span', { class: 'pill' + (hit(a) ? ' hit' : ''), 'data-a': a }, label(a)))] : h('span', { class: 's' }, 'No listed allergens')));
  }
  let curAvoid = [];
  const hit = (a) => curAvoid.includes(a);
  function card(o) {
    curAvoid = o.avoid || [];
    const isNew = fresh.has(o.id);
    const el = h('div', { class: 'order' + (isNew ? ' new' : ''), onclick: () => { if (fresh.delete(o.id)) el.classList.remove('new'), el.querySelector('.badge')?.remove(); } },
      h('div', { class: 'hd' }, h('div', { class: 'who' }, o.guest, isNew ? h('span', { class: 'badge' }, 'NEW') : null), h('div', { class: 'when' }, fmtTime(o.createdAt))),
      o.meeting ? h('div', { class: 'meet' }, 'Meeting ' + o.meeting) : null,
      o.conflicts && o.conflicts.length ? h('div', { class: 'alert hard' }, '⚠ ALLERGEN: ' + o.conflicts.map(label).join(', ').toUpperCase(), h('small', null, 'Guest said they avoid this and chose an item containing it. Please check with them.')) : null,
      o.avoid && o.avoid.length ? h('div', { class: 'alert' }, 'GUEST AVOIDS: ' + o.avoid.map(label).join(', '), h('small', null, 'Declared on the iPad. Check labels and cross-contact.')) : null,
      h('div', { class: 'lines' }, o.drink ? itemLine('Drink', o.drink) : null, o.snack ? itemLine('Snack', o.snack) : null),
      h('button', { class: 'btn primary', onclick: async (e) => {
        e.stopPropagation();
        e.currentTarget.disabled = true;
        try { await api('POST', `/api/orders/${o.id}/done`, {}, 'orders'); orders = orders.filter((x) => x.id !== o.id); render(); }
        catch { e.currentTarget.disabled = false; }
      } }, 'Done'));
    return el;
  }

  /* ---------- boot ---------- */
  const cfg = await api('GET', '/api/config').catch(() => ({}));
  function start() {
    $('#main').hidden = false;
    keepAwake();
    ['click', 'touchend'].forEach((ev) => document.addEventListener(ev, () => { audio(); soundBanner(); }));
    $('#enable').addEventListener('click', () => { audio(); chime(); setTimeout(soundBanner, 200); });
    soundBanner(); setInterval(soundBanner, 3000);
    // keep "x min ago" style times honest
    connectStream('orders', {
      status(ok) { $('#status').replaceChildren(h('span', { class: 'dot ' + (ok ? 'on' : 'off') }), ok ? 'Live' : 'Reconnecting…'); },
      orders(d) {
        orders = d.orders;
        const newOnes = orders.filter((o) => seen && !seen.has(o.id));
        if (seen === null) seen = new Set();
        orders.forEach((o) => seen.add(o.id));
        if (newOnes.length) { newOnes.forEach((o) => fresh.add(o.id)); alertNew(newOnes.length); }
        for (const id of [...fresh]) if (!orders.some((o) => o.id === id)) fresh.delete(id);
        render();
      },
    }, { pin: () => PinStore.get('orders') });
  }
  if (cfg.ordersPinRequired) pinGate('orders', 'Orders', 'Enter the PIN to see incoming orders.', start);
  else start();
})();
