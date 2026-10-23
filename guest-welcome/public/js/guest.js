/* Guest iPad: idle showcase → welcome → drink → snack → review → confirmation. */
(() => {
  const S = Shared;
  const app = $('#app');

  const state = {
    content: null,
    session: null,           // { id, name, meeting } set by reception
    screen: null,
    returnTo: null,          // where "Back" leads from the gallery / news
    filterOn: false,
    avoid: [],               // allergen ids the guest asked us to avoid
    filterMode: 'mark',      // 'mark' | 'hide'
    drink: null,             // { id, choices }
    snack: null,             // { id }
    confirm: null,
    lastTouch: Date.now(),
  };
  let timers = [];           // per-screen timers, cleared on every screen change
  let placing = false;
  let curEl = null;          // the live screen element (sheets and toasts sit beside it)

  const settings = () => (state.content && state.content.settings) || {};
  const item = (id) => state.content.menu.find((m) => m.id === id);
  const label = (id) => (id === 'gluten' ? 'Gluten' : S.allergenLabel(id));
  const guestName = () => (state.session && state.session.name) || null;

  /* ------------------------------------------------------------- photography */
  const TONES = [['#d8cfc2', '#9a8f80'], ['#cfd3d2', '#7f8b8a'], ['#dccfbf', '#a48a6c'], ['#c9cfd6', '#7a8794']];
  function photo(p, i = 0) {
    const [a, b] = TONES[i % TONES.length];
    const d = h('div', { class: 'photo', style: { background: `linear-gradient(135deg, ${a}, ${b})` } });
    const img = h('img', { src: p.image, alt: p.title, draggable: 'false' });
    img.onload = () => d.classList.add('loaded');
    img.onerror = () => img.remove(); // offline / dead link: keep the quiet gradient
    d.append(img);
    return d;
  }
  const logo = (cls = '') => h('img', { class: 'logo ' + cls, src: '/assets/logo.png', alt: '.and', draggable: 'false' });

  /* ----------------------------------------------------------------- routing */
  function clearTimers() { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; }
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const every = (fn, ms) => { const t = setInterval(fn, ms); timers.push(t); return t; };

  function go(name, opts = {}) {
    if (!state.content) return;
    clearTimers();
    closeSheet();
    state.screen = name;
    const el = SCREENS[name]();
    el.classList.add('screen');
    const old = [...app.children].filter((c) => !c.classList.contains('scrim-modal') && !c.classList.contains('toast'));
    old.forEach((o) => { o.classList.remove('in'); o.classList.add('leaving'); });
    app.append(el);
    curEl = el;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    setTimeout(() => old.forEach((o) => o.remove()), opts.instant ? 0 : 800);
    if (opts.instant) old.forEach((o) => o.remove());
  }
  // Re-render in place (content changed, filter toggled) without the cross-fade.
  function rerender() {
    const cur = curEl;
    if (!cur) return;
    const scroller = cur.querySelector('.grid');
    const top = scroller ? scroller.scrollTop : 0;
    const el = SCREENS[state.screen]();
    el.classList.add('screen', 'in');
    el.querySelectorAll('.fade-up').forEach((n) => (n.style.animation = 'none'));
    cur.replaceWith(el);
    curEl = el;
    const g = el.querySelector('.grid');
    if (g) g.scrollTop = top;
  }

  /* ------------------------------------------------------------ privacy reset */
  function resetChoices() {
    state.drink = null; state.snack = null; state.avoid = []; state.filterOn = false; state.filterMode = 'mark'; state.confirm = null;
  }
  function toIdle() { resetChoices(); go('idle'); }

  /* ---------------------------------------------------------------- idle */
  function idle() {
    const projects = state.content.portfolio;
    const news = state.content.news;
    const el = h('div', { class: 'idle', onpointerdown: wake });
    const slides = projects.map((p, i) => h('div', { class: 'slide' + (i === 0 ? ' active' : '') }, photo(p, i)));
    el.append(...slides, h('div', { class: 'scrim' }));
    el.append(h('div', { class: 'brand' }, logo()));
    el.append(h('div', { class: 'hint' }, 'Touch to begin'));
    if (settings().idleMessage) el.append(h('div', { class: 'motto' }, settings().idleMessage));

    const kicker = h('div', { class: 'k' }, 'Studio news & updates');
    const nt = h('div', { class: 't' }), nb = h('div', { class: 'b' });
    const newsEl = h('div', { class: 'news' }, kicker, nt, nb);
    const capT = h('div', { class: 't' }), capL = h('div', { class: 'l' });
    const capEl = h('div', { class: 'cap' }, capT, capL);
    if (news.length) el.append(newsEl);
    if (projects.length) el.append(capEl);

    let i = 0, n = 0;
    const show = () => {
      if (news.length) { const x = news[n % news.length]; nt.textContent = x.title; nb.textContent = x.body; }
      if (projects.length) { const p = projects[i % projects.length]; capT.textContent = p.title; capL.textContent = p.location + ' · ' + p.type; }
    };
    show();
    const step = Math.max(4, settings().slideSeconds || 9) * 1000;
    if (projects.length > 1) every(() => {
      newsEl.style.opacity = capEl.style.opacity = 0;
      slides[i % slides.length].classList.remove('active');
      i++; n++;
      slides[i % slides.length].classList.add('active');
      later(() => { show(); newsEl.style.opacity = capEl.style.opacity = 1; }, 1000);
    }, step);
    return el;
  }
  function wake() { go('welcome'); }

  /* -------------------------------------------------------------- welcome */
  function welcome() {
    const name = guestName();
    const heading = name ? `Welcome, ${name}` : 'Welcome';
    const meet = state.session && state.session.meeting;
    const projects = state.content.portfolio;
    return h('div', { class: 'welcome' },
      h('div', { class: 'text' },
        logo(),
        h('div', { class: 'mid fade-up' },
          h('h1', { class: heading.length > 20 ? 'long' : '' }, heading),
          h('p', { class: 'line' }, settings().welcomeLine || 'Please make yourself comfortable.'),
          meet && h('p', { class: 'meet' }, `${meet} will be with you shortly.`)),
        h('div', { class: 'acts' },
          h('button', { class: 'btn primary', onclick: () => go('drinks') }, 'Choose a refreshment'),
          h('button', { class: 'btn', onclick: () => openWork('welcome') }, 'Our work'),
          h('button', { class: 'btn quiet', onclick: () => openNews('welcome') }, 'Latest from the studio'))),
      h('div', { class: 'photoside' }, projects.length ? photo(projects[0]) : null));
  }

  /* ------------------------------------------------------- menu: shared bits */
  function header(current) {
    return h('div', { class: 'bar' }, logo(),
      h('div', { class: 'nav' },
        h('button', { class: 'btn small quiet', onclick: () => openWork(current) }, 'Our work'),
        h('button', { class: 'btn small quiet', onclick: () => openNews(current) }, 'Latest from the studio')));
  }
  function filterBlock() {
    const on = state.filterOn;
    const sw = h('button', { class: 'switch' + (on ? ' on' : ''), 'aria-pressed': on, onclick: () => {
      state.filterOn = !state.filterOn;
      if (!state.filterOn) state.avoid = [];
      revalidate(); rerender();
    } }, h('i'), 'I have dietary needs');
    const out = [sw];
    if (on) {
      out.push(h('div', { class: 'filter' },
        h('div', { class: 'top' },
          h('div', null, h('div', { class: 'eyebrow' }, 'Please select anything you need to avoid')),
          h('div', { class: 'seg' },
            h('button', { class: state.filterMode === 'mark' ? 'on' : '', onclick: () => { state.filterMode = 'mark'; rerender(); } }, 'Highlight unsuitable'),
            h('button', { class: state.filterMode === 'hide' ? 'on' : '', onclick: () => { state.filterMode = 'hide'; rerender(); } }, 'Hide unsuitable'))),
        h('div', { class: 'chips' }, S.ALLERGENS.map((a) => h('button', {
          class: 'chip' + (state.avoid.includes(a.id) ? ' on' : ''),
          onclick: () => {
            state.avoid = state.avoid.includes(a.id) ? state.avoid.filter((x) => x !== a.id) : [...state.avoid, a.id];
            revalidate(); rerender();
          } }, label(a.id))))));
    }
    return out;
  }
  // After the filter changes, drop or adjust choices that are no longer safe.
  function revalidate() {
    const avoid = state.filterOn ? state.avoid : [];
    if (state.drink) {
      const it = item(state.drink.id);
      if (!it || !S.suitable(it, avoid)) state.drink = null;
      else if (it.options && it.options.milk && !S.safeMilks(it, avoid).some((m) => m.id === state.drink.choices.milk)) {
        state.drink.choices.milk = pickMilk(it, avoid);
      }
    }
    if (state.snack) {
      const it = item(state.snack.id);
      if (!it || !S.suitable(it, avoid)) state.snack = null;
    }
  }
  function pickMilk(it, avoid) {
    const safe = S.safeMilks(it, avoid);
    const pref = [it.options.defaultMilk, 'none'];
    for (const p of pref) if (safe.some((m) => m.id === p)) return p;
    return safe[0] ? safe[0].id : 'none';
  }
  const needsSheet = (it) => {
    const o = it.options || {};
    return !!(o.milk || o.sugar || o.ice || (o.temps && o.temps.length > 1) || (o.variants && o.variants.length));
  };

  function card(it, selected, onPick) {
    const avoid = state.filterOn ? state.avoid : [];
    const bad = !S.suitable(it, avoid);
    const blocked = (it.allergens || []).filter((a) => avoid.includes(a));
    const milkVaries = it.options && it.options.milk;
    const off = it.soldOut || bad;
    let al;
    if (milkVaries) al = h('div', { class: 'al' }, (it.allergens || []).length ? 'Contains: ' + it.allergens.map(label).join(', ') + ' · plus any from your milk' : 'Allergens depend on your choice of milk');
    else al = h('div', { class: 'al' }, (it.allergens || []).length ? 'Contains: ' + it.allergens.map(label).join(', ') : 'No listed allergens');
    return h('div', { class: 'item' + (selected ? ' sel' : '') + (off ? ' off' : ''), role: 'button', tabindex: '0', 'aria-pressed': selected, 'aria-disabled': off, onclick: () => { if (!off) onPick(); } },
      h('div', { class: 'tick' }, '✓'),
      h('div', { class: 'nm' }, it.name),
      h('div', { class: 'ds' }, it.desc),
      it.soldOut ? h('div', { class: 'why', style: { color: 'var(--muted)' } }, 'Not available today')
        : bad ? h('div', { class: 'why' }, blocked.length ? 'Contains ' + blocked.map((a) => label(a).toLowerCase()).join(', ') : 'No suitable milk')
        : needsSheet(it) && it.type === 'drink' ? h('div', { class: 'cust' }, 'Make it yours') : null,
      h('div', { class: 'kc' }, h('b', null, it.kcal + (milkVaries ? '+' : '')), ' kcal'),
      al,
      h('div', { class: 'tags' }, (it.diet || []).map((t) => h('span', { class: 'tag' }, S.DIET_TAGS.find((d) => d.id === t)?.label || t))));
  }

  function menuScreen(kind) {
    const isDrink = kind === 'drink';
    const avoid = state.filterOn ? state.avoid : [];
    let items = state.content.menu.filter((m) => m.type === kind);
    if (state.filterOn && state.filterMode === 'hide') items = items.filter((m) => S.suitable(m, avoid));
    const sel = isDrink ? state.drink : state.snack;
    const cards = items.map((it) => card(it, !!sel && sel.id === it.id, () => {
      if (sel && sel.id === it.id) { if (isDrink) state.drink = null; else state.snack = null; return rerender(); }
      if (isDrink && needsSheet(it)) return openSheet(it);
      if (isDrink) state.drink = { id: it.id, choices: S.defaultChoices(it) }; else state.snack = { id: it.id };
      rerender();
    }));
    const chosen = sel && item(sel.id);
    return h('div', null,
      header(isDrink ? 'drinks' : 'snacks'),
      h('div', { class: 'head' },
        h('div', { class: 'fade-up' },
          h('div', { class: 'eyebrow' }, isDrink ? 'To drink' : 'Something to eat'),
          h('h2', null, isDrink ? 'May we offer you a drink?' : 'Perhaps something to go with it?'),
          h('p', { class: 'sub' }, isDrink ? 'Choose what you like, or skip it.' : 'Entirely optional.')),
        filterBlock()[0]),
      state.filterOn ? filterBlock()[1] : null,
      h('div', { class: 'grid' }, cards.length ? cards : h('p', { class: 'sub', style: { gridColumn: '1/-1', color: 'var(--muted)' } }, 'Nothing here matches your dietary needs. Please ask us and we’ll gladly arrange something.')),
      h('div', { class: 'note' }, 'Allergen details are a guide. If you have a serious allergy, please tell us in person.'),
      h('div', { class: 'foot' },
        h('button', { class: 'btn', onclick: () => go(isDrink ? 'welcome' : 'drinks') }, 'Back'),
        h('div', { class: 'mid' },
          h('div', { class: 'steps' }, [0, 1, 2].map((i) => h('span', { class: i <= (isDrink ? 0 : 1) ? 'on' : '' }))),
          chosen ? h('span', null, 'Your choice: ', h('b', null, chosen.name)) : 'Nothing chosen yet'),
        h('button', { class: 'btn primary', onclick: () => go(isDrink ? 'snacks' : 'review') },
          chosen ? 'Continue' : isDrink ? 'No drink, thank you' : 'No snack, thank you')));
  }

  /* ---------------------------------------------------- customisation sheet */
  let sheetEl = null;
  function closeSheet() { if (sheetEl) { const s = sheetEl; sheetEl = null; s.classList.remove('in'); setTimeout(() => s.remove(), 600); } }
  function openSheet(it) {
    const avoid = state.filterOn ? state.avoid : [];
    const o = it.options || {};
    const existing = state.drink && state.drink.id === it.id ? state.drink.choices : null;
    const c = Object.assign(S.defaultChoices(it), existing || {});
    if (o.milk && !S.safeMilks(it, avoid).some((m) => m.id === c.milk)) c.milk = pickMilk(it, avoid);

    const body = h('div');
    const meta = h('div', { class: 'meta' });
    function draw() {
      const eff = S.effective(it, c);
      const hit = eff.allergens.filter((a) => avoid.includes(a));
      fill(meta,
        h('span', null, `≈ ${eff.kcal} kcal`),
        h('span', null, eff.allergens.length ? 'Contains: ' + eff.allergens.map(label).join(', ') : 'No listed allergens'),
        hit.length ? h('span', { class: 'warn' }, 'Contains ' + hit.map((a) => label(a).toLowerCase()).join(', ')) : null);
      fill(body,
        o.variants && o.variants.length ? group('Style', o.variants.map((v) => [v, v]), c.variant, (v) => (c.variant = v)) : null,
        o.temps && o.temps.length > 1 ? group('Temperature', o.temps.map((t) => [t, cap(t)]), c.temp, (v) => (c.temp = v)) : null,
        o.milk ? group('Milk', S.MILKS.map((m) => [m.id, m.label, m.allergens.some((a) => avoid.includes(a))]), c.milk, (v) => (c.milk = v)) : null,
        o.sugar ? group('Sugar', S.SUGARS.map((s) => [s, s + '%']), c.sugar, (v) => (c.sugar = v)) : null,
        o.ice ? group('Ice', S.ICES.map((i) => [i, cap(i)]), c.ice, (v) => (c.ice = v)) : null);
    }
    function group(title, opts, cur, set) {
      return h('div', { class: 'grp' }, h('div', { class: 'lbl' }, title),
        h('div', { class: 'opts' }, opts.map(([val, text, dis]) => h('button', {
          class: 'opt' + (cur === val ? ' on' : '') + (dis ? ' dis' : ''),
          onclick: () => { set(val); draw(); } }, text))));
    }
    draw();
    const sheet = h('div', { class: 'sheet' },
      h('h3', null, it.name), meta, body,
      h('div', { class: 'acts' },
        h('button', { class: 'btn', onclick: closeSheet }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: () => { state.drink = { id: it.id, choices: { ...c } }; closeSheet(); rerender(); } }, 'Add to my order')));
    sheetEl = h('div', { class: 'scrim-modal', onpointerdown: (e) => { if (e.target === sheetEl) closeSheet(); } }, sheet);
    app.append(sheetEl);
    requestAnimationFrame(() => requestAnimationFrame(() => sheetEl && sheetEl.classList.add('in')));
  }

  /* -------------------------------------------------------------- review */
  function review() {
    const d = state.drink && item(state.drink.id);
    const s = state.snack && item(state.snack.id);
    if (!d && !s) {
      later(toIdle, 9000);
      return h('div', { class: 'confirm' },
        h('h1', { class: 'fade-up' }, 'Of course.'),
        h('p', { class: 'eta' }, 'If you change your mind, simply let us know.'),
        h('div', { class: 'acts' },
          h('button', { class: 'btn', onclick: () => go('drinks') }, 'Actually, yes please'),
          h('button', { class: 'btn', onclick: () => openWork('review') }, 'Our work')));
    }
    const dEff = d ? S.effective(d, state.drink.choices) : null;
    const total = (dEff ? dEff.kcal : 0) + (s ? s.kcal : 0);
    const dLine = d && h('div', { class: 'line-card' },
      h('div', null, h('div', { class: 'k' }, 'Drink'), h('div', { class: 'v' }, d.name),
        h('div', { class: 's' }, [S.describeChoices(d, state.drink.choices), dEff.allergens.length ? 'Contains ' + dEff.allergens.map(label).join(', ') : ''].filter(Boolean).join(' — '))),
      h('button', { class: 'btn small', onclick: () => (needsSheet(d) ? (go('drinks'), later(() => openSheet(d), 900)) : go('drinks')) }, 'Change'));
    const sLine = s && h('div', { class: 'line-card' },
      h('div', null, h('div', { class: 'k' }, 'Snack'), h('div', { class: 'v' }, s.name),
        h('div', { class: 's' }, s.allergens.length ? 'Contains ' + s.allergens.map(label).join(', ') : 'No listed allergens')),
      h('button', { class: 'btn small', onclick: () => go('snacks') }, 'Change'));
    return h('div', null,
      header('review'),
      h('div', { class: 'center' },
        h('div', { class: 'fade-up' },
          h('div', { class: 'eyebrow' }, 'Your selection'),
          h('h2', { class: 'serif', style: { fontSize: 'clamp(2.4rem,4.6vw,3.8rem)', lineHeight: 1.05, marginTop: '.3rem' } }, guestName() ? `Is this right, ${guestName()}?` : 'Is this right?')),
        h('div', { class: 'lines fade-up' }, dLine || h('div', { class: 'line-card' }, h('div', null, h('div', { class: 'k' }, 'Drink'), h('div', { class: 'none' }, 'No drink'))),
          sLine || h('div', { class: 'line-card' }, h('div', null, h('div', { class: 'k' }, 'Snack'), h('div', { class: 'none' }, 'No snack')))),
        state.filterOn && state.avoid.length ? h('p', { class: 'sub', style: { marginTop: '1rem', color: 'var(--muted)' } }, 'Noted — you’d like to avoid: ' + state.avoid.map((a) => label(a).toLowerCase()).join(', ') + '.') : null,
        h('p', { class: 'sub', style: { marginTop: '.8rem', color: 'var(--muted)' } }, `About ${total} kcal in total.`)),
      h('div', { class: 'foot' },
        h('button', { class: 'btn', onclick: () => go('snacks') }, 'Back'),
        h('div', { class: 'mid' }, h('div', { class: 'steps' }, [0, 1, 2].map(() => h('span', { class: 'on' })))),
        h('button', { class: 'btn primary', onclick: place }, 'Yes, that’s perfect')));
  }

  async function place() {
    if (placing) return;
    placing = true;
    const snap = { d: state.drink && item(state.drink.id), s: state.snack && item(state.snack.id), dc: state.drink && { ...state.drink.choices } };
    try {
      const r = await api('POST', '/api/orders', {
        drink: state.drink, snack: state.snack, avoid: state.filterOn ? state.avoid : [],
      });
      state.confirm = { name: r.name, wait: r.wait, d: snap.d, s: snap.s, dc: snap.dc };
      go('confirm');
    } catch (e) {
      toast(e.message || 'Sorry — something went wrong. Please try once more.');
      await loadContent();
      revalidate();
      if (state.screen === 'review') go(state.drink || state.snack ? 'review' : 'drinks', { instant: true });
    } finally { placing = false; }
  }

  function toast(msg) {
    const t = h('div', { class: 'toast' }, msg);
    app.append(t);
    setTimeout(() => t.remove(), 5000);
  }

  /* ------------------------------------------------------------ confirmation */
  function confirmScreen() {
    const c = state.confirm || { name: guestName() || 'Guest', wait: 5 };
    const secs = settings().confirmSeconds || 20;
    const bar = h('div', { class: 'countdown' });
    bar.style.animationDuration = secs + 's';
    requestAnimationFrame(() => bar.classList.add('run'));
    later(toIdle, secs * 1000);
    const parts = [c.d && c.d.name, c.s && c.s.name].filter(Boolean).join(' and ');
    return h('div', { class: 'confirm' },
      h('div', { class: 'corner' }, logo()),
      h('h1', { class: 'fade-up' }, c.name === 'Guest' ? 'Your order is on its way.' : `Your order is on its way, ${c.name}.`),
      h('p', { class: 'eta fade-up' }, 'It should be with you in about ', h('b', null, `${c.wait} minute${c.wait === 1 ? '' : 's'}`), '.'),
      parts && h('p', { class: 'sum fade-up' }, parts),
      h('div', { class: 'acts fade-up' },
        h('button', { class: 'btn', onclick: () => openWork('idle') }, 'Browse our work'),
        h('button', { class: 'btn quiet', onclick: () => openNews('idle') }, 'Latest from the studio')),
      bar);
  }

  /* ----------------------------------------------------------- gallery / news */
  function openWork(from) { state.returnTo = from === 'confirm' ? 'idle' : from; go('work'); }
  function openNews(from) { state.returnTo = from === 'confirm' ? 'idle' : from; go('news'); }
  const back = () => go(state.returnTo && SCREENS[state.returnTo] ? state.returnTo : 'welcome');

  function work() {
    const projects = state.content.portfolio;
    const reel = h('div', { class: 'reel' }, projects.map((p, i) => h('div', { class: 'pane' }, photo(p, i))));
    const title = h('h2'), meta = h('p');
    const count = h('div', { class: 'count' });
    const caption = h('div', { class: 'caption' }, title, meta);
    const paint = () => {
      const i = Math.max(0, Math.min(projects.length - 1, Math.round(reel.scrollLeft / (reel.clientWidth || 1))));
      const p = projects[i]; if (!p) return;
      title.textContent = p.title; meta.textContent = `${p.location} · ${p.type}`; count.textContent = `${i + 1} / ${projects.length}`;
    };
    reel.addEventListener('scroll', paint, { passive: true });
    const nudge = (d) => reel.scrollBy({ left: d * reel.clientWidth, behavior: 'smooth' });
    setTimeout(paint, 0);
    return h('div', { class: 'work' }, reel, h('div', { class: 'scrim' }),
      h('button', { class: 'btn back', onclick: back }, '← Back'), count, caption,
      projects.length > 1 ? [h('button', { class: 'arrow l', 'aria-label': 'Previous', onclick: () => nudge(-1) }, '‹'), h('button', { class: 'arrow r', 'aria-label': 'Next', onclick: () => nudge(1) }, '›')] : null);
  }

  function newsScreen() {
    const fmt = (d) => { const t = new Date(d + 'T12:00:00'); return isNaN(t) ? d : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };
    return h('div', null, header('news'),
      h('div', { class: 'head' }, h('div', { class: 'fade-up' }, h('div', { class: 'eyebrow' }, 'Studio news & updates'), h('h2', null, 'Latest from the studio'))),
      h('div', { class: 'news-list' }, state.content.news.map((n) => h('div', { class: 'news-card fade-up' }, h('div', { class: 'd' }, fmt(n.date)), h('h3', null, n.title), h('p', null, n.body)))),
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: back }, '← Back'), h('div', { class: 'mid' }), h('span')));
  }

  const SCREENS = {
    idle, welcome, drinks: () => menuScreen('drink'), snacks: () => menuScreen('snack'),
    review, confirm: confirmScreen, work, news: newsScreen,
  };

  /* ----------------------------------------------------------------- data */
  async function loadContent() {
    try { state.content = await api('GET', '/api/public'); } catch { /* keep what we have */ }
  }

  function onSession(s) {
    if (s) {
      // Reception handed over: start the welcome flow with this name, whatever the iPad was doing.
      const fresh = !state.session || state.session.id !== s.id;
      state.session = s;
      if (fresh && !placing) { resetChoices(); go('welcome'); }
    } else {
      state.session = null;
      if (!placing && ['welcome', 'drinks', 'snacks', 'review'].includes(state.screen)) toIdle();
    }
  }

  /* ---------------------------------------------------------------- inactivity */
  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => addEventListener(ev, () => { state.lastTouch = Date.now(); }, { passive: true }));
  setInterval(() => {
    if (!state.content || state.screen === 'idle' || state.screen === 'confirm' || placing) return;
    if (Date.now() - state.lastTouch > (settings().inactivitySeconds || 90) * 1000) toIdle();
  }, 1000);

  // Kiosk hygiene: no pinch-zoom, no context menu, no accidental text selection.
  ['gesturestart', 'gesturechange', 'contextmenu', 'selectstart'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));

  /* ---------------------------------------------------------------- boot */
  (async () => {
    await loadContent();
    while (!state.content) { await new Promise((r) => setTimeout(r, 2000)); await loadContent(); }
    go('idle', { instant: true });
    keepAwake();
    let offTimer;
    const conn = $('#conn');
    connectStream('guest', {
      status(ok) {
        clearTimeout(offTimer);
        if (ok) conn.classList.remove('show'); else offTimer = setTimeout(() => conn.classList.add('show'), 3000);
      },
      async hello(d) {
        if (d.version !== (state.content && state.content.version)) { await loadContent(); if (state.screen && state.screen !== 'idle') rerender(); }
        if (d.session) onSession(d.session);
      },
      session: onSession,
      async content() {
        await loadContent();
        revalidate();
        if (state.screen === 'idle') go('idle', { instant: true });
        else if (['drinks', 'snacks', 'review', 'news'].includes(state.screen) && !sheetEl) rerender();
      },
    });
  })();
})();
