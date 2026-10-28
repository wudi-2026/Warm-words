/* =====================================================================
 * views/records.js — 健康数据记录模块（体重 + 血糖）
 * ===================================================================== */
(function (global) {
  'use strict';

  const Store = global.Store, Utils = global.Utils, Charts = global.Charts, Data = global.Data;

  const SCENES = Data.SUGAR_SCENES;

  function sceneOf(key) { return SCENES.find((s) => s.key === key) || SCENES[0]; }
  function sceneLabel(key, customHours) {
    const base = sceneOf(key).label;
    if (key === 'afterMealCustom' && customHours) return '餐后' + customHours + 'h';
    return base;
  }

  /* ---------- 体重 ---------- */
  function weights() { return Store.get('weights', []); }
  function saveWeights(list) { Store.set('weights', list); }

  function sugarRef(scene, customHours) {
    // 统一走 Data.resolveSugar：按场景应用各自的自定义阈值（餐后1h不再误用2h上限）
    return Data.resolveSugar(scene, customHours);
  }

  /* 单个场景的目标文案 */
  function sceneTargetText(scene, customHours) {
    const r = sugarRef(scene, customHours);
    const open = scene === 'afterMeal1h' || scene === 'random';
    return open ? ('目标 <' + r.high + ' mmol/L') : ('目标 ' + r.low + '~' + r.high + ' mmol/L');
  }

  /* 根据当前时间推荐测量场景（相对三餐+加餐时间推算） */
  function recommendScene() {
    const settings = Store.get('settings');
    const mt = settings.mealTimes || Store.DEFAULT_MEAL_TIMES;
    const nowMin = Utils.timeToMin(Utils.timeStr());
    if (nowMin < Utils.timeToMin(mt.breakfast) - 15) return 'fasting'; // 早餐前为空腹
    let lastMin = -1e9, nextMin = 1e9;
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach((k) => {
      const m = Utils.timeToMin(mt[k]);
      if (m <= nowMin && m > lastMin) lastMin = m;
      if (m > nowMin && m < nextMin) nextMin = m;
    });
    const since = nowMin - lastMin;
    if (since < 90) return 'afterMeal1h';
    if (since < 180) return 'afterMeal2h';
    if (since < 240) return 'afterMeal3h';
    if (nextMin - nowMin <= 60) return 'beforeMeal';
    if (nowMin >= Utils.timeToMin('21:30')) return 'bedtime';
    return 'random';
  }

  function weightStatus(latest) {
    const list = weights().slice().sort(Utils.byDateDesc);
    const user = Store.get('user');
    const settings = Store.get('settings');
    const g = settings.healthGoals || {};
    if (list.length < 2) {
      // 单条记录时检查BMI或目标范围
      if (list.length === 1 && user.height && user.userMode !== 'pregnancy') {
        const bmi = list[0].value / Math.pow(Number(user.height) / 100, 2);
        if (bmi >= 28) return { label: '肥胖', cls: 'badge-red' };
        if (bmi >= 24) return { label: '超重', cls: 'badge-yellow' };
        if (bmi < 18.5) return { label: '偏瘦', cls: 'badge-blue' };
      }
      return { label: '正常', cls: 'badge-green' };
    }
    const newest = list[0], prev = list[1];
    const days = (Utils.parseDate(newest.date) - Utils.parseDate(prev.date)) / 86400000;
    if (days <= 0) return { label: '正常', cls: 'badge-green' };
    const weekly = ((newest.value - prev.value) / days) * 7;

    if (user.userMode === 'pregnancy') {
      if (weekly > 0.75) return { label: '增重偏快', cls: 'badge-yellow' };
      if (weekly < 0.5) return { label: '增重偏慢', cls: 'badge-blue' };
      return { label: '增重适宜', cls: 'badge-green' };
    }

    const goalMode = g.weightGoalMode || 'maintain';
    const maxGain = g.weeklyGainMax ? Number(g.weeklyGainMax) : 0.5;
    const maxLoss = g.weeklyLossMax ? Number(g.weeklyLossMax) : 0.5;
    if (goalMode === 'lose') {
      if (weekly < -maxLoss) return { label: '减重过快', cls: 'badge-red' };
      if (weekly < -0.2) return { label: '减重达标', cls: 'badge-green' };
      if (weekly > maxGain) return { label: '体重反弹', cls: 'badge-yellow' };
      return { label: '平稳', cls: 'badge-blue' };
    } else if (goalMode === 'gain') {
      if (weekly > maxGain * 2) return { label: '增重偏快', cls: 'badge-yellow' };
      if (weekly > 0.1) return { label: '增重中', cls: 'badge-green' };
      return { label: '增重偏慢', cls: 'badge-blue' };
    } else {
      if (Math.abs(weekly) > maxGain) return { label: '波动较大', cls: 'badge-yellow' };
      return { label: '稳定', cls: 'badge-green' };
    }
  }

  function weightAnomaly() {
    const list = weights().slice().sort(Utils.byDateDesc);
    const user = Store.get('user');
    const settings = Store.get('settings');
    const g = settings.healthGoals || {};
    if (list.length < 2) return null;
    const days = (Utils.parseDate(list[0].date) - Utils.parseDate(list[1].date)) / 86400000;
    if (days <= 0) return null;
    const weekly = ((list[0].value - list[1].value) / days) * 7;

    if (user.userMode === 'pregnancy') {
      if (weekly > 0.75) return { type: 'high', msg: '近两次记录折算每周增重 ' + weekly.toFixed(2) + 'kg，高于 0.75kg 上限，注意热量/碳水是否超标。' };
      if (weekly < 0.5) return { type: 'low', msg: '近两次记录折算每周增重 ' + weekly.toFixed(2) + 'kg，低于 0.5kg 下限，注意营养摄入。' };
      return null;
    }

    const goalMode = g.weightGoalMode || 'maintain';
    const maxGain = g.weeklyGainMax ? Number(g.weeklyGainMax) : 0.5;
    const maxLoss = g.weeklyLossMax ? Number(g.weeklyLossMax) : 0.5;
    if (goalMode === 'lose') {
      if (weekly < -maxLoss) return { type: 'high', msg: '近一周减重 ' + Math.abs(weekly).toFixed(2) + 'kg，速度过快，建议每周不超过 ' + maxLoss + 'kg。' };
      if (weekly > maxGain) return { type: 'high', msg: '近一周体重反弹 ' + weekly.toFixed(2) + 'kg，注意饮食控制。' };
    } else {
      if (Math.abs(weekly) > maxGain) return { type: 'high', msg: '近一周体重波动 ' + weekly.toFixed(2) + 'kg，超出 ±' + maxGain + 'kg 范围。' };
    }
    return null;
  }

  function weightPoints(period) {
    let list = weights().slice().sort((a, b) => (a.date + a.time) < (b.date + b.time) ? -1 : 1);
    const now = new Date();
    const daysBack = { day: 30, week: 84, month: 365, year: 365 * 5 }[period] || 30;
    const cutoff = new Date(now.getTime() - daysBack * 86400000);
    list = list.filter((r) => Utils.parseDate(r.date) >= cutoff);

    if (period === 'day') {
      return list.map((r) => ({ v: r.value, label: Utils.fmtDateShort(r.date), status: null, raw: r }));
    }
    // 周/月/年：按桶聚合取平均
    const buckets = {};
    list.forEach((r) => {
      const d = Utils.parseDate(r.date);
      let key;
      if (period === 'week') {
        const start = new Date(d.getTime()); start.setDate(start.getDate() - start.getDay());
        key = Utils.dateStr(start);
      } else if (period === 'month') {
        key = r.date.slice(0, 7);
      } else {
        key = r.date.slice(0, 4);
      }
      (buckets[key] = buckets[key] || []).push(r.value);
    });
    return Object.keys(buckets).sort().map((k) => ({
      v: Utils.round(buckets[k].reduce((a, b) => a + b, 0) / buckets[k].length, 1),
      label: period === 'year' ? k : k.slice(5) || k,
      status: null
    }));
  }

  /* ---------- 血糖 ---------- */
  function sugars() { return Store.get('sugars', []); }
  function saveSugars(list) { Store.set('sugars', list); }

  function sugarStatus(v, scene, customHours) {
    const r = sugarRef(scene, customHours);
    if (v < r.low) return { label: '偏低', cls: 'badge-yellow', status: 'low' };
    if (v > r.high) return { label: '偏高', cls: 'badge-red', status: 'high' };
    return { label: '正常', cls: 'badge-green', status: 'normal' };
  }

  function sugarPoints(period) {
    let list = sugars().slice().sort((a, b) => (a.date + a.time) < (b.date + b.time) ? -1 : 1);
    const daysBack = { day: 1, week: 7, month: 30, year: 365 }[period] || 7;
    const now = new Date();
    const cutoff = new Date(now.getTime() - daysBack * 86400000);
    list = list.filter((r) => Utils.parseDate(r.date) >= cutoff);

    // 年视图按月平均，其余直接展示
    if (period === 'year') {
      const buckets = {};
      list.forEach((r) => {
        const k = r.date.slice(0, 7);
        (buckets[k] = buckets[k] || []).push(r.value);
      });
      return Object.keys(buckets).sort().map((k) => ({
        v: Utils.round(buckets[k].reduce((a, b) => a + b, 0) / buckets[k].length, 1),
        label: k.slice(5), status: null
      }));
    }
    return list.map((r) => {
      const st = sugarStatus(r.value, r.scene, r.customHours);
      return { v: r.value, label: Utils.fmtDateShort(r.date) + (period === 'day' ? ' ' + r.time.slice(0, 5) : ''), status: st.status, raw: r };
    });
  }

  /* ---------- 视图渲染 ---------- */
  const RecordsView = {
    render() {
      const tab = App.state.recordsTab || 'weight';
      return [
        '<div class="seg mb16" id="rec-seg">',
        '  <button data-tab="weight" class="' + (tab === 'weight' ? 'active' : '') + '">体重</button>',
        '  <button data-tab="sugar" class="' + (tab === 'sugar' ? 'active' : '') + '">血糖</button>',
        '</div>',
        '<div id="rec-panel">' + (tab === 'weight' ? this.weightHTML() : this.sugarHTML()) + '</div>'
      ].join('');
    },

    weightHTML() {
      const list = weights().slice().sort(Utils.byDateDesc);
      const shown = App.state.weightShown || 30; // 历史记录分页：默认30条，可加载更多
      const latest = list[0];
      const settings = Store.get('settings');
      const unit = settings.unit || 'kg';
      const disp = latest ? (unit === 'kg' ? Utils.round(latest.value, 1) : Utils.kgToLb(latest.value)) : null;
      const st = weightStatus(latest);
      const anomaly = weightAnomaly();
      const period = App.state.weightPeriod || 'month';
      const chartType = App.state.weightChart || 'line';

      const rows = list.slice(0, shown).map((r) => {
        const v = unit === 'kg' ? Utils.round(r.value, 1) : Utils.kgToLb(r.value);
        return '<div class="list-item"><div class="li-ico"><svg class="ico ico-sm"><use href="#i-scale"/></svg></div>' +
          '<div class="grow"><div class="li-title num">' + v + ' ' + unit + '</div>' +
          '<div class="li-sub">' + Utils.fmtDateCN(r.date) + (r.time ? ' ' + r.time.slice(0, 5) : '') + '</div></div>' +
          '<button class="icon-btn" data-del-weight="' + r.id + '" aria-label="删除"><svg class="ico ico-sm"><use href="#i-trash"/></svg></button></div>';
      }).join('');
      const moreBtn = list.length > shown
        ? '<button class="btn btn-ghost btn-block mt12" id="weight-more"><svg class="ico ico-sm" style="margin-right:4px;vertical-align:-2px"><use href="#i-chevron-down"/></svg>加载更多（还有 ' + (list.length - shown) + ' 条，共 ' + list.length + ' 条）</button>'
        : '';

      return [
        '<div class="card stat-card">',
        '  <div class="row between">',
        '    <div><div class="stat-label">最新体重</div>',
        '      <div class="mt8"><span class="stat-value num">' + (disp != null ? disp : '--') + '</span><span class="stat-unit">' + unit + '</span></div>',
        '      <div class="mt8"><span class="badge ' + st.cls + '">' + st.label + '</span>' + (latest ? '<span class="muted small" style="margin-left:8px">' + Utils.fmtDateCN(latest.date) + '</span>' : '') + '</div>',
        '    </div>',
        '  </div>',
        anomaly ? '<div class="mt12" style="padding:10px 12px;border-radius:10px;background:' + (anomaly.type === 'high' ? 'var(--warn-bg)' : 'var(--ok-bg)') + ';font-size:13px;display:flex;gap:8px;align-items:flex-start"><svg class="ico ico-sm" style="flex-shrink:0;margin-top:2px;color:' + (anomaly.type === 'high' ? 'var(--warning)' : 'var(--info)') + '"><use href="#i-alert"/></svg>' + Utils.esc(anomaly.msg) + '</div>' : '',
        '</div>',

        '<div class="card">',
        '  <div class="card-title"><svg class="ico"><use href="#i-scale"/></svg>记录体重</div>',
        '  <div class="row mb12">',
        '    <div class="grow"><input class="input input-lg" id="weight-input" type="number" inputmode="decimal" placeholder="' + unit + '"></div>',
        '    <div class="seg" style="width:110px;flex:none" id="weight-unit">',
        '      <button data-u="kg" class="' + (unit === 'kg' ? 'active' : '') + '">kg</button>',
        '      <button data-u="lb" class="' + (unit === 'lb' ? 'active' : '') + '">lb</button>',
        '    </div>',
        '  </div>',
        '  <div class="row">',
        '    <input class="input grow" id="weight-date" type="date" value="' + Utils.todayStr() + '">',
        '    <input class="input grow" id="weight-time" type="time" value="' + Utils.timeStr() + '">',
        '  </div>',
        '  <button class="btn btn-primary btn-block mt12" id="weight-save">保存体重</button>',
        '</div>',

        '<div class="card">',
        '  <div class="card-title">体重趋势</div>',
        '  <div class="row between mb12">',
        '    <div class="seg grow" id="weight-period">',
        '      <button data-p="day" class="' + (period === 'day' ? 'active' : '') + '">日</button>',
        '      <button data-p="week" class="' + (period === 'week' ? 'active' : '') + '">周</button>',
        '      <button data-p="month" class="' + (period === 'month' ? 'active' : '') + '">月</button>',
        '      <button data-p="year" class="' + (period === 'year' ? 'active' : '') + '">年</button>',
        '    </div>',
        '    <div class="seg" style="width:130px;flex:none" id="weight-chart">',
        '      <button data-c="line" class="' + (chartType === 'line' ? 'active' : '') + '">折线</button>',
        '      <button data-c="bar" class="' + (chartType === 'bar' ? 'active' : '') + '">柱状</button>',
        '    </div>',
        '  </div>',
        '  <div id="weight-chart-box"></div>',
        '</div>',

        '<div class="card">',
        '  <div class="card-title">历史记录 <span class="muted small">（共' + list.length + '条' + (list.length > shown ? '，显示最新' + shown + '条' : '') + '）</span></div>',
        rows || '<div class="empty-state"><img src="img/empty-note.jpg" alt="" class="es-img" onerror="this.style.display=\'none\'"><p>还没有体重记录<br>先记录第一条吧</p></div>',
        moreBtn,
        '</div>'
      ].join('');
    },

    sugarHTML() {
      const list = sugars().slice().sort(Utils.byDateDesc);
      const latest = list[0];
      const settings = Store.get('settings');
      const unit = settings.sugarUnit || 'mmol';
      const period = App.state.sugarPeriod || 'week';
      const sceneFilter = App.state.sugarScene || 'all';

      const disp = (v) => unit === 'mmol' ? v : Utils.mmolToMgdl(v);
      const unitLabel = unit === 'mmol' ? 'mmol/L' : 'mg/dL';

      const shown = App.state.sugarShown || 30; // 历史记录分页：默认30条，可加载更多
      const rows = list.slice(0, shown).map((r) => {
        const st = sugarStatus(r.value, r.scene, r.customHours);
        return '<div class="list-item"><div class="li-ico"><svg class="ico ico-sm"><use href="#i-droplet"/></svg></div>' +
          '<div class="grow"><div class="li-title num">' + Utils.round(disp(r.value), 1) + ' ' + unitLabel + '</div>' +
          '<div class="li-sub">' + Utils.fmtDateCN(r.date) + ' ' + r.time.slice(0, 5) + ' · ' + sceneLabel(r.scene, r.customHours) + '</div></div>' +
          '<span class="badge ' + st.cls + '">' + st.label + '</span>' +
          '<button class="icon-btn" data-del-sugar="' + r.id + '" aria-label="删除"><svg class="ico ico-sm"><use href="#i-trash"/></svg></button></div>';
      }).join('');
      const moreBtn = list.length > shown
        ? '<button class="btn btn-ghost btn-block mt12" id="sugar-more"><svg class="ico ico-sm" style="margin-right:4px;vertical-align:-2px"><use href="#i-chevron-down"/></svg>加载更多（还有 ' + (list.length - shown) + ' 条，共 ' + list.length + ' 条）</button>'
        : '';

      const sceneChips = [['all', '全部']].concat(SCENES.map((s) => [s.key, s.label])).map((s) =>
        '<button class="chip' + (sceneFilter === s[0] ? ' active' : '') + '" data-sugar-scene="' + s[0] + '">' + s[1] + '</button>'
      ).join('');

      const refF = sugarRef('fasting'), ref1 = sugarRef('afterMeal1h'), ref2 = sugarRef('afterMeal2h');
      // 场景记忆：手动选择长期有效；自动推荐的场景超过45分钟按当前时间重新推荐
      const staled = !App.state.sugarInputSceneManual &&
        Date.now() - (App.state.sugarInputSceneAt || 0) > 45 * 60 * 1000;
      const curScene = (App.state.sugarInputScene && !staled) ? App.state.sugarInputScene : recommendScene();
      App.state.sugarInputScene = curScene;
      App.state.sugarInputSceneAt = Date.now();

      return [
        '<div class="card stat-card">',
        '  <div class="row between">',
        '    <div><div class="stat-label">最近血糖' + (latest ? '（' + sceneLabel(latest.scene, latest.customHours) + '）' : '') + '</div>',
        '      <div class="mt8"><span class="stat-value num">' + (latest ? disp(latest.value) : '--') + '</span><span class="stat-unit">' + unitLabel + '</span></div>',
        '      <div class="mt8">' + (latest ? '<span class="badge ' + sugarStatus(latest.value, latest.scene, latest.customHours).cls + '">' + sugarStatus(latest.value, latest.scene, latest.customHours).label + '</span>' : '<span class="badge badge-gray">暂无数据</span>') + '</div>',
        '    </div>',
        '  </div>',
        '  <div class="mt12 small muted">目标：空腹 ' + refF.low + '~' + refF.high + ' · 餐后1h &lt;' + ref1.high + ' · 餐后2h &lt;' + ref2.high + ' mmol/L</div>',
        '</div>',

        '<div class="card">',
        '  <div class="card-title"><svg class="ico"><use href="#i-droplet"/></svg>记录血糖</div>',
        '  <input class="input input-lg mb12" id="sugar-input" type="number" inputmode="decimal" placeholder="' + unitLabel + '">',
        '  <div class="label">测量场景 <span class="muted" style="font-weight:400">· 已按当前时间推荐</span></div>',
        '  <div class="chips mb12" id="sugar-scene-input">' + SCENES.map((s) =>
          '<button class="chip' + (s.key === curScene ? ' active' : '') + '" data-scene="' + s.key + '">' + s.label + '</button>'
        ).join('') + '</div>',
        '  <div class="field" id="sugar-custom-hours-wrap" style="display:' + (curScene === 'afterMealCustom' ? '' : 'none') + '">',
        '    <label class="label">餐后几小时</label>',
        '    <input class="input" id="sugar-custom-hours" type="number" inputmode="decimal" step="0.5" min="0.5" max="12" placeholder="如 2.5 表示餐后2.5小时">',
        '  </div>',
        '  <div class="hint mb12" id="sugar-scene-hint"></div>',
        '  <div class="row">',
        '    <input class="input grow" id="sugar-date" type="date" value="' + Utils.todayStr() + '">',
        '    <input class="input grow" id="sugar-time" type="time" value="' + Utils.timeStr() + '">',
        '  </div>',
        '  <button class="btn btn-primary btn-block mt12" id="sugar-save">保存血糖</button>',
        '</div>',

        '<div class="card">',
        '  <div class="card-title">血糖曲线</div>',
        '  <div class="row between mb12">',
        '    <div class="seg grow" id="sugar-period">',
        '      <button data-p="day" class="' + (period === 'day' ? 'active' : '') + '">日</button>',
        '      <button data-p="week" class="' + (period === 'week' ? 'active' : '') + '">周</button>',
        '      <button data-p="month" class="' + (period === 'month' ? 'active' : '') + '">月</button>',
        '      <button data-p="year" class="' + (period === 'year' ? 'active' : '') + '">年</button>',
        '    </div>',
        '  </div>',
        '  <div class="chips mb12">' + sceneChips + '</div>',
        '  <div id="sugar-chart-box"></div>',
        '</div>',

        '<div class="card">',
        '  <div class="card-title">历史记录 <span class="muted small">（共' + list.length + '条' + (list.length > shown ? '，显示最新' + shown + '条' : '') + '）</span></div>',
        rows || '<div class="empty-state"><img src="img/empty-note.jpg" alt="" class="es-img" onerror="this.style.display=\'none\'"><p>还没有血糖记录<br>记录第一条血糖数据吧</p></div>',
        moreBtn,
        '  <button class="btn btn-ghost btn-block mt12" id="sugar-export">导出数据（CSV）</button>',
        '</div>'
      ].join('');
    },

    mount(container) {
      const tab = App.state.recordsTab || 'weight';
      container.querySelectorAll('#rec-seg button').forEach((b) => b.addEventListener('click', () => {
        App.state.recordsTab = b.dataset.tab; App.reload();
      }));

      if (tab === 'weight') this.mountWeight(container);
      else this.mountSugar(container);
    },

    mountWeight(container) {
      const draw = () => {
        const period = App.state.weightPeriod || 'month';
        const chartType = App.state.weightChart || 'line';
        const points = weightPoints(period);
        const box = container.querySelector('#weight-chart-box');
        if (!box) return;
        const opts = { points, emptyText: '暂无体重数据', color: 'var(--primary-2)' };
        if (chartType === 'bar') Charts.bar(box, Object.assign({}, opts, { bars: points.map((p) => ({ v: p.v, label: p.label })) }));
        else Charts.line(box, opts);
      };

      container.querySelector('#weight-save').addEventListener('click', () => {
        const input = container.querySelector('#weight-input');
        const v = parseFloat(input.value);
        if (!v || v <= 0) { Utils.toast('请输入有效体重', 'error'); return; }
        const settings = Store.get('settings');
        const unit = settings.unit || 'kg';
        const kg = unit === 'lb' ? Utils.round(Utils.lbToKg(v), 1) : Utils.round(v, 1);
        const rec = { id: Utils.uid(), date: container.querySelector('#weight-date').value, time: container.querySelector('#weight-time').value, value: kg };
        const list = weights(); list.push(rec); saveWeights(list);
        Utils.toast('体重已保存', 'success');
        App.reload();
      });

      const unitSeg = container.querySelector('#weight-unit');
      unitSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        const s = Store.get('settings'); s.unit = b.dataset.u; Store.set('settings', s);
        App.reload();
      }));

      // 加载更多历史记录
      const moreBtn = container.querySelector('#weight-more');
      if (moreBtn) moreBtn.addEventListener('click', () => {
        App.state.weightShown = (App.state.weightShown || 30) + 30;
        App.reload();
      });

      container.querySelector('#weight-period').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        App.state.weightPeriod = b.dataset.p; App.reload();
      }));
      const chartSeg = container.querySelector('#weight-chart');
      chartSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        App.state.weightChart = b.dataset.c;
        // 就地更新激活态与滑块位置（不整页刷新），图表即时重绘
        if (App.moveSegThumb) App.moveSegThumb(chartSeg, b);
        else chartSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
        draw();
      }));

      container.querySelectorAll('[data-del-weight]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.delWeight;
        App.confirm('删除这条体重记录？', () => {
          saveWeights(weights().filter((r) => r.id !== id));
          Utils.toast('已删除', 'success'); App.reload();
        });
      }));

      draw();
      if (App.pendingFocus === 'weight') {
        const el = container.querySelector('#weight-input'); if (el) el.focus();
      }
    },

    mountSugar(container) {
      const draw = () => {
        const period = App.state.sugarPeriod || 'week';
        const scene = App.state.sugarScene || 'all';
        let points = sugarPoints(period);
        if (scene !== 'all') points = points.filter((p) => p.raw && p.raw.scene === scene);
        const box = container.querySelector('#sugar-chart-box');
        if (!box) return;
        const unit = (Store.get('settings').sugarUnit || 'mmol');
        const conv = (v) => unit === 'mmol' ? v : Utils.mmolToMgdl(v);
        const pts = points.map((p) => ({ v: conv(p.v), label: p.label, status: p.status }));
        // 参考线按当前模式与自定义目标动态计算
        const refF = sugarRef('fasting'), ref1 = sugarRef('afterMeal1h'), ref2 = sugarRef('afterMeal2h');
        Charts.line(box, {
          points: pts, emptyText: '暂无血糖数据', color: 'var(--info)',
          band: { lo: conv(refF.low), hi: conv(ref1.high), color: 'var(--ok-bg)' },
          refs: [
            { v: conv(refF.high), label: '空腹' + refF.high, color: 'var(--warning)' },
            { v: conv(ref2.high), label: '餐后' + ref2.high, color: 'var(--danger)' }
          ]
        });
      };

      let inputScene = App.state.sugarInputScene || 'fasting';
      const customWrap = container.querySelector('#sugar-custom-hours-wrap');
      const customInput = container.querySelector('#sugar-custom-hours');
      const hintEl = container.querySelector('#sugar-scene-hint');
      const updateHint = () => {
        if (!hintEl) return;
        let txt = '「' + sceneLabel(inputScene, '') + '」' + sceneTargetText(inputScene, customInput ? customInput.value : null);
        if (inputScene === 'afterMealCustom') txt += ' · 填写小时数后按对应标准判定';
        hintEl.textContent = txt;
      };
      updateHint();

      container.querySelector('#sugar-scene-input').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        inputScene = b.dataset.scene;
        App.state.sugarInputScene = inputScene;
        App.state.sugarInputSceneManual = true;
        App.state.sugarInputSceneAt = Date.now();
        container.querySelectorAll('#sugar-scene-input .chip').forEach((c) => c.classList.remove('active'));
        b.classList.add('active');
        // 餐后自定义时显示小时数输入
        if (customWrap) customWrap.style.display = (inputScene === 'afterMealCustom') ? '' : 'none';
        updateHint();
      }));
      if (customInput) customInput.addEventListener('input', updateHint);

      container.querySelector('#sugar-save').addEventListener('click', () => {
        const input = container.querySelector('#sugar-input');
        const v = parseFloat(input.value);
        if (!v || v <= 0) { Utils.toast('请输入有效血糖值', 'error'); return; }
        if (v > 33.3) { Utils.toast('数值超出常见血糖仪量程（33.3 mmol/L），请确认', 'error'); return; }
        const unit = (Store.get('settings').sugarUnit || 'mmol');
        const val = unit === 'mgdl' ? Utils.round(Utils.mgdlToMmol(v), 1) : Utils.round(v, 1);
        const rec = {
          id: Utils.uid(),
          date: container.querySelector('#sugar-date').value,
          time: container.querySelector('#sugar-time').value,
          value: val,
          scene: inputScene
        };
        // 餐后自定义：保存小时数
        if (inputScene === 'afterMealCustom' && customInput && customInput.value) {
          rec.customHours = parseFloat(customInput.value);
        }
        const list = sugars(); list.push(rec); saveSugars(list);
        const st = sugarStatus(val, inputScene, rec.customHours);
        const target = sceneTargetText(inputScene, rec.customHours);
        const msg = '血糖已保存：' + st.label + '（' + sceneLabel(inputScene, rec.customHours) + ' ' + target + '）';
        Utils.toast(msg, st.status === 'normal' ? 'success' : (st.status === 'low' ? 'warning' : 'error'));
        if (st.status !== 'normal') App.playSound('chime');
        App.reload();
      });

      container.querySelector('#sugar-period').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        App.state.sugarPeriod = b.dataset.p; App.reload();
      }));

      container.querySelectorAll('[data-sugar-scene]').forEach((b) => b.addEventListener('click', () => {
        App.state.sugarScene = b.dataset.sugarScene; App.reload();
      }));

      // 加载更多历史记录
      const moreBtn = container.querySelector('#sugar-more');
      if (moreBtn) moreBtn.addEventListener('click', () => {
        App.state.sugarShown = (App.state.sugarShown || 30) + 30;
        App.reload();
      });

      container.querySelector('#sugar-export').addEventListener('click', () => {
        const unit = (Store.get('settings').sugarUnit || 'mmol');
        const conv = (v) => unit === 'mmol' ? v : Utils.mmolToMgdl(v);
        const header = '日期,时间,场景,餐后小时,血糖值(' + (unit === 'mmol' ? 'mmol/L' : 'mg/dL') + '),判定';
        const lines = sugars().slice().sort(Utils.byDateDesc).map((r) =>
          [r.date, r.time.slice(0, 5), sceneLabel(r.scene, r.customHours), r.customHours || '', conv(r.value), sugarStatus(r.value, r.scene, r.customHours).label].join(','));
        Utils.download('血糖记录_' + Utils.todayStr() + '.csv', [header].concat(lines).join('\n'), 'text/csv;charset=utf-8');
        Utils.toast('已导出 CSV', 'success');
      });

      container.querySelectorAll('[data-del-sugar]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.delSugar;
        App.confirm('删除这条血糖记录？', () => {
          saveSugars(sugars().filter((r) => r.id !== id));
          Utils.toast('已删除', 'success'); App.reload();
        });
      }));

      draw();
      if (App.pendingFocus === 'sugar') {
        const el = container.querySelector('#sugar-input'); if (el) el.focus();
      }
    }
  };

  global.RecordsView = RecordsView;
})(window);
