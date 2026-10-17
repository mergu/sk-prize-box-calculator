'use strict';

const STORAGE_KEY = 'skPrizeBoxCalc';
const $ = (sel) => document.querySelector(sel);

let state = load();

// ---------- Data ----------

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function newItem() { return { name: '', value: 0, weight: 1 }; }
function newPool() { return { name: 'New pool', chance: 0, items: [newItem()] }; }
function newBox() { return { id: uid(), name: 'New prize box', cost: 0, pools: [newPool()] }; }

function exampleBox() {
  return cleanBox({
    name: 'Example box',
    cost: 25000,
    pools: [
      { name: 'Rare', chance: 5, items: [
        { name: 'Item A', value: 100000, weight: 1 },
        { name: 'Item B', value: 500000, weight: 1 },
      ] },
      { name: 'Common', chance: 95, items: [
        { name: 'Item C', value: 8000, weight: 3 },
        { name: 'Item D', value: 15000, weight: 1 },
      ] },
    ],
  });
}

// Sanitises a box (from storage, import or duplication) and gives it a fresh id.
function cleanBox(b) {
  b = b || {};
  return {
    id: uid(),
    name: String(b.name ?? 'Untitled box'),
    cost: num(b.cost),
    pools: (Array.isArray(b.pools) ? b.pools : []).map((p) => {
      p = p || {};
      return {
        name: String(p.name ?? ''),
        chance: num(p.chance),
        items: (Array.isArray(p.items) ? p.items : []).map((i) => {
          i = i || {};
          return { name: String(i.name ?? ''), value: num(i.value), weight: num(i.weight) };
        }),
      };
    }),
  };
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.boxes) && data.boxes.length) {
      const boxes = data.boxes.map(cleanBox);
      const idx = Math.max(0, data.boxes.findIndex((b) => b && b.id === data.selected));
      return { boxes, selected: boxes[idx].id };
    }
  } catch (e) { /* fall through to default */ }
  const box = exampleBox();
  return { boxes: [box], selected: box.id };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* storage unavailable; keep working in memory */ }
}

function current() {
  return state.boxes.find((b) => b.id === state.selected) || state.boxes[0];
}

// ---------- Calculations ----------

function calc(box) {
  let ev = 0, totalChance = 0, pAbove = 0;
  const pools = box.pools.map((pool) => {
    const totalWeight = pool.items.reduce((s, i) => s + Math.max(0, i.weight), 0);
    const poolProb = pool.chance / 100;
    let poolEv = 0;
    const items = pool.items.map((item) => {
      const inPool = totalWeight > 0 ? Math.max(0, item.weight) / totalWeight : 0;
      const prob = poolProb * inPool;
      const itemEv = prob * item.value;
      poolEv += itemEv;
      if (item.value > box.cost) pAbove += prob;
      return { inPool, prob, ev: itemEv };
    });
    ev += poolEv;
    totalChance += pool.chance;
    return { totalWeight, ev: poolEv, items };
  });
  const profit = ev - box.cost;
  return {
    ev,
    profit,
    roi: box.cost > 0 ? profit / box.cost : null,
    pAbove,
    totalChance,
    pools,
  };
}

// ---------- Formatting ----------

function fmtCr(n, signed) {
  const digits = Math.abs(n) < 100 && n !== 0 ? 2 : 0;
  const s = n.toLocaleString('en-US', { maximumFractionDigits: digits });
  return (signed && n > 0 ? '+' : '') + s + ' cr';
}

