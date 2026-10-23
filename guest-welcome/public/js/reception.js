/* Reception: type the guest's name, hand over to the iPad. */
pinGate('reception', 'Reception', 'Enter the reception PIN.', () => {
  const root = $('#app');
  let session = null, orders = [], online = 0, msg = '';

  const name = h('input', { class: 'input', id: 'name', placeholder: 'e.g. Priya Sharma', autocomplete: 'off', autocapitalize: 'words', maxlength: 60 });
  const meeting = h('input', { class: 'input', id: 'meeting', placeholder: 'e.g. Ananya Rao (optional)', autocomplete: 'off', autocapitalize: 'words', maxlength: 80 });
  const err = h('div', { class: 'error', role: 'alert' });
  const status = h('div'), current = h('div');

  async function handOver() {
    err.textContent = '';
    try {
      const s = await api('POST', '/api/session', { name: name.value, meeting: meeting.value }, 'reception');
      msg = `Handed over. The iPad is now greeting ${s.name}.`;
      name.value = ''; meeting.value = ''; name.focus();
      draw();
    } catch (e) {
      if (e.status === 401) { PinStore.clear('reception'); location.reload(); }
      err.textContent = e.message;
    }
  }
  [name, meeting].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') handOver(); }));

  function draw() {
    status.replaceChildren(h('span', { class: 'dot ' + (online ? 'on' : 'off') }), online ? 'Guest iPad connected' : 'Guest iPad not connected');
    fill(current, session
      ? h('div', { class: 'card now' },
          h('div', null, h('div', { class: 'label' }, 'Currently greeting'), h('div', { class: 'n' }, session.name), session.meeting ? h('div', { class: 'sub', style: { margin: 0 } }, 'Meeting ' + session.meeting) : null),
          h('button', { class: 'btn small', onclick: async () => { await api('DELETE', '/api/session', undefined, 'reception'); msg = 'iPad returned to the showcase.'; draw(); } }, 'Cancel'))
      : msg ? h('p', { class: 'ok' }, msg) : null);
    $('#orderline').textContent = orders.length ? `${orders.length} order${orders.length === 1 ? '' : 's'} with the assistant` : 'No open orders';
  }

  root.replaceChildren(h('div', { class: 'shell' },
    h('div', { class: 'topbar' }, h('img', { class: 'logo', src: '/assets/logo.png', alt: '.and' }), h('div', { class: 'where' }, 'Reception')),
    h('div', { class: 'stack' },
      h('div', null, h('h1', { class: 't' }, 'Who is joining us?'), h('p', { class: 'sub' }, 'Type their name, then hand the iPad over — it will greet them personally.')),
      h('div', { class: 'card' },
        h('div', { class: 'field' }, h('label', { for: 'name' }, 'Guest name'), name),
        h('div', { class: 'field' }, h('label', { for: 'meeting' }, 'Meeting with'), meeting),
        err,
        h('button', { class: 'btn primary big', onclick: handOver }, 'Hand over to guest')),
      current,
      h('div', { class: 'sub', style: { fontSize: '.9rem' } }, status, h('br'), h('span', { id: 'orderline' })),
      h('p', { class: 'sub', style: { fontSize: '.82rem' } }, 'Guest names are not kept: they clear once an order is placed, or after a few hours.'),
      h('button', { class: 'btn quiet small', onclick: () => { PinStore.clear('reception'); location.reload(); } }, 'Lock'))));
  name.focus();
  draw();

  connectStream('reception', {
    status(ok) { if (!ok) { online = 0; draw(); } },
    hello(d) { session = d.session; online = d.presence.guestOnline; draw(); },
    session(s) { session = s; if (s) msg = ''; draw(); },
    presence(p) { online = p.guestOnline; draw(); },
    orders(d) { orders = d.orders; draw(); },
  }, { pin: () => PinStore.get('reception') });
});
