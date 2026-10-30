/* Units – a small offline alcohol tracker. No build step, no dependencies. */
(function () {
  'use strict';

  const STORAGE_KEY = 'units-tracker:v1';
  const DAY_MS = 86400000;

  const TYPES = {
    beer:     { label: 'Beer',     icon: '🍺' },
    red_wine: { label: 'Red wine', icon: '🍷' },
    prosecco: { label: 'Prosecco', icon: '🥂' },
    other:    { label: 'Other',    icon: '🍸' },
  };
  const TYPE_ORDER = ['beer', 'red_wine', 'prosecco', 'other'];

  const DEFAULT_PRESETS = [
    { id: 'p-beer-can',  type: 'beer',     name: 'Standard can', size: '440ml', units: 2.0 },
    { id: 'p-beer-pint', type: 'beer',     name: 'Pint can',     size: '568ml', units: 2.6 },
    { id: 'p-wine-175',  type: 'red_wine', name: 'Glass',        size: '175ml', units: 2.4 },
    { id: 'p-pros-125',  type: 'prosecco', name: 'Flute',        size: '125ml', units: 1.4 },
  ];

  const DEFAULT_SETTINGS = { weeklyTarget: 14, cutoffHour: 4, presets: DEFAULT_PRESETS };

  // ---------- State ----------
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return normalise(parsed);
      }
    } catch (e) { console.warn('Could not read saved data', e); }
    return normalise({});
  }
  function normalise(obj) {
    const s = Object.assign({}, DEFAULT_SETTINGS, obj.settings || {});
    if (!Array.isArray(s.presets) || !s.presets.length) s.presets = DEFAULT_PRESETS.map(p => ({ ...p }));
    s.presets = s.presets.map(p => ({
      id: p.id || uid(), type: TYPES[p.type] ? p.type : 'other',
      name: String(p.name || 'Drink'), size: String(p.size || ''), units: num(p.units, 1),
    }));
    s.weeklyTarget = num(s.weeklyTarget, 14);
    s.cutoffHour = Math.min(12, Math.max(0, Math.round(num(s.cutoffHour, 4))));
    const entries = (Array.isArray(obj.entries) ? obj.entries : []).map(e => ({
      id: e.id || uid(), ts: num(e.ts, Date.now()), type: TYPES[e.type] ? e.type : 'other',
      name: String(e.name || 'Drink'), size: String(e.size || ''), units: num(e.units, 0),
    })).filter(e => Number.isFinite(e.ts));
    entries.sort((a, b) => b.ts - a.ts);
    return { version: 1, settings: s, entries };
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save. Storage may be full or blocked.'); }
  }
  function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // ---------- Dates (with day cutoff) ----------
  const cutoff = () => state.settings.cutoffHour;
  function effectiveDate(ts) { return new Date(ts - cutoff() * 3600000); }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function monthKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function startOfWeek(d) { // Monday
    const s = startOfDay(d); const dow = (s.getDay() + 6) % 7; s.setDate(s.getDate() - dow); return s;
  }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
  function todayEff() { return startOfDay(effectiveDate(Date.now())); }
  function round1(n) { return Math.round(n * 10) / 10; }
  function fmtUnits(n) { const r = round1(n); return Number.isInteger(r) ? String(r) : r.toFixed(1); }
  const fmtDayLong = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtDayShort = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtDM = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const fmtMonth = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });
  const fmtMonthShort = new Intl.DateTimeFormat('en-GB', { month: 'short' });
  const fmtTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

  function dayLabel(d) {
    const t = todayEff();
    if (d.getTime() === t.getTime()) return 'Today';
    if (d.getTime() === addDays(t, -1).getTime()) return 'Yesterday';
    return fmtDayLong.format(d);
  }

  // ---------- Entries ----------
  function addEntry(preset, ts) {
    const e = { id: uid(), ts: ts || Date.now(), type: preset.type, name: preset.name, size: preset.size, units: round1(preset.units) };
    state.entries.push(e); state.entries.sort((a, b) => b.ts - a.ts); save();
    return e;
  }
  function removeEntry(id) { state.entries = state.entries.filter(e => e.id !== id); save(); }
  function updateEntry(id, patch) {
    const e = state.entries.find(x => x.id === id); if (!e) return;
    Object.assign(e, patch); state.entries.sort((a, b) => b.ts - a.ts); save();
  }
  function entriesBetween(from, to) { // effective dates, [from, to)
    const f = from.getTime(), t = to.getTime();
    return state.entries.filter(e => { const d = effectiveDate(e.ts).getTime(); return d >= f && d < t; });
  }
  function sumUnits(list) { return list.reduce((a, e) => a + e.units, 0); }
  function byType(list) {
    const out = {}; TYPE_ORDER.forEach(t => out[t] = 0);
    list.forEach(e => out[e.type] = (out[e.type] || 0) + e.units); return out;
  }

  // ---------- DOM helpers ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, ...children) {
    const el = document.createElementNS(svgNS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v != null && v !== false) el.setAttribute(k, v); }
    for (const c of children.flat()) {
      if (c == null) continue;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg, action) {
    const t = $('#toast'); t.innerHTML = ''; t.hidden = false;
    t.appendChild(h('span', null, msg));
    if (action) t.appendChild(h('button', { type: 'button', onclick: () => { hideToast(); action.fn(); } }, action.label));
    clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, action ? 6000 : 3000);
  }
  function hideToast() { const t = $('#toast'); t.hidden = true; t.innerHTML = ''; }

  // ---------- Sheet ----------
  function openSheet(title, body, footer) {
    closeSheet();
    const backdrop = h('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === backdrop) closeSheet(); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { class: 'grabber' }),
        h('div', { class: 'sheet-head' }, h('h2', null, title), h('button', { class: 'btn sm ghost', type: 'button', onclick: closeSheet }, 'Close')),
        body, footer));
    $('#sheet-root').appendChild(backdrop);
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() { $('#sheet-root').innerHTML = ''; document.body.style.overflow = ''; }

  function toLocalInput(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fromLocalInput(v) { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : null; }

  // ---------- Views ----------
  const view = $('#view');
  const routes = { log: renderLog, history: renderHistory, charts: renderCharts, settings: renderSettings };
  let chartState = { period: 'weekly', offset: 0, selected: null, table: false };

  function currentTab() { const hsh = location.hash.replace('#', ''); return routes[hsh] ? hsh : 'log'; }
  function render() {
    const tab = currentTab();
    document.querySelectorAll('.tab').forEach(a => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
    view.innerHTML = '';
    view.appendChild(routes[tab]());
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);

  // --- Log (home) ---
  function renderLog() {
    const today = todayEff();
    const todayEntries = entriesBetween(today, addDays(today, 1));
    const weekStart = startOfWeek(today);
    const weekEntries = entriesBetween(weekStart, addDays(weekStart, 7));
    const todayUnits = sumUnits(todayEntries), weekUnits = sumUnits(weekEntries);
    const target = state.settings.weeklyTarget;
    const frac = target > 0 ? weekUnits / target : 0;
    const sev = frac >= 1 ? 'critical' : frac >= 0.75 ? 'serious' : frac >= 0.5 ? 'warning' : '';
    const sevText = target <= 0 ? '' : frac >= 1 ? 'Over target' : frac >= 0.75 ? 'Close to target' : frac >= 0.5 ? 'Over halfway' : 'Within target';
    const remaining = Math.max(0, target - weekUnits);

    const countsToday = {}; todayEntries.forEach(e => { countsToday[e.name + '|' + e.size] = (countsToday[e.name + '|' + e.size] || 0) + 1; });

    return h('div', { class: 'stack' },
      h('div', { class: 'view-header' }, h('h1', null, 'Units'), h('span', { class: 'muted small' }, fmtDayShort.format(today))),
      h('section', { class: 'card stack' },
        h('div', { class: 'hero' },
          h('div', { class: 'hero-label' }, 'Today'),
          h('div', { class: 'hero-value' }, fmtUnits(todayUnits), h('small', null, 'units')),
          h('div', { class: 'hero-sub' }, todayEntries.length ? `${todayEntries.length} drink${todayEntries.length === 1 ? '' : 's'}` : 'Nothing logged yet')),
        h('div', { class: 'meter', role: 'group', 'aria-label': 'This week against target' },
          h('div', { class: 'meter-head' },
            h('span', null, 'This week ', h('strong', null, fmtUnits(weekUnits)), target > 0 ? ` of ${fmtUnits(target)} units` : ' units'),
            target > 0 ? h('span', { class: 'status-pill' }, h('span', { class: 'dot ' + sev }), sevText) : null),
          target > 0 ? h('div', { class: 'meter-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': target, 'aria-valuenow': round1(weekUnits) },
            h('div', { class: 'meter-fill ' + sev, style: `width:${Math.min(100, frac * 100)}%` })) : null,
          h('div', { class: 'meter-foot' },
            h('span', null, `Week from ${fmtDM.format(weekStart)}`),
            target > 0 ? h('span', null, frac >= 1 ? `${fmtUnits(weekUnits - target)} over` : `${fmtUnits(remaining)} left`) : null))),
      h('section', { class: 'stack' },
        h('div', { class: 'row between' }, h('h2', null, 'Quick add'), h('button', { class: 'btn sm ghost', type: 'button', onclick: openAddSheet }, 'Other time…')),
        h('div', { class: 'quick-grid' },
          state.settings.presets.map(p => {
            const n = countsToday[p.name + '|' + p.size] || 0;
            return h('button', { class: 'quick-btn', type: 'button', style: `--series: var(--s-${p.type})`, 'aria-label': `Add ${p.name} ${p.size}, ${fmtUnits(p.units)} units`, onclick: () => quickAdd(p) },
              h('span', { class: 'q-icon', 'aria-hidden': 'true' }, TYPES[p.type].icon),
              h('span', { class: 'q-units' }, fmtUnits(p.units), ' u'),
              h('span', { class: 'q-name' }, p.name),
              h('span', { class: 'q-meta' }, TYPES[p.type].label, p.size ? ' · ' + p.size : ''),
              n ? h('span', { class: 'q-count' }, `×${n} today`) : null);
          }))),
      todayEntries.length ? h('section', { class: 'stack' },
        h('h2', null, 'Logged today'),
        h('div', { class: 'list' }, todayEntries.map(entryRow))) : null);
  }

  function quickAdd(p) {
    const e = addEntry(p);
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
    render();
    toast(`Added ${p.name} · ${fmtUnits(p.units)} units`, { label: 'Undo', fn: () => { removeEntry(e.id); render(); } });
  }

  function openAddSheet(prefill) {
    const presets = state.settings.presets;
    const presetSel = h('select', { class: 'input', id: 'add-preset' },
      presets.map((p, i) => h('option', { value: p.id, selected: i === 0 }, `${TYPES[p.type].icon} ${p.name} ${p.size} · ${fmtUnits(p.units)} u`)),
      h('option', { value: '__custom' }, 'Custom drink…'));
    const typeSel = h('select', { class: 'input' }, TYPE_ORDER.map(t => h('option', { value: t }, TYPES[t].label)));
    const nameIn = h('input', { class: 'input', type: 'text', placeholder: 'e.g. Bottle of IPA', maxlength: 40 });
    const sizeIn = h('input', { class: 'input', type: 'text', placeholder: 'e.g. 330ml', maxlength: 16 });
    const unitsIn = h('input', { class: 'input', type: 'number', step: '0.1', min: '0', inputmode: 'decimal', value: fmtUnits(presets[0].units) });
    const whenIn = h('input', { class: 'input', type: 'datetime-local', value: toLocalInput(Date.now()) });
    const qtyIn = h('input', { class: 'input', type: 'number', min: '1', max: '20', step: '1', inputmode: 'numeric', value: '1' });
    const customBox = h('div', { class: 'stack', hidden: true },
      h('div', { class: 'field-row' },
        h('div', { class: 'field' }, h('label', null, 'Type'), typeSel),
        h('div', { class: 'field' }, h('label', null, 'Size'), sizeIn)),
      h('div', { class: 'field' }, h('label', null, 'Name'), nameIn));
    presetSel.addEventListener('change', () => {
      const p = presets.find(x => x.id === presetSel.value);
      customBox.hidden = !!p;
      if (p) unitsIn.value = fmtUnits(p.units);
    });
    const body = h('div', { class: 'stack' },
      h('div', { class: 'field' }, h('label', { for: 'add-preset' }, 'Drink'), presetSel),
      customBox,
      h('div', { class: 'field-row' },
        h('div', { class: 'field' }, h('label', null, 'Units each'), unitsIn),
        h('div', { class: 'field' }, h('label', null, 'How many'), qtyIn)),
      h('div', { class: 'field' }, h('label', null, 'When'), whenIn,
        h('span', { class: 'hint' }, `Drinks before ${pad(cutoff())}:00 count towards the previous day.`)));
    const footer = h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary block', type: 'button', onclick: () => {
        const ts = fromLocalInput(whenIn.value); if (ts == null) { toast('Please choose a valid date and time.'); return; }
        const units = num(unitsIn.value, NaN); if (!(units >= 0)) { toast('Please enter the units.'); return; }
        const qty = Math.min(20, Math.max(1, Math.round(num(qtyIn.value, 1))));
        let preset = presets.find(x => x.id === presetSel.value);
        if (!preset) preset = { type: typeSel.value, name: nameIn.value.trim() || TYPES[typeSel.value].label, size: sizeIn.value.trim() };
        const ids = [];
        for (let i = 0; i < qty; i++) ids.push(addEntry({ ...preset, units }, ts + i).id);
        closeSheet(); render();
        toast(`Added ${qty > 1 ? qty + ' × ' : ''}${preset.name} · ${fmtUnits(units * qty)} units`, { label: 'Undo', fn: () => { ids.forEach(removeEntry); render(); } });
      } }, 'Add'));
    openSheet('Log a drink', body, footer);
  }

  function entryRow(e) {
    const d = new Date(e.ts);
    return h('button', { class: 'entry', type: 'button', style: `--series: var(--s-${e.type})`, onclick: () => openEditSheet(e) },
      h('span', { class: 'e-swatch', 'aria-hidden': 'true' }),
      h('span', { class: 'grow' },
        h('div', { class: 'e-name' }, TYPES[e.type].icon + ' ' + e.name),
        h('div', { class: 'e-meta' }, fmtTime.format(d), e.size ? ' · ' + e.size : '', ' · ', TYPES[e.type].label)),
      h('span', { class: 'e-units' }, fmtUnits(e.units), ' u'));
  }

  function openEditSheet(e) {
    const unitsIn = h('input', { class: 'input', type: 'number', step: '0.1', min: '0', inputmode: 'decimal', value: fmtUnits(e.units) });
    const whenIn = h('input', { class: 'input', type: 'datetime-local', value: toLocalInput(e.ts) });
    const nameIn = h('input', { class: 'input', type: 'text', value: e.name, maxlength: 40 });
    const sizeIn = h('input', { class: 'input', type: 'text', value: e.size, maxlength: 16 });
    const typeSel = h('select', { class: 'input' }, TYPE_ORDER.map(t => h('option', { value: t, selected: t === e.type }, TYPES[t].label)));
    const body = h('div', { class: 'stack' },
      h('div', { class: 'field-row' },
        h('div', { class: 'field' }, h('label', null, 'Type'), typeSel),
        h('div', { class: 'field' }, h('label', null, 'Size'), sizeIn)),
      h('div', { class: 'field' }, h('label', null, 'Name'), nameIn),
      h('div', { class: 'field-row' },
        h('div', { class: 'field' }, h('label', null, 'Units'), unitsIn),
        h('div', { class: 'field' }, h('label', null, 'When'), whenIn)));
    const footer = h('div', { class: 'btn-row' },
      h('button', { class: 'btn danger', type: 'button', onclick: () => {
        const snapshot = { ...e }; removeEntry(e.id); closeSheet(); render();
        toast('Drink deleted', { label: 'Undo', fn: () => { state.entries.push(snapshot); state.entries.sort((a, b) => b.ts - a.ts); save(); render(); } });
      } }, 'Delete'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => {
        const ts = fromLocalInput(whenIn.value); if (ts == null) { toast('Please choose a valid date and time.'); return; }
        const units = num(unitsIn.value, NaN); if (!(units >= 0)) { toast('Please enter the units.'); return; }
        updateEntry(e.id, { ts, units: round1(units), name: nameIn.value.trim() || e.name, size: sizeIn.value.trim(), type: typeSel.value });
        closeSheet(); render(); toast('Saved');
      } }, 'Save'));
    openSheet('Edit drink', body, footer);
  }

  // --- History ---
  function renderHistory() {
    const groups = new Map();
    for (const e of state.entries) {
      const k = dayKey(effectiveDate(e.ts));
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    }
    const total = sumUnits(state.entries);
    const out = h('div', { class: 'stack' },
      h('div', { class: 'view-header' }, h('h1', null, 'History'),
        h('span', { class: 'muted small' }, state.entries.length ? `${state.entries.length} drinks · ${fmtUnits(total)} units` : '')));
    if (!state.entries.length) {
      out.appendChild(h('div', { class: 'empty' }, h('div', { class: 'big' }, '🗒️'), h('p', null, 'No drinks logged yet.'), h('p', { class: 'small' }, 'Use Quick add on the Log tab.')));
      return out;
    }
    const list = h('div', { class: 'list' });
    for (const [k, list_] of groups) {
      const d = new Date(k + 'T12:00:00');
      list.appendChild(h('div', { class: 'list-head' }, h('span', null, dayLabel(startOfDay(d))), h('span', { class: 'total' }, fmtUnits(sumUnits(list_)), ' units')));
      list_.forEach(e => list.appendChild(entryRow(e)));
    }
    out.appendChild(list);
    return out;
  }

  // --- Charts ---
  function buildPeriods(period, offset) {
    const today = todayEff();
    const periods = [];
    if (period === 'daily') {
      const end = addDays(today, 1 - offset * 28);
      for (let i = 27; i >= 0; i--) {
        const start = addDays(end, -i - 1);
        periods.push({ start, end: addDays(start, 1), label: fmtDM.format(start), tick: start.getDay() === 1 ? fmtDM.format(start) : '', key: dayKey(start) });
      }
    } else if (period === 'weekly') {
      const thisWeek = startOfWeek(today);
      for (let i = 11; i >= 0; i--) {
        const start = addDays(thisWeek, -7 * (i + offset * 12));
        periods.push({ start, end: addDays(start, 7), label: `w/c ${fmtDM.format(start)}`, tick: (i % 2 === 1) ? fmtDM.format(start) : '', key: dayKey(start) });
      }
    } else {
      const thisMonth = startOfMonth(today);
      for (let i = 11; i >= 0; i--) {
        const start = addMonths(thisMonth, -(i + offset * 12));
        periods.push({ start, end: addMonths(start, 1), label: fmtMonth.format(start), tick: fmtMonthShort.format(start).slice(0, 1), key: monthKey(start) });
      }
    }
    for (const p of periods) {
      const list = entriesBetween(p.start, p.end);
      p.byType = byType(list); p.total = sumUnits(list); p.count = list.length;
      p.future = p.start > today;
    }
    return periods;
  }

  function renderCharts() {
    const { period, offset } = chartState;
    const periods = buildPeriods(period, offset);
    const target = state.settings.weeklyTarget;
    const past = periods.filter(p => !p.future);
    const total = sumUnits(past.map(p => ({ units: p.total })));
    const avg = past.length ? total / past.length : 0;
    const peak = past.reduce((m, p) => Math.max(m, p.total), 0);
    let third;
    if (period === 'daily') {
      const free = past.filter(p => p.total === 0).length;
      third = { label: 'Drink-free days', value: free, unit: `/ ${past.length}` };
    } else if (period === 'weekly') {
      const within = target > 0 ? past.filter(p => p.total <= target).length : 0;
      third = { label: 'Weeks on target', value: within, unit: `/ ${past.length}` };
    } else {
      const totalDrinks = past.reduce((a, p) => a + p.count, 0);
      third = { label: 'Drinks', value: totalDrinks, unit: '' };
    }
    const last = periods[periods.length - 1];
    const rangeText = period === 'monthly'
      ? `${fmtMonth.format(periods[0].start)} – ${fmtMonth.format(last.start)}`
      : `${fmtDM.format(periods[0].start)} – ${fmtDM.format(addDays(last.end, -1))}`;
    const perName = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';

    const seg = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Chart period' },
      ['daily', 'weekly', 'monthly'].map(p => h('button', { type: 'button', 'aria-pressed': String(p === period), onclick: () => { chartState.period = p; chartState.offset = 0; chartState.selected = null; render(); } }, p[0].toUpperCase() + p.slice(1))));

    const chartWrap = h('div', { class: 'chart-wrap' });
    const legend = h('div', { class: 'legend', 'aria-label': 'Legend' },
      TYPE_ORDER.filter(t => t !== 'other' || periods.some(p => p.byType.other > 0)).map(t =>
        h('span', { class: 'key' }, h('span', { class: 'sw', style: `--series: var(--s-${t})` }), TYPES[t].label)));

    const tableWrap = h('details', { open: chartState.table || null, ontoggle: (ev) => { chartState.table = ev.target.open; } },
      h('summary', null, 'Show as table'),
      h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, period === 'daily' ? 'Day' : period === 'weekly' ? 'Week' : 'Month'),
          TYPE_ORDER.filter(t => t !== 'other' || periods.some(p => p.byType.other > 0)).map(t => h('th', null, TYPES[t].label)), h('th', null, 'Total'))),
        h('tbody', null, periods.slice().reverse().filter(p => !p.future).map(p => h('tr', null, h('td', null, p.label),
          TYPE_ORDER.filter(t => t !== 'other' || periods.some(q => q.byType.other > 0)).map(t => h('td', null, p.byType[t] ? fmtUnits(p.byType[t]) : '–')),
          h('td', null, h('strong', null, fmtUnits(p.total))))))));

    const out = h('div', { class: 'stack' },
      h('div', { class: 'view-header' }, h('h1', null, 'Charts')),
      seg,
      h('section', { class: 'card stack' },
        h('div', { class: 'chart-title' },
          h('h2', null, `Units per ${perName}`),
          h('div', { class: 'pager' },
            h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Earlier', onclick: () => { chartState.offset++; chartState.selected = null; render(); } }, '‹'),
            h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Later', disabled: offset === 0, onclick: () => { chartState.offset = Math.max(0, offset - 1); chartState.selected = null; render(); } }, '›'))),
        h('div', { class: 'range small muted' }, rangeText),
        chartWrap, legend,
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('span', { class: 's-label' }, 'Total'), h('span', { class: 's-value' }, fmtUnits(total), h('small', null, 'units'))),
          h('div', { class: 'stat' }, h('span', { class: 's-label' }, `Average / ${perName}`), h('span', { class: 's-value' }, fmtUnits(avg), h('small', null, 'units'))),
          h('div', { class: 'stat' }, h('span', { class: 's-label' }, third.label), h('span', { class: 's-value' }, third.value, h('small', null, third.unit)))),
        period !== 'daily' && target > 0 ? h('p', { class: 'small muted' }, `Dashed line: ${period === 'weekly' ? `weekly target of ${fmtUnits(target)} units` : `monthly equivalent of your ${fmtUnits(target)}-unit weekly target`}.`) : null,
        h('p', { class: 'small muted' }, 'Peak ' + perName + ': ' + fmtUnits(peak) + ' units. Tap a bar for the breakdown.'),
        tableWrap));

    // Draw once mounted so we know the width.
    requestAnimationFrame(() => drawChart(chartWrap, periods, period, target));
    let resizeTimer; window.onresize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (currentTab() === 'charts' && chartWrap.isConnected) drawChart(chartWrap, periods, period, target); }, 120); };
    return out;
  }

  function drawChart(wrap, periods, period, target) {
    wrap.innerHTML = '';
    const W = Math.max(280, wrap.clientWidth || 320), H = 220;
    const m = { top: 18, right: 8, bottom: 26, left: 30 };
    const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
    const n = periods.length;
    const slot = iw / n;
    const barW = Math.min(24, Math.max(6, slot - 4));
    const targetVal = period === 'weekly' ? target : period === 'monthly' ? target * 365.25 / 12 / 7 : 0;
    const maxData = Math.max(...periods.map(p => p.total), targetVal > 0 ? targetVal * 1.05 : 0, 1);
    const yMax = niceMax(maxData);
    const y = v => m.top + ih - (v / yMax) * ih;
    const types = TYPE_ORDER;

    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `Stacked bar chart of alcohol units per ${period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month'}` });
    const axis = s('g', { class: 'axis' });
    const ticks = niceTicks(yMax);
    ticks.forEach(t => {
      axis.appendChild(s('line', { x1: m.left, x2: W - m.right, y1: y(t), y2: y(t), class: t === 0 ? 'baseline' : '' }));
      axis.appendChild(s('text', { x: m.left - 6, y: y(t) + 4, 'text-anchor': 'end' }, String(t)));
    });
    svg.appendChild(axis);

    const bars = s('g');
    periods.forEach((p, i) => {
      const cx = m.left + slot * i + slot / 2;
      const x0 = cx - barW / 2;
      const g = s('g', { class: 'bar-group' + (chartState.selected === p.key ? ' selected' : ''), tabindex: p.future ? null : 0, role: p.future ? null : 'button',
        'aria-label': `${p.label}: ${fmtUnits(p.total)} units` });
      let acc = 0; let drawnSegs = 0;
      const segs = types.filter(t => p.byType[t] > 0);
      segs.forEach((t, si) => {
        const v = p.byType[t];
        const yTop = y(acc + v), yBot = y(acc);
        const isTop = si === segs.length - 1;
        let hgt = yBot - yTop; if (drawnSegs > 0) hgt -= 2; // 2px surface gap between segments
        const yy = isTop ? yTop : yTop;
        const rect = isTop && hgt > 4
          ? s('path', { class: 'seg', d: roundedTop(x0, yy, barW, Math.max(0, hgt), 4), fill: `var(--s-${t})` })
          : s('rect', { class: 'seg', x: x0, y: yy, width: barW, height: Math.max(0, hgt), fill: `var(--s-${t})` });
        g.appendChild(rect); acc += v; drawnSegs++;
      });
      if (p.total === 0 && !p.future) g.appendChild(s('rect', { x: x0, y: y(0) - 2, width: barW, height: 2, fill: 'var(--grid)' }));
      // hit target spans the whole slot
      g.appendChild(s('rect', { class: 'bar-hit', x: m.left + slot * i, y: m.top, width: slot, height: ih }));
      if (!p.future) {
        const show = () => showTooltip(wrap, svg, p, cx, y(p.total), W);
        g.addEventListener('click', (ev) => { ev.stopPropagation(); chartState.selected = chartState.selected === p.key ? null : p.key; svg.querySelectorAll('.bar-group').forEach(b => b.classList.remove('selected')); if (chartState.selected) { g.classList.add('selected'); show(); } else hideTooltip(wrap); });
        g.addEventListener('focus', () => { show(); });
        g.addEventListener('blur', () => { if (chartState.selected !== p.key) hideTooltip(wrap); });
      }
      bars.appendChild(g);
      if (p.tick) axis.appendChild(s('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, p.tick));
    });
    svg.appendChild(bars);

    // Peak label (one direct label, not every bar)
    const past = periods.filter(p => !p.future && p.total > 0);
    if (past.length) {
      const peak = past.reduce((a, b) => (b.total > a.total ? b : a));
      const i = periods.indexOf(peak);
      svg.appendChild(s('text', { class: 'value-label', x: m.left + slot * i + slot / 2, y: y(peak.total) - 5, 'text-anchor': 'middle' }, fmtUnits(peak.total)));
    }

    if (targetVal > 0) {
      svg.appendChild(s('line', { class: 'target-line', x1: m.left, x2: W - m.right, y1: y(targetVal), y2: y(targetVal) }));
      svg.appendChild(s('text', { class: 'target-label', x: W - m.right, y: y(targetVal) - 4, 'text-anchor': 'end' }, 'target ' + fmtUnits(targetVal)));
    }
    svg.addEventListener('click', () => { chartState.selected = null; svg.querySelectorAll('.bar-group').forEach(b => b.classList.remove('selected')); hideTooltip(wrap); });
    wrap.appendChild(svg);
    if (chartState.selected) { const p = periods.find(q => q.key === chartState.selected); if (p) { const i = periods.indexOf(p); showTooltip(wrap, svg, p, m.left + slot * i + slot / 2, y(p.total), W); } }
  }
  function roundedTop(x, y, w, hgt, r) {
    r = Math.min(r, w / 2, hgt);
    return `M${x},${y + hgt} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + hgt} Z`;
  }
  function niceMax(v) {
    if (v <= 5) return 5;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / pow;
    const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nf * pow;
  }
  function niceTicks(max) {
    const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : max <= 100 ? 20 : max / 5;
    const out = []; for (let t = 0; t <= max + 1e-9; t += step) out.push(round1(t)); return out;
  }
  function showTooltip(wrap, svg, p, cx, cy, W) {
    hideTooltip(wrap);
    const tip = h('div', { class: 'tooltip' },
      h('div', { class: 't-title' }, p.label),
      TYPE_ORDER.filter(t => p.byType[t] > 0).map(t => h('div', { class: 't-row' }, h('span', null, TYPES[t].label), h('span', null, fmtUnits(p.byType[t])))),
      h('div', { class: 't-row total' }, h('span', null, `${p.count} drink${p.count === 1 ? '' : 's'}`), h('span', null, fmtUnits(p.total), ' units')));
    wrap.appendChild(tip);
    const scale = wrap.clientWidth / W;
    const tw = tip.offsetWidth;
    let left = cx * scale - tw / 2; left = Math.max(0, Math.min(wrap.clientWidth - tw, left));
    let top = cy * scale - tip.offsetHeight - 8; if (top < 0) top = cy * scale + 12;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  function hideTooltip(wrap) { wrap.querySelectorAll('.tooltip').forEach(t => t.remove()); }

  // --- Settings ---
  function renderSettings() {
    const st = state.settings;
    const targetIn = h('input', { class: 'input', type: 'number', min: '0', step: '1', inputmode: 'numeric', value: st.weeklyTarget, 'aria-label': 'Weekly target in units',
      onchange: (e) => { st.weeklyTarget = Math.max(0, num(e.target.value, 14)); save(); toast('Target saved'); } });
    const cutoffSel = h('select', { class: 'input', 'aria-label': 'Day ends at',
      onchange: (e) => { st.cutoffHour = Number(e.target.value); save(); toast('Day cutoff saved'); } },
      [0, 1, 2, 3, 4, 5, 6].map(hh => h('option', { value: hh, selected: hh === st.cutoffHour }, hh === 0 ? 'Midnight' : `${pad(hh)}:00`)));
    const themeSel = h('select', { class: 'input', 'aria-label': 'Appearance', onchange: (e) => { setTheme(e.target.value); } },
      [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => h('option', { value: v, selected: getTheme() === v }, l)));

    const presetsList = h('div', { class: 'list' },
      st.presets.map((p, i) => h('div', { class: 'preset-row', style: `--series: var(--s-${p.type})` },
        h('span', { class: 'p-swatch' }),
        h('div', null, h('div', { class: 'p-name' }, TYPES[p.type].icon + ' ' + p.name), h('div', { class: 'p-meta' }, `${TYPES[p.type].label}${p.size ? ' · ' + p.size : ''} · ${fmtUnits(p.units)} units`)),
        h('div', { class: 'row', style: 'gap:6px' },
          h('button', { class: 'btn sm', type: 'button', 'aria-label': `Move ${p.name} up`, disabled: i === 0, onclick: () => { const a = st.presets; [a[i - 1], a[i]] = [a[i], a[i - 1]]; save(); render(); } }, '↑'),
          h('button', { class: 'btn sm', type: 'button', onclick: () => openPresetSheet(p) }, 'Edit')))));

    const importInput = h('input', { type: 'file', accept: 'application/json,.json', onchange: (e) => importJSON(e.target.files[0]) });

    return h('div', { class: 'stack' },
      h('div', { class: 'view-header' }, h('h1', null, 'Settings')),
      h('section', { class: 'card' },
        h('div', { class: 'settings-row' }, h('div', null, h('div', { class: 'label' }, 'Weekly target'), h('div', { class: 'sub' }, 'UK guideline is 14 units. 0 hides it.')), targetIn),
        h('div', { class: 'settings-row' }, h('div', null, h('div', { class: 'label' }, 'Day ends at'), h('div', { class: 'sub' }, 'Late drinks count towards the evening before.')), cutoffSel),
        h('div', { class: 'settings-row' }, h('div', null, h('div', { class: 'label' }, 'Appearance')), themeSel)),
      h('section', { class: 'card stack' },
        h('div', { class: 'row between' }, h('h2', null, 'Quick-add drinks'), h('button', { class: 'btn sm', type: 'button', onclick: () => openPresetSheet(null) }, '+ Add')),
        presetsList,
        h('p', { class: 'small muted' }, 'Units = ABV% × ml ÷ 1000. A 440ml can at 4.5% is 2.0 units; a 175ml glass of 13.5% wine is 2.4.')),
      h('section', { class: 'card stack' },
        h('h2', null, 'Your data'),
        h('p', { class: 'small muted' }, `Stored only on this device (${state.entries.length} drinks). Export regularly to keep a backup or move phones.`),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', type: 'button', onclick: exportJSON }, 'Export backup'),
          h('button', { class: 'btn', type: 'button', onclick: exportCSV }, 'Export CSV'),
          h('button', { class: 'btn', type: 'button', onclick: () => importInput.click() }, 'Import backup')),
        importInput,
        h('button', { class: 'btn danger block', type: 'button', onclick: () => {
          if (!state.entries.length) { toast('Nothing to delete.'); return; }
          if (confirm(`Delete all ${state.entries.length} logged drinks? This cannot be undone. Your settings are kept.`)) { state.entries = []; save(); render(); toast('All drinks deleted'); }
        } }, 'Delete all drinks')),
      h('p', { class: 'small muted', style: 'text-align:center' }, 'Units · an offline web app. Add it to your home screen for one-tap access.'));
  }

  function openPresetSheet(p) {
    const isNew = !p;
    const draft = p ? { ...p } : { id: uid(), type: 'beer', name: '', size: '', units: 2 };
    const typeSel = h('select', { class: 'input' }, TYPE_ORDER.map(t => h('option', { value: t, selected: t === draft.type }, TYPES[t].label)));
    const nameIn = h('input', { class: 'input', type: 'text', value: draft.name, placeholder: 'e.g. Bottle', maxlength: 24 });
    const sizeIn = h('input', { class: 'input', type: 'text', value: draft.size, placeholder: 'e.g. 330ml', maxlength: 12, inputmode: 'numeric' });
    const unitsIn = h('input', { class: 'input', type: 'number', step: '0.1', min: '0', inputmode: 'decimal', value: fmtUnits(draft.units) });
    const abvIn = h('input', { class: 'input', type: 'number', step: '0.1', min: '0', max: '100', inputmode: 'decimal', placeholder: '4.5' });
    const mlIn = h('input', { class: 'input', type: 'number', step: '1', min: '0', inputmode: 'numeric', placeholder: '440' });
    const calc = () => {
      const abv = num(abvIn.value, NaN), ml = num(mlIn.value, NaN);
      if (abv > 0 && ml > 0) { unitsIn.value = fmtUnits(abv * ml / 1000); if (!sizeIn.value) sizeIn.value = Math.round(ml) + 'ml'; }
    };
    abvIn.addEventListener('input', calc); mlIn.addEventListener('input', calc);
    sizeIn.addEventListener('input', () => { const mm = sizeIn.value.match(/(\d+)/); if (mm && !mlIn.value) mlIn.placeholder = mm[1]; });
    const body = h('div', { class: 'stack' },
      h('div', { class: 'field-row' },
        h('div', { class: 'field' }, h('label', null, 'Type'), typeSel),
        h('div', { class: 'field' }, h('label', null, 'Size'), sizeIn)),
      h('div', { class: 'field' }, h('label', null, 'Name'), nameIn),
      h('div', { class: 'field' }, h('label', null, 'Units per drink'), unitsIn),
      h('details', null, h('summary', null, 'Work out units from ABV and volume'),
        h('div', { class: 'field-row', style: 'margin-top:10px' },
          h('div', { class: 'field' }, h('label', null, 'ABV %'), abvIn),
          h('div', { class: 'field' }, h('label', null, 'Volume ml'), mlIn)),
        h('p', { class: 'hint', style: 'margin-top:6px' }, 'Units = ABV × ml ÷ 1000')));
    const footer = h('div', { class: 'btn-row' },
      !isNew ? h('button', { class: 'btn danger', type: 'button', onclick: () => {
        if (state.settings.presets.length <= 1) { toast('Keep at least one quick-add drink.'); return; }
        state.settings.presets = state.settings.presets.filter(x => x.id !== p.id); save(); closeSheet(); render(); toast('Removed');
      } }, 'Remove') : null,
      h('button', { class: 'btn primary', type: 'button', onclick: () => {
        const units = num(unitsIn.value, NaN); if (!(units >= 0)) { toast('Please enter the units.'); return; }
        const name = nameIn.value.trim() || TYPES[typeSel.value].label;
        const next = { id: draft.id, type: typeSel.value, name, size: sizeIn.value.trim(), units: round1(units) };
        if (isNew) state.settings.presets.push(next);
        else { const i = state.settings.presets.findIndex(x => x.id === p.id); if (i >= 0) state.settings.presets[i] = next; }
        save(); closeSheet(); render(); toast('Saved');
      } }, 'Save'));
    openSheet(isNew ? 'New quick-add drink' : 'Edit quick-add drink', body, footer);
  }

  // ---------- Theme ----------
  function getTheme() { try { return localStorage.getItem('units-tracker:theme') || 'auto'; } catch (_) { return 'auto'; } }
  function setTheme(v) {
    try { localStorage.setItem('units-tracker:theme', v); } catch (_) {}
    if (v === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
  }
  setTheme(getTheme());

  // ---------- Import / export ----------
  function download(name, text, type) {
    const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function stamp() { const d = new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }
  function exportJSON() { download(`units-backup-${stamp()}.json`, JSON.stringify(state, null, 2), 'application/json'); }
  function exportCSV() {
    const rows = [['date', 'time', 'effective_day', 'type', 'name', 'size', 'units']];
    state.entries.slice().reverse().forEach(e => {
      const d = new Date(e.ts);
      rows.push([dayKey(d), fmtTime.format(d), dayKey(effectiveDate(e.ts)), TYPES[e.type].label, e.name, e.size, fmtUnits(e.units)]);
    });
    const csv = rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v).join(',')).join('\n');
    download(`units-${stamp()}.csv`, csv, 'text/csv');
  }
  function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object') throw new Error('bad');
        const incoming = normalise(data);
        const existing = new Set(state.entries.map(e => e.id));
        const added = incoming.entries.filter(e => !existing.has(e.id));
        const mode = state.entries.length ? (confirm(`Merge ${added.length} new drinks into your existing ${state.entries.length}? Press Cancel to replace everything with the backup instead.`) ? 'merge' : 'replace') : 'replace';
        if (mode === 'merge') { state.entries = state.entries.concat(added); state.entries.sort((a, b) => b.ts - a.ts); }
        else { state = incoming; }
        save(); render(); toast(mode === 'merge' ? `Imported ${added.length} drinks` : `Restored ${state.entries.length} drinks`);
      } catch (e) { toast('That file is not a Units backup.'); }
    };
    reader.readAsText(file);
  }

  // ---------- Service worker ----------
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  // Re-render at midnight-ish / when returning to the app so "Today" stays right.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  render();
})();