function fmtPct(p, signed) {
  const v = p * 100;
  const digits = Math.abs(v) < 1 && v !== 0 ? 4 : 2;
  const s = v.toLocaleString('en-US', { maximumFractionDigits: digits });
  return (signed && v > 0 ? '+' : '') + s + '%';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function signClass(n) {
  return n > 0 ? 'pos' : n < 0 ? 'neg' : '';
}

// ---------- Rendering ----------

function render() {
  renderSelect();
  renderEditor();
  refresh();
}

function renderSelect() {
  $('#box-select').innerHTML = state.boxes.map((b) =>
    `<option value="${b.id}"${b.id === state.selected ? ' selected' : ''}>${esc(b.name || 'Untitled box')}</option>`
  ).join('');
}

function renderEditor() {
  const box = current();
  $('#editor').innerHTML = `
    <div class="card box-settings">
      <label>Box name <input data-field="name" value="${esc(box.name)}"></label>
      <label>Crown cost (cr) <input data-field="cost" type="number" min="0" step="any" inputmode="decimal" value="${box.cost}"></label>
    </div>
    ${box.pools.map(renderPool).join('')}
    <button class="add" data-action="add-pool">+ Add pool</button>`;
}

function renderPool(pool, p) {
  return `
    <div class="card pool">
      <div class="pool-head">
        <input class="pool-name" data-pool="${p}" data-field="name" value="${esc(pool.name)}" placeholder="Pool name" aria-label="Pool name">
        <label>Drop chance <input data-pool="${p}" data-field="chance" type="number" min="0" max="100" step="any" inputmode="decimal" value="${pool.chance}"> %</label>
        <span class="pool-ev">Pool EV <b id="pool-ev-${p}"></b></span>
        <button class="small danger" data-action="del-pool" data-pool="${p}">Remove pool</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Item</th><th class="num">Value (cr)</th><th class="num">Weight</th>
            <th class="num">In pool</th><th class="num">Drop chance</th><th class="num">EV</th><th></th>
          </tr></thead>
          <tbody>${pool.items.map((item, i) => renderItem(item, p, i)).join('')}</tbody>
        </table>
      </div>
      <button class="add small" data-action="add-item" data-pool="${p}">+ Add item</button>
    </div>`;
}

function renderItem(item, p, i) {
  const attrs = `data-pool="${p}" data-item="${i}"`;
  return `
    <tr id="item-${p}-${i}">
      <td><input class="item-name" ${attrs} data-field="name" value="${esc(item.name)}" placeholder="Item name" aria-label="Item name"></td>
      <td><input ${attrs} data-field="value" type="number" min="0" step="any" inputmode="decimal" value="${item.value}" aria-label="Value in Crowns"></td>
      <td><input ${attrs} data-field="weight" type="number" min="0" step="any" inputmode="decimal" value="${item.weight}" aria-label="Weight"></td>
      <td class="num" data-out="inPool"></td>
      <td class="num" data-out="prob"></td>
      <td class="num" data-out="ev"></td>
      <td><button class="icon" data-action="del-item" ${attrs} title="Remove item" aria-label="Remove item">✕</button></td>
    </tr>`;
}

// Updates calculated values in place so inputs keep focus while typing.
function refresh() {
  const box = current();
  const r = calc(box);

  $('#sum-ev').textContent = fmtCr(r.ev);
  const profit = $('#sum-profit');
  profit.textContent = fmtCr(r.profit, true);
  profit.className = signClass(r.profit);
  const roi = $('#sum-roi');
  roi.textContent = r.roi === null ? '—' : fmtPct(r.roi, true);
  roi.className = r.roi === null ? '' : signClass(r.roi);
  $('#sum-above').textContent = fmtPct(r.pAbove);
  $('#sum-total').textContent = fmtPct(r.totalChance / 100);

  r.pools.forEach((pr, p) => {
    $(`#pool-ev-${p}`).textContent = fmtCr(pr.ev);
    pr.items.forEach((ir, i) => {
      const row = $(`#item-${p}-${i}`);
      row.querySelector('[data-out="inPool"]').textContent = fmtPct(ir.inPool);
      row.querySelector('[data-out="prob"]').textContent = fmtPct(ir.prob);
      row.querySelector('[data-out="ev"]').textContent = fmtCr(ir.ev);
      row.classList.toggle('above', box.pools[p].items[i].value > box.cost);
    });
  });

  const warnings = [];
  if (Math.abs(r.totalChance - 100) > 1e-9) {
    warnings.push(`Pool drop chances total ${fmtPct(r.totalChance / 100)}, not 100%.`);
  }
  box.pools.forEach((pool, p) => {
    if (r.pools[p].totalWeight <= 0) {
      warnings.push(`Pool "${pool.name || 'Untitled'}" has no items with a weight above 0.`);
    }
  });
  if (box.cost <= 0) warnings.push('Set a Crown cost to calculate profit and ROI.');
  $('#warnings').innerHTML = warnings.map((w) => `<li>${esc(w)}</li>`).join('');
}

// ---------- Events ----------

$('#editor').addEventListener('input', (e) => {
  const el = e.target;
  const field = el.dataset.field;
  if (!field) return;
  const box = current();
  let target = box;
  if (el.dataset.pool !== undefined) target = box.pools[el.dataset.pool];
  if (el.dataset.item !== undefined) target = target.items[el.dataset.item];
  target[field] = el.type === 'number' ? num(el.value) : el.value;
  if (target === box && field === 'name') renderSelect();
  save();
  refresh();
});

$('#editor').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const box = current();
  const p = Number(btn.dataset.pool);
  const i = Number(btn.dataset.item);
  let focus = null;

  switch (btn.dataset.action) {
    case 'add-pool':
      box.pools.push(newPool());
      focus = `.pool:nth-of-type(${box.pools.length + 1}) .pool-name`;
      break;
    case 'del-pool':
      if (box.pools[p].items.length &&
          !confirm(`Remove pool "${box.pools[p].name || 'Untitled'}" and its items?`)) return;
      box.pools.splice(p, 1);
      break;
    case 'add-item':
      box.pools[p].items.push(newItem());
      focus = `#item-${p}-${box.pools[p].items.length - 1} .item-name`;
      break;
    case 'del-item':
      box.pools[p].items.splice(i, 1);
      break;
  }
  save();
  render();
  if (focus) $(focus)?.focus();
});

$('#box-select').addEventListener('change', (e) => {
  state.selected = e.target.value;
  save();
  render();
});

function addBox(box) {
  state.boxes.push(box);
  state.selected = box.id;
  save();
  render();
  const name = $('#editor input[data-field="name"]');
  name.focus();
  name.select();
}

$('#new-box').addEventListener('click', () => addBox(newBox()));

$('#dup-box').addEventListener('click', () => {
  const copy = cleanBox(current());
  copy.name += ' (copy)';
  addBox(copy);
});

$('#del-box').addEventListener('click', () => {
  const box = current();
  if (!confirm(`Delete "${box.name || 'Untitled box'}"? This cannot be undone.`)) return;
  const idx = state.boxes.indexOf(box);
  state.boxes.splice(idx, 1);
  if (!state.boxes.length) state.boxes.push(newBox());
  state.selected = state.boxes[Math.min(idx, state.boxes.length - 1)].id;
  save();
  render();
});

$('#export').addEventListener('click', () => {
  const data = { boxes: state.boxes.map(({ id, ...rest }) => rest) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'prize-boxes.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#import').addEventListener('click', () => $('#import-file').click());

$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : Array.isArray(data.boxes) ? data.boxes : [data];
    const boxes = list.map(cleanBox);
    if (!boxes.length) throw new Error('No prize boxes found.');
    state.boxes.push(...boxes);
    state.selected = boxes[0].id;
    save();
    render();
    alert(`Imported ${boxes.length} prize box${boxes.length === 1 ? '' : 'es'}.`);
  } catch (err) {
    alert(`Import failed: ${err.message}`);
  }
});

render();
