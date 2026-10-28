/* =====================================================================
 * views/diet.js — 饮食管理模块（饮食记录 + 食物红绿灯系统）
 * ===================================================================== */
(function (global) {
  'use strict';

  const Store = global.Store, Utils = global.Utils, Data = global.Data;

  const MEALS = [
    { key: 'breakfast', label: '早餐', svg: 'i-sun' },
    { key: 'lunch', label: '午餐', svg: 'i-flame' },
    { key: 'dinner', label: '晚餐', svg: 'i-moon' },
    { key: 'snack', label: '加餐', svg: 'i-leaf' }
  ];
  const CATS = Data.FOOD_CATEGORIES;
  const LIGHT_LABEL = { green: '绿灯·放心吃', yellow: '黄灯·限量吃', red: '红灯·要避免' };
  const LIGHT_BADGE = { green: 'badge-green', yellow: 'badge-yellow', red: 'badge-red' };

  function diets() { return Store.get('diets', []); }
  function saveDiets(list) { Store.set('diets', list); }
  function customFoods() { return Store.get('customFoods', []); }
  function saveCustomFoods(list) { Store.set('customFoods', list); }

  function allFoods() {
    const custom = customFoods().map((f) => ({
      n: f.name, cat: 'custom', kcal: f.kcal, p: f.p, c: f.c, f: f.f, fb: 0, gi: 0, s: 100, sn: '100g', custom: true, id: f.id
    }));
    return Data.FOODS.concat(custom);
  }

  function findFood(id) {
    if (id && id.indexOf('cf-') === 0) {
      const f = customFoods().find((x) => x.id === id);
      return f ? { n: f.name, cat: 'custom', kcal: f.kcal, p: f.p, c: f.c, f: f.f, fb: 0, gi: 0, s: 100, sn: '100g', custom: true, id: f.id } : null;
    }
    return Data.FOODS.find((f) => f.n === id);
  }

  function mealLabel(key) { const m = MEALS.find((m) => m.key === key); return m ? m.label : key; }

  /* 按餐分组 */
  function groupByMeal(date) {
    const g = { breakfast: [], lunch: [], dinner: [], snack: [] };
    diets().forEach((d) => {
      if (d.date === date) (g[d.meal] = g[d.meal] || []).push(d);
    });
    return g;
  }

  function intake(item) {
    const k = item.amount / 100;
    return {
      kcal: Utils.round(item.kcal * k, 0),
      p: Utils.round(item.protein * k, 1),
      c: Utils.round(item.carb * k, 1),
      f: Utils.round(item.fat * k, 1)
    };
  }

  function dayTotals(date) {
    const t = { kcal: 0, p: 0, c: 0, f: 0, count: 0 };
    diets().forEach((d) => {
      if (d.date === date) {
        const it = intake(d);
        t.kcal += it.kcal; t.p += it.p; t.c += it.c; t.f += it.f; t.count++;
      }
    });
    t.kcal = Utils.round(t.kcal, 0); t.p = Utils.round(t.p, 1); t.c = Utils.round(t.c, 1); t.f = Utils.round(t.f, 1);
    return t;
  }

  /* ---------- 饮食记录视图 ---------- */
  function recordHTML() {
    const date = App.state.dietDate || Utils.todayStr();
    const meal = App.state.dietMeal || 'breakfast';
    const group = groupByMeal(date);
    const totals = dayTotals(date);
    const R = Data.getReference(Store.get('user').userMode);
    const settings = Store.get('settings');
    const calorieTarget = (settings.healthGoals && settings.healthGoals.calorieTarget) || R.calorie.target;

    const mealTabs = MEALS.map((m) =>
      '<button data-meal="' + m.key + '" class="' + (meal === m.key ? 'active' : '') + '">' +
      '<svg class="ico ico-sm meal-ico"><use href="#' + m.svg + '"/></svg>' +
      '<span class="meal-name">' + m.label + '</span></button>'
    ).join('');

    const mealItems = (group[meal] || []).map((d) => {
      const it = intake(d);
      return '<div class="list-item"><div class="li-ico"><svg class="ico ico-sm"><use href="#i-salad"/></svg></div>' +
        '<div class="grow"><div class="li-title">' + Utils.esc(d.name) + '</div>' +
        '<div class="li-sub">' + d.amount + 'g · ' + it.kcal + '千卡</div></div>' +
        '<button class="icon-btn" data-del-diet="' + d.id + '" aria-label="删除"><svg class="ico ico-sm"><use href="#i-trash"/></svg></button></div>';
    }).join('');

    const mealKcal = (group[meal] || []).reduce((s, d) => s + intake(d).kcal, 0);

    // 三大营养素供能占比
    const carbCal = totals.c * 4, proCal = totals.p * 4, fatCal = totals.f * 9;
    const totalCal = carbCal + proCal + fatCal || 1;
    const pct = (v) => Math.round((v / totalCal) * 100);

    return [
      '<div class="date-bar">',
      '  <button class="icon-btn" id="diet-prev"><svg class="ico ico-sm"><use href="#i-chevron-left"/></svg></button>',
      '  <div class="grow center"><input class="input center" id="diet-date" type="date" value="' + date + '" style="max-width:180px;margin:0 auto"></div>',
      '  <button class="icon-btn" id="diet-next"><svg class="ico ico-sm"><use href="#i-chevron-right"/></svg></button>',
      '</div>',

      '<div class="meal-tabs">' + mealTabs + '</div>',

      '<div class="card">',
      '  <div class="card-title"><svg class="ico"><use href="#i-salad"/></svg>' + mealLabel(meal) + ' <span class="badge badge-gray">' + mealKcal + ' 千卡</span></div>',
      '  <div class="row mb12">',
      '    <input class="input grow" id="food-search" placeholder="搜索食物（如：鸡蛋、米饭、西兰花）">',
      '    <button class="btn btn-soft" id="food-custom">＋自定义</button>',
      '  </div>',
      '  <div id="food-results" class="scroll-x" style="max-height:260px;overflow-y:auto"></div>',
      '  <div class="divider"></div>',
      mealItems || '<div class="empty-state"><img src="img/empty-note.jpg" alt="" class="es-img" onerror="this.style.display=\'none\'"><p>这一餐还没有记录<br>搜索并添加食物</p></div>',
      '</div>',

      '<div class="card">',
      '  <div class="card-title">今日营养汇总 <span class="muted small">' + (date === Utils.todayStr() ? '今天' : Utils.fmtDateCN(date)) + '</span></div>',
      '  <div class="row between mb8"><span class="stat-label">总热量</span><span class="bold num">' + totals.kcal + ' / ' + calorieTarget + ' 千卡</span></div>',
      '  <div class="progress mb12"><span style="width:' + Math.min(100, totals.kcal / calorieTarget * 100) + '%"></span></div>',
      '  <div class="macro-bar mb12">',
      '    <span style="width:' + pct(totals.c) + '%;background:#f59e0b"></span>',
      '    <span style="width:' + pct(totals.p) + '%;background:#10b981"></span>',
      '    <span style="width:' + pct(totals.f) + '%;background:#3b82f6"></span>',
      '  </div>',
      '  <div class="row wrap small muted">',
      '    <span class="row" style="gap:4px"><span class="tl-dot" style="width:8px;height:8px;background:#f59e0b"></span>碳水 ' + totals.c + 'g（' + pct(totals.c) + '%）</span>',
      '    <span class="row" style="gap:4px;margin:0 10px"><span class="tl-dot" style="width:8px;height:8px;background:#10b981"></span>蛋白 ' + totals.p + 'g（' + pct(totals.p) + '%）</span>',
      '    <span class="row" style="gap:4px"><span class="tl-dot" style="width:8px;height:8px;background:#3b82f6"></span>脂肪 ' + totals.f + 'g（' + pct(totals.f) + '%）</span>',
      '  </div>',
      '  <div class="mt8 small muted">建议供能比：碳水 ' + R.macro.carbPct[0] + '~' + R.macro.carbPct[1] + '% / 蛋白 ' + R.macro.proteinPct[0] + '~' + R.macro.proteinPct[1] + '% / 脂肪 ' + R.macro.fatPct[0] + '~' + R.macro.fatPct[1] + '%</div>',
      '</div>'
    ].join('');
  }

  /* ---------- 红绿灯视图 ---------- */
  function lightHTML() {
    const strict = Store.get('settings').classifyStrict;
    const catFilter = App.state.lightCat || 'all';
    const lightFilter = App.state.lightFilter || 'all';

    const catChips = [['all', '全部']].concat(Object.keys(CATS).map((k) => [k, CATS[k]])).map((c) =>
      '<button class="chip' + (catFilter === c[0] ? ' active' : '') + '" data-light-cat="' + c[0] + '">' + c[1] + '</button>'
    ).join('');

    const rows = allFoods().filter((f) => catFilter === 'all' || f.cat === catFilter).map((f) => {
      const cls = Data.classifyFood(f, strict);
      if (lightFilter !== 'all' && cls.light !== lightFilter) return '';
      const gi = f.gi ? ('GI ' + f.gi) : 'GI —';
      return '<div class="list-item">' +
        '<span class="tl-dot tl-' + cls.light + '"></span>' +
        '<div class="grow"><div class="row"><span class="li-title">' + Utils.esc(f.n) + '</span>' +
        '<span class="badge ' + LIGHT_BADGE[cls.light] + '" style="margin-left:6px">' + (cls.light === 'green' ? '绿' : cls.light === 'yellow' ? '黄' : '红') + '</span></div>' +
        '<div class="li-sub">' + (CATS[f.cat] || '自定义') + ' · ' + f.kcal + '千卡 · ' + gi + ' · 碳水' + f.c + 'g</div>' +
        '<div class="li-sub muted" style="font-size:11px">' + Utils.esc(cls.reason) + '</div></div>' +
        '<button class="btn btn-sm btn-soft" data-add-light="' + Utils.esc(f.n) + '" data-custom="' + (f.custom ? 1 : 0) + '">＋</button>' +
        '</div>';
    }).join('');

    return [
      '<div class="card">',
      '  <div class="card-title">红绿灯说明</div>',
      '  <div class="row mb8"><span class="tl-dot tl-green"></span><div class="grow"><div class="bold">绿灯 · 放心吃</div><div class="small muted">低GI、高纤维、几乎不升糖（蔬菜、优质蛋白、全谷物、低糖水果）</div></div></div>',
      '  <div class="row mb8"><span class="tl-dot tl-yellow"></span><div class="grow"><div class="bold">黄灯 · 限量吃</div><div class="small muted">中GI或糖分偏高，控制份量、搭配蔬菜蛋白（部分水果、薯类、全麦制品）</div></div></div>',
      '  <div class="row"><span class="tl-dot tl-red"></span><div class="grow"><div class="bold">红灯 · 要避免</div><div class="small muted">高GI或精制糖，升糖快（白粥、精白主食、果汁、甜点、高糖水果）</div></div></div>',
      '  <div class="mt12 row between" style="background:var(--surface-2);border-radius:12px;padding:10px 12px">',
      '    <div class="grow"><div class="bold small">严格控糖模式</div><div class="small muted">收紧GI阈值，更严格筛选</div></div>',
      '    <label class="switch"><input type="checkbox" id="light-strict" ' + (strict ? 'checked' : '') + '><span></span></label>',
      '  </div>',
      '</div>',

      '<div class="card">',
      '  <div class="card-title">食材库</div>',
      '  <div class="chips mb12">' + catChips + '</div>',
      '  <div class="chips mb12">',
      '    <button class="chip' + (lightFilter === 'all' ? ' active' : '') + '" data-light="all">全部</button>',
      '    <button class="chip' + (lightFilter === 'green' ? ' active' : '') + '" data-light="green"><span class="tl-dot tl-green" style="width:10px;height:10px"></span>绿灯</button>',
      '    <button class="chip' + (lightFilter === 'yellow' ? ' active' : '') + '" data-light="yellow"><span class="tl-dot tl-yellow" style="width:10px;height:10px"></span>黄灯</button>',
      '    <button class="chip' + (lightFilter === 'red' ? ' active' : '') + '" data-light="red"><span class="tl-dot tl-red" style="width:10px;height:10px"></span>红灯</button>',
      '  </div>',
      '  <div class="scroll-x" style="max-height:420px;overflow-y:auto">',
      rows || '<div class="empty-state"><p>该分类下暂无食材</p></div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  /* ---------- 搜索结果 ---------- */
  function searchHTML(keyword) {
    const kw = (keyword || '').trim().toLowerCase();
    const strict = Store.get('settings').classifyStrict;
    let list = allFoods();
    if (kw) list = list.filter((f) => f.n.toLowerCase().indexOf(kw) >= 0 || (CATS[f.cat] || '').indexOf(keyword) >= 0);
    else list = list.slice(0, 20);
    list = list.slice(0, 30);

    if (!list.length) return '<div class="empty-state"><p>未找到相关食物，可点「自定义」添加</p></div>';

    return list.map((f) => {
      const cls = Data.classifyFood(f, strict);
      return '<div class="list-item">' +
        '<span class="tl-dot tl-' + cls.light + '"></span>' +
        '<div class="grow"><div class="li-title">' + Utils.esc(f.n) + '</div>' +
        '<div class="li-sub">' + f.kcal + '千卡/100g · 蛋白' + f.p + 'g · 碳水' + f.c + 'g · 脂肪' + f.f + 'g</div></div>' +
        '<button class="btn btn-sm btn-primary" data-add-food="' + Utils.esc(f.n) + '" data-custom="' + (f.custom ? 1 : 0) + '">添加</button>' +
        '</div>';
    }).join('');
  }

  /* ---------- 数量输入弹窗 ---------- */
  function openAmount(food) {
    const per = { kcal: food.kcal, p: food.p, c: food.c, f: food.f };
    const html = [
      '<div class="modal-title">' + Utils.esc(food.n) + '<button class="icon-btn modal-close" data-close><svg class="ico ico-sm"><use href="#i-x"/></svg></button></div>',
      '<div class="row mb12"><div class="grow"><div class="label">摄入量（克）</div>',
      '<input class="input input-lg" id="amt-input" type="number" inputmode="decimal" value="' + (food.s || 100) + '"></div></div>',
      '<div class="chips mb12">',
      '<button class="chip" data-amt="' + (food.s || 100) + '">' + Utils.esc(food.sn || '1份') + '（' + (food.s || 100) + 'g）</button>',
      '<button class="chip" data-amt="50">50g</button><button class="chip" data-amt="100">100g</button><button class="chip" data-amt="150">150g</button>',
      '</div>',
      '<div id="amt-preview" class="small muted"></div>',
      '<div class="modal-actions"><button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" id="amt-ok">确认添加</button></div>'
    ].join('');
    App.modal(html, (root) => {
      const input = root.querySelector('#amt-input');
      const preview = root.querySelector('#amt-preview');
      const upd = () => {
        const g = parseFloat(input.value) || 0;
        preview.textContent = '约 ' + Utils.round(per.kcal * g / 100, 0) + ' 千卡 · 蛋白 ' + Utils.round(per.p * g / 100, 1) + 'g · 碳水 ' + Utils.round(per.c * g / 100, 1) + 'g · 脂肪 ' + Utils.round(per.f * g / 100, 1) + 'g';
      };
      input.addEventListener('input', upd); upd();
      root.querySelectorAll('[data-amt]').forEach((c) => c.addEventListener('click', () => { input.value = c.dataset.amt; upd(); }));
      root.querySelector('#amt-ok').addEventListener('click', () => {
        const g = parseFloat(input.value) || 0;
        if (g <= 0) { Utils.toast('请输入摄入量', 'error'); return; }
        const rec = {
          id: Utils.uid(), date: App.state.dietDate || Utils.todayStr(), meal: App.state.dietMeal || 'breakfast',
          foodId: food.id || food.n, name: food.n, amount: g,
          kcal: per.kcal, protein: per.p, carb: per.c, fat: per.f
        };
        const list = diets(); list.push(rec); saveDiets(list);
        App.closeModal(); Utils.toast('已添加到' + mealLabel(rec.meal), 'success'); App.reload();
      });
    });
  }

  function openCustomFood() {
    const html = [
      '<div class="modal-title">自定义食物<button class="icon-btn modal-close" data-close><svg class="ico ico-sm"><use href="#i-x"/></svg></button></div>',
      '<div class="field"><label class="label">食物名称</label><input class="input" id="cf-name" placeholder="如：自制杂粮饼"></div>',
      '<div class="row"><div class="field grow"><label class="label">热量(kcal/100g)</label><input class="input" id="cf-kcal" type="number" inputmode="decimal"></div>',
      '<div class="field grow"><label class="label">蛋白质(g)</label><input class="input" id="cf-p" type="number" inputmode="decimal"></div></div>',
      '<div class="row"><div class="field grow"><label class="label">碳水(g)</label><input class="input" id="cf-c" type="number" inputmode="decimal"></div>',
      '<div class="field grow"><label class="label">脂肪(g)</label><input class="input" id="cf-f" type="number" inputmode="decimal"></div></div>',
      '<div class="modal-actions"><button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" id="cf-ok">保存</button></div>'
    ].join('');
    App.modal(html, (root) => {
      root.querySelector('#cf-ok').addEventListener('click', () => {
        const name = root.querySelector('#cf-name').value.trim();
        const kcal = parseFloat(root.querySelector('#cf-kcal').value);
        if (!name || isNaN(kcal)) { Utils.toast('请填写名称与热量', 'error'); return; }
        const f = {
          id: 'cf-' + Utils.uid(), name: name, kcal: kcal,
          p: parseFloat(root.querySelector('#cf-p').value) || 0,
          c: parseFloat(root.querySelector('#cf-c').value) || 0,
          f: parseFloat(root.querySelector('#cf-f').value) || 0
        };
        const list = customFoods(); list.push(f); saveCustomFoods(list);
        App.closeModal(); Utils.toast('自定义食物已保存', 'success'); App.reload();
      });
    });
  }

  /* ---------- 视图入口 ---------- */
  const DietView = {
    render() {
      const tab = App.state.dietTab || 'record';
      return [
        '<div class="seg mb16" id="diet-seg">',
        '  <button data-tab="record" class="' + (tab === 'record' ? 'active' : '') + '">饮食记录</button>',
        '  <button data-tab="light" class="' + (tab === 'light' ? 'active' : '') + '">红绿灯</button>',
        '</div>',
        '<div id="diet-panel">' + (tab === 'record' ? recordHTML() : lightHTML()) + '</div>'
      ].join('');
    },

    mount(container) {
      const tab = App.state.dietTab || 'record';
      const seg = container.querySelector('#diet-seg');
      seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        App.state.dietTab = b.dataset.tab; App.reload();
      }));

      if (tab === 'record') this.mountRecord(container);
      else this.mountLight(container);
    },

    mountRecord(container) {
      const search = container.querySelector('#food-search');
      const results = container.querySelector('#food-results');
      results.innerHTML = searchHTML(search.value);

      search.addEventListener('input', () => { results.innerHTML = searchHTML(search.value); });
      search.addEventListener('focus', () => { if (!search.value) results.innerHTML = searchHTML(''); });

      container.querySelector('#diet-prev').addEventListener('click', () => {
        const d = Utils.parseDate(App.state.dietDate || Utils.todayStr());
        d.setDate(d.getDate() - 1); App.state.dietDate = Utils.dateStr(d); App.reload();
      });
      container.querySelector('#diet-next').addEventListener('click', () => {
        const d = Utils.parseDate(App.state.dietDate || Utils.todayStr());
        d.setDate(d.getDate() + 1); App.state.dietDate = Utils.dateStr(d); App.reload();
      });
      container.querySelector('#diet-date').addEventListener('change', (e) => { App.state.dietDate = e.target.value; App.reload(); });

      container.querySelectorAll('[data-meal]').forEach((b) => b.addEventListener('click', () => {
        App.state.dietMeal = b.dataset.meal; App.reload();
      }));

      container.querySelector('#food-custom').addEventListener('click', openCustomFood);

      results.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-add-food]');
        if (btn) {
          const name = btn.dataset.addFood;
          const isCustom = btn.dataset.custom === '1';
          let food = null;
          if (isCustom) { const cf = customFoods().find((x) => x.name === name); if (cf) food = findFood(cf.id); }
          else food = findFood(name);
          if (food) openAmount(food);
        }
      });

      container.querySelectorAll('[data-del-diet]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.delDiet;
        App.confirm('删除这条饮食记录？', () => {
          saveDiets(diets().filter((d) => d.id !== id));
          Utils.toast('已删除', 'success'); App.reload();
        });
      }));

      if (App.pendingFocus === 'diet') { search.focus(); }
    },

    mountLight(container) {
      const strictToggle = container.querySelector('#light-strict');
      if (strictToggle) strictToggle.addEventListener('change', () => {
        const s = Store.get('settings'); s.classifyStrict = strictToggle.checked; Store.set('settings', s);
        App.reload();
      });

      container.querySelectorAll('[data-light-cat]').forEach((b) => b.addEventListener('click', () => {
        App.state.lightCat = b.dataset.lightCat; App.reload();
      }));
      container.querySelectorAll('[data-light]').forEach((b) => b.addEventListener('click', () => {
        App.state.lightFilter = b.dataset.light; App.reload();
      }));

      container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-add-light]');
        if (btn) {
          const name = btn.dataset.addLight;
          const isCustom = btn.dataset.custom === '1';
          let food = null;
          if (isCustom) { const cf = customFoods().find((x) => x.name === name); if (cf) food = findFood(cf.id); }
          else food = findFood(name);
          if (food) openAmount(food);
        }
      });
    }
  };

  global.DietView = DietView;
  global.DietView.dayTotals = dayTotals;
})(window);
