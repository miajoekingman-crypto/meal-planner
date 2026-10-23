/* Admin: menu, portfolio, news, settings. No code changes needed to run the lounge. */
pinGate('admin', 'Admin', 'Enter the admin PIN.', () => {
  const S = Shared;
  const root = $('#app');
  let content = null, tab = 'menu', editing = null; // editing: { col, item|null, kind }

  const A = (m, u, b) => api(m, '/api/admin' + u, b, 'admin').catch((e) => {
    if (e.status === 401) { PinStore.clear('admin'); location.reload(); }
    throw e;
  });
  function toast(msg) { const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), 2200); }
  async function reload() { content = await api('GET', '/api/public'); draw(); }
  async function act(fn, ok) { try { await fn(); if (ok) toast(ok); editing = null; await reload(); } catch (e) { toast(e.message); } }

  /* ----- generic list row ----- */
  const row = (opts) => h('div', { class: 'li' + (opts.out ? ' out' : '') },
    opts.thumb ? h('img', { class: 'th', src: opts.thumb, alt: '', onerror: (e) => e.target.style.visibility = 'hidden' }) : null,
    h('div', { class: 'grow' }, h('div', { class: 'nm' }, opts.title), h('div', { class: 'meta' }, opts.meta)),
    h('div', { class: 'acts' }, opts.actions));
  const btn = (text, fn, cls = 'btn small') => h('button', { class: cls, onclick: fn }, text);

  /* ----- MENU ----- */
  function menuTab() {
    const mk = (kind) => content.menu.filter((m) => m.type === kind);
    const section = (kind, title) => h('div', null,
      h('div', { class: 'bar' }, h('h3', { class: 'label' }, title), btn('+ Add ' + kind, () => { editing = { col: 'menu', kind, item: null }; draw(); window.scrollTo(0, 0); })),
      h('div', { class: 'list' }, mk(kind).map((m) => row({
        out: m.soldOut, title: m.name + (m.soldOut ? ' — out of stock' : ''),
        meta: `${m.kcal} kcal · ${m.allergens.length ? m.allergens.map(S.allergenLabel).join(', ') : 'no allergens'} · ${m.diet.join(', ') || 'no tags'}`,
        actions: [
          btn(m.soldOut ? 'Mark in stock' : 'Mark out of stock', () => act(() => A('PATCH', `/menu/${m.id}/stock`, { soldOut: !m.soldOut }))),
          btn('Edit', () => { editing = { col: 'menu', kind, item: m }; draw(); window.scrollTo(0, 0); }),
          btn('Delete', () => { if (confirm(`Remove ${m.name}?`)) act(() => A('DELETE', `/menu/${m.id}`), 'Removed'); }, 'btn small danger')],
      }))));
    return h('div', null,
      h('div', { class: 'banner' }, h('b', null, 'TEST DATA. '), 'Calories, allergens and dietary tags are sample values. Replace them with the caterer’s verified information before real use.'),
      editing && editing.col === 'menu' ? menuEditor() : null,
      section('drink', 'Drinks'), h('div', { style: { height: '26px' } }), section('snack', 'Snacks'));
  }
  function menuEditor() {
    const { kind, item } = editing;
    const m = item ? JSON.parse(JSON.stringify(item)) : { type: kind, name: '', desc: '', kcal: 0, allergens: [], diet: [], soldOut: false, options: { milk: false, defaultMilk: 'none', sugar: false, ice: false, temps: ['hot'], variants: [] } };
    const o = m.options || {};
    const f = {
      name: h('input', { class: 'input', value: m.name, maxlength: 60 }),
      desc: h('input', { class: 'input', value: m.desc, maxlength: 140 }),
      kcal: h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 0, value: m.kcal }),
      variants: h('input', { class: 'input', value: (o.variants || []).join(', '), placeholder: 'e.g. Still, Sparkling' }),
      defMilk: h('select', { class: 'input' }, S.MILKS.map((x) => h('option', { value: x.id, selected: o.defaultMilk === x.id }, x.label))),
    };
    const boxes = (list, chosen, extra) => list.map((a) => h('label', { class: 'check' }, h('input', Object.assign({ type: 'checkbox', value: a.id }, chosen.includes(a.id) ? { checked: true } : {}, extra)), a.label));
    const allergens = boxes(S.ALLERGENS, m.allergens), diets = boxes(S.DIET_TAGS, m.diet);
    const temps = boxes(S.TEMPS.map((t) => ({ id: t, label: cap(t) })), o.temps || []);
    const flag = (key, text) => h('label', { class: 'check' }, h('input', Object.assign({ type: 'checkbox', 'data-opt': key }, o[key] ? { checked: true } : {})), text);
    const optEls = kind === 'drink' ? h('div', null,
      h('div', { class: 'field' }, h('label', null, 'Customisation offered'), h('div', { class: 'row' }, flag('milk', 'Milk choice'), flag('sugar', 'Sugar level'), flag('ice', 'Ice'))),
      h('div', { class: 'cols' },
        h('div', { class: 'field' }, h('label', null, 'Temperatures available (first is the default)'), h('div', { class: 'row' }, temps)),
        h('div', { class: 'field' }, h('label', null, 'Default milk'), f.defMilk)),
      h('div', { class: 'field' }, h('label', null, 'Style options (optional, comma separated)'), f.variants),
      h('p', { class: 'hint' }, 'Milk choice adds its own allergens and calories automatically (oat → gluten, almond → tree nuts, soy → soya, whole → milk). List only the drink’s own allergens above.')) : null;
    const checked = (nodes) => nodes.map((l) => l.firstChild).filter((i) => i.checked).map((i) => i.value);
    const save = () => {
      const body = { type: kind, name: f.name.value, desc: f.desc.value, kcal: f.kcal.value, allergens: checked(allergens), diet: checked(diets), soldOut: m.soldOut };
      if (kind === 'drink') {
        const opt = (k) => optEls.querySelector(`[data-opt=${k}]`).checked;
        body.options = { milk: opt('milk'), sugar: opt('sugar'), ice: opt('ice'), temps: checked(temps), defaultMilk: f.defMilk.value, variants: f.variants.value.split(',').map((s) => s.trim()).filter(Boolean) };
      }
      act(() => (item ? A('PUT', `/menu/${item.id}`, body) : A('POST', '/menu', body)), 'Saved');
    };
    return h('div', { class: 'card editor' }, h('h3', null, (item ? 'Edit ' : 'New ') + kind),
      h('div', { class: 'cols' }, h('div', { class: 'field' }, h('label', null, 'Name'), f.name), h('div', { class: 'field' }, h('label', null, 'Calories (kcal)'), f.kcal)),
      h('div', { class: 'field' }, h('label', null, 'One-line description'), f.desc),
      h('div', { class: 'field' }, h('label', null, 'Contains (EU 14 allergens)'), h('div', { class: 'row' }, allergens)),
      h('div', { class: 'field' }, h('label', null, 'Dietary tags'), h('div', { class: 'row' }, diets)),
      optEls,
      h('div', { class: 'row' }, btn('Save', save, 'btn primary'), btn('Cancel', () => { editing = null; draw(); }, 'btn')));
  }

  /* ----- PORTFOLIO ----- */
  function portfolioTab() {
    const list = content.portfolio;
    const move = (i, d) => { const ids = list.map((p) => p.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; act(() => A('PUT', '/portfolio-order', { ids })); };
    return h('div', null,
      editing && editing.col === 'portfolio' ? portfolioEditor() : null,
      h('div', { class: 'bar' }, h('p', { class: 'hint', style: { margin: 0 } }, 'Shown in this order on the idle showcase and in “Our work”.'), btn('+ Add project', () => { editing = { col: 'portfolio', item: null }; draw(); window.scrollTo(0, 0); })),
      h('div', { class: 'list' }, list.map((p, i) => row({
        thumb: p.image, title: p.title, meta: `${p.location} · ${p.type}`,
        actions: [i > 0 && btn('↑', () => move(i, -1)), i < list.length - 1 && btn('↓', () => move(i, 1)),
          btn('Edit', () => { editing = { col: 'portfolio', item: p }; draw(); window.scrollTo(0, 0); }),
          btn('Delete', () => { if (confirm(`Remove ${p.title}?`)) act(() => A('DELETE', `/portfolio/${p.id}`), 'Removed'); }, 'btn small danger')].filter(Boolean),
      }))));
  }
  function portfolioEditor() {
    const p = editing.item || { title: '', location: '', type: '', image: '' };
    const f = { title: h('input', { class: 'input', value: p.title }), location: h('input', { class: 'input', value: p.location }), type: h('input', { class: 'input', value: p.type, placeholder: 'e.g. Residential' }), image: h('input', { class: 'input', value: p.image, placeholder: 'https://… or upload below' }) };
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', class: 'input', style: { paddingTop: '14px' } });
    file.addEventListener('change', async () => {
      const x = file.files[0]; if (!x) return;
      try { const r = await A('POST', '/upload', x); f.image.value = r.url; toast('Image uploaded. Press Save.'); } catch (e) { toast(e.message); }
    });
    return h('div', { class: 'card editor' }, h('h3', null, editing.item ? 'Edit project' : 'New project'),
      h('div', { class: 'cols' }, h('div', { class: 'field' }, h('label', null, 'Project name'), f.title), h('div', { class: 'field' }, h('label', null, 'Location'), f.location)),
      h('div', { class: 'field' }, h('label', null, 'Type'), f.type),
      h('div', { class: 'field' }, h('label', null, 'Image address'), f.image),
      h('div', { class: 'field' }, h('label', null, 'Or upload a photo (JPG, PNG, WebP; landscape works best)'), file),
      h('div', { class: 'row' }, btn('Save', () => {
        const body = { title: f.title.value, location: f.location.value, type: f.type.value, image: f.image.value };
        act(() => (editing.item ? A('PUT', `/portfolio/${editing.item.id}`, body) : A('POST', '/portfolio', body)), 'Saved');
      }, 'btn primary'), btn('Cancel', () => { editing = null; draw(); }, 'btn')));
  }

  /* ----- NEWS ----- */
  function newsTab() {
    return h('div', null,
      editing && editing.col === 'news' ? newsEditor() : null,
      h('div', { class: 'bar' }, h('span'), btn('+ Add news item', () => { editing = { col: 'news', item: null }; draw(); window.scrollTo(0, 0); })),
      h('div', { class: 'list' }, content.news.map((n) => row({
        title: n.title, meta: `${n.date} · ${n.body}`,
        actions: [btn('Edit', () => { editing = { col: 'news', item: n }; draw(); window.scrollTo(0, 0); }),
          btn('Delete', () => { if (confirm('Remove this item?')) act(() => A('DELETE', `/news/${n.id}`), 'Removed'); }, 'btn small danger')],
      }))));
  }
  function newsEditor() {
    const n = editing.item || { title: '', body: '', date: new Date().toISOString().slice(0, 10) };
    const f = { title: h('input', { class: 'input', value: n.title, maxlength: 100 }), date: h('input', { class: 'input', type: 'date', value: n.date }), body: h('textarea', { class: 'input', maxlength: 300 }, n.body) };
    return h('div', { class: 'card editor' }, h('h3', null, editing.item ? 'Edit news item' : 'New news item'),
      h('div', { class: 'cols' }, h('div', { class: 'field' }, h('label', null, 'Headline'), f.title), h('div', { class: 'field' }, h('label', null, 'Date'), f.date)),
      h('div', { class: 'field' }, h('label', null, 'Details (one or two sentences)'), f.body),
      h('div', { class: 'row' }, btn('Save', () => {
        const body = { title: f.title.value, date: f.date.value, body: f.body.value };
        act(() => (editing.item ? A('PUT', `/news/${editing.item.id}`, body) : A('POST', '/news', body)), 'Saved');
      }, 'btn primary'), btn('Cancel', () => { editing = null; draw(); }, 'btn')));
  }

  /* ----- SETTINGS ----- */
  function settingsTab() {
    const s = content.settings;
    const num = (v, min) => h('input', { class: 'input', type: 'number', inputmode: 'numeric', min, value: v });
    const f = {
      idleMessage: h('input', { class: 'input', value: s.idleMessage, maxlength: 120 }),
      welcomeLine: h('input', { class: 'input', value: s.welcomeLine, maxlength: 120 }),
      inactivitySeconds: num(s.inactivitySeconds, 15), confirmSeconds: num(s.confirmSeconds, 5), slideSeconds: num(s.slideSeconds, 4),
      waitBaseMinutes: num(s.waitBaseMinutes, 0), waitPerOrderMinutes: num(s.waitPerOrderMinutes, 0), retentionHours: num(s.retentionHours, 1),
    };
    const field = (text, el, hint) => h('div', { class: 'field' }, h('label', null, text), el, hint ? h('span', { class: 'hint' }, hint) : null);
    const pins = { reception: h('input', { class: 'input', type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: 'leave blank to keep' }), admin: h('input', { class: 'input', type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: 'leave blank to keep' }) };
    return h('div', { class: 'stack' },
      h('div', { class: 'card' }, h('h3', { class: 'label', style: { marginBottom: '1rem' } }, 'Guest screen'),
        field('Idle message (large text over the showcase)', f.idleMessage),
        field('Welcome line (under the guest’s name)', f.welcomeLine),
        h('div', { class: 'cols' },
          field('Return to showcase after (seconds of inactivity)', f.inactivitySeconds),
          field('Confirmation screen shows for (seconds)', f.confirmSeconds),
          field('Showcase slide length (seconds)', f.slideSeconds),
          field('Delete orders left open after (hours)', f.retentionHours, 'Guest names and orders are always cleared by then.')),
        h('div', { class: 'label', style: { margin: '8px 0 10px' } }, 'Estimated wait'),
        h('div', { class: 'cols' }, field('Base wait (minutes)', f.waitBaseMinutes), field('Extra per order already waiting (minutes)', f.waitPerOrderMinutes)),
        btn('Save settings', () => act(() => A('PUT', '/settings', Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value]))), 'Settings saved'), 'btn primary')),
      h('div', { style: { height: '20px' } }),
      h('div', { class: 'card' }, h('h3', { class: 'label', style: { marginBottom: '1rem' } }, 'PINs (4–8 digits)'),
        h('div', { class: 'cols' }, field('New reception PIN', pins.reception), field('New admin PIN', pins.admin)),
        btn('Change PIN', async () => {
          const body = {}; if (pins.reception.value) body.reception = pins.reception.value; if (pins.admin.value) body.admin = pins.admin.value;
          if (!Object.keys(body).length) return toast('Enter a new PIN first');
          try { await A('PUT', '/pins', body); if (body.admin) PinStore.set('admin', body.admin); pins.reception.value = pins.admin.value = ''; toast('PIN updated'); } catch (e) { toast(e.message); }
        }, 'btn')));
  }

  /* ----- shell ----- */
  const TABS = { menu: 'Menu', portfolio: 'Portfolio', news: 'News', settings: 'Settings' };
  function draw() {
    const body = { menu: menuTab, portfolio: portfolioTab, news: newsTab, settings: settingsTab }[tab]();
    root.replaceChildren(h('div', { class: 'shell' },
      h('div', { class: 'topbar' }, h('img', { class: 'logo', src: '/assets/logo.png', alt: '.and' }), h('div', { class: 'where' }, 'Admin')),
      h('div', { class: 'tabs' }, Object.entries(TABS).map(([k, v]) => h('button', { class: 'tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; editing = null; draw(); } }, v)),
        h('span', { style: { flex: 1 } }), btn('Lock', () => { PinStore.clear('admin'); location.reload(); }, 'btn quiet small')),
      body));
  }
  reload();
});
