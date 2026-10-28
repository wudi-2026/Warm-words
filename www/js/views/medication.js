/* =====================================================================
 * views/medication.js — 任务提醒模块（管理、提醒、记录、完成率、导出）
 * ===================================================================== */
(function (global) {
  'use strict';

  const Store = global.Store, Utils = global.Utils, Charts = global.Charts, Data = global.Data;

  const SOUNDS = [
    { key: 'chime', label: '清脆提示音' },
    { key: 'bell', label: '铃声' },
    { key: 'silent', label: '静音' }
  ];
  const STATUS = {
    taken: { label: '已完成', cls: 'badge-green' },
    missed: { label: '未完成', cls: 'badge-red' },
    skipped: { label: '跳过', cls: 'badge-gray' },
    pending: { label: '待完成', cls: 'badge-blue' }
  };
  const MEAL_LABEL = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
  const MEAL_SVG = { breakfast: 'i-sun', lunch: 'i-flame', dinner: 'i-moon', snack: 'i-leaf' };

  function meds() { return Store.get('meds', []); }
  function saveMeds(list) { Store.set('meds', list); }
  function logs() { return Store.get('medLogs', []); }
  function saveLogs(list) { Store.set('medLogs', list); }

  function findMed(id) { return meds().find((m) => m.id === id); }

  /* 实际提醒时间：餐后联动委托 App，否则固定时间 */
  function effTimes(m) {
    if (global.App && App.effectiveMedTimes) return App.effectiveMedTimes(m);
    return m.times || [];
  }

  /* 今日提醒计划（含用餐 + 用药，按时间排序） */
  function todaySchedule() {
    if (global.App && App.buildSchedule) return App.buildSchedule();
    const d = Utils.todayStr();
    const out = [];
    meds().forEach((m) => {
      if (!m.enabled) return;
      effTimes(m).forEach((t) => {
        const log = logs().find((l) => l.medId === m.id && l.date === d && l.time === t);
        const now = Utils.timeStr();
        let status = log ? log.status : (t < now ? 'missed' : 'pending');
        out.push({ type: 'med', medId: m.id, name: m.name, time: t, status: status });
      });
    });
    return out.sort((a, b) => a.time < b.time ? -1 : 1);
  }

  /* 依从性统计 */
  function compliance(days) {
    const now = new Date();
    let scheduled = 0, taken = 0, missed = 0, skipped = 0;
    const daily = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const ds = Utils.dateStr(d);
      daily[ds] = { total: 0, taken: 0 };
    }
    meds().forEach((m) => {
      effTimes(m).forEach((t) => {
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 86400000);
          const ds = Utils.dateStr(d);
          // 未来时间不计入
          if (i === 0 && t > Utils.timeStr()) continue;
          scheduled++;
          daily[ds].total++;
          const log = logs().find((l) => l.medId === m.id && l.date === ds && l.time === t);
          if (log && log.status === 'taken') { taken++; daily[ds].taken++; }
          else if (log && log.status === 'skipped') { skipped++; }
          else { missed++; }
        }
      });
    });
    const rate = scheduled ? Math.round(taken / scheduled * 100) : 0;
    return { scheduled, taken, missed, skipped, rate, daily };
  }

  /* ---------- 视图 HTML ---------- */
  function planHTML() {
    const schedule = todaySchedule();
    const items = schedule.map((s) => {
      if (s.type === 'meal') {
        const mealSvg = MEAL_SVG[s.key] || 'i-leaf';
        return '<div class="tl-item meal"><div class="row between">' +
          '<div class="grow"><div class="bold"><svg class="ico ico-sm" style="vertical-align:-3px;margin-right:4px"><use href="#' + mealSvg + '"/></svg>' + Utils.esc(s.label) + '</div>' +
          '<div class="small muted num">' + s.time + '</div></div>' +
          '<span class="badge ' + (s.past ? 'badge-gray' : 'badge-blue') + '">' + (s.past ? '已到点' : '待用餐') + '</span></div>' +
          '<div class="mt8"><button class="btn btn-sm btn-soft" data-goto-diet><svg class="ico ico-sm" style="margin-right:4px"><use href="#i-salad"/></svg>去记录饮食</button></div></div>';
      }
      const st = STATUS[s.status];
      let actions = '';
      if (s.status === 'pending') {
        actions = '<button class="btn btn-sm btn-soft" data-mark="taken" data-med="' + s.medId + '" data-time="' + s.time + '"><svg class="ico ico-sm" style="margin-right:4px"><use href="#i-check"/></svg>已完成</button>' +
          '<button class="btn btn-sm btn-ghost" data-mark="skipped" data-med="' + s.medId + '" data-time="' + s.time + '">跳过</button>';
      } else if (s.status === 'missed') {
        actions = '<button class="btn btn-sm btn-soft" data-mark="taken" data-med="' + s.medId + '" data-time="' + s.time + '">补记为已完成</button>';
      }
      return '<div class="tl-item ' + s.status + '"><div class="row between">' +
        '<div class="grow"><div class="bold"><svg class="ico ico-sm" style="vertical-align:-3px;margin-right:4px"><use href="#i-pill"/></svg>' + Utils.esc(s.name) + '</div>' +
        '<div class="small muted num">' + s.time + '</div></div>' +
        '<span class="badge ' + st.cls + '">' + st.label + '</span></div>' +
        (actions ? '<div class="row mt8" style="gap:8px">' + actions + '</div>' : '') +
        '</div>';
    }).join('');

    return [
      '<div class="card">',
      '  <div class="card-title"><svg class="ico"><use href="#i-clock"/></svg>今日提醒 <span class="badge badge-gray">' + schedule.length + ' 项</span></div>',
      items ? '<div class="timeline">' + items + '</div>' : '<div class="empty-state"><img src="img/empty-note.jpg" alt="" class="es-img" onerror="this.style.display=\'none\'"><p>暂无提醒<br>去「任务」添加或在「我的」设置用餐时间</p></div>',
      '  <div class="mt12 small muted row" style="gap:6px"><svg class="ico ico-sm"><use href="#i-bell"/></svg>用餐与任务到点都会提醒；已过时间未标记会自动记为「未完成」。</div>',
      '</div>'
    ].join('');
  }

  function medsHTML() {
    const list = meds().map((m) => {
      const times = effTimes(m).map((t) => '<span class="chip" style="padding:3px 10px;min-height:auto">' + t + '</span>').join('');
      const mealTag = m.mealRef
        ? '<span class="chip" style="padding:3px 10px;min-height:auto;background:var(--ok-bg);color:var(--success)"><svg class="ico ico-sm" style="width:12px;height:12px;vertical-align:-2px"><use href="#' + (MEAL_SVG[m.mealRef] || 'i-leaf') + '"/></svg> ' + (MEAL_LABEL[m.mealRef] || m.mealRef) +
          (m.offsetMin ? (m.offsetMin > 0 ? '后' + m.offsetMin + '分钟' : '前' + (-m.offsetMin) + '分钟') : '') + '（自动联动）</span>'
        : '';
      return '<div class="list-item" style="align-items:flex-start">' +
        '<div class="li-ico"><svg class="ico ico-sm"><use href="#i-pill"/></svg></div>' +
        '<div class="grow"><div class="row"><span class="li-title">' + Utils.esc(m.name) + '</span>' +
        '<span class="badge ' + (m.enabled ? 'badge-green' : 'badge-gray') + '" style="margin-left:6px">' + (m.enabled ? '提醒中' : '已暂停') + '</span></div>' +
        '<div class="li-sub">' + Utils.esc(m.generic || '') + (m.spec ? ' · ' + Utils.esc(m.spec) : '') + '</div>' +
        '<div class="li-sub muted">' + Utils.esc(m.purpose || '') + '</div>' +
        '<div class="row wrap mt8" style="gap:4px">' + times + mealTag + '</div>' +
        '<div class="row mt8" style="gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-sm ' + (m.enabled ? 'btn-ghost' : 'btn-primary') + '" data-toggle="' + m.id + '">' + (m.enabled ? '<svg class="ico ico-sm" style="margin-right:4px"><use href="#i-pause"/></svg>暂停提醒' : '<svg class="ico ico-sm" style="margin-right:4px"><use href="#i-play"/></svg>恢复提醒') + '</button>' +
        '<button class="btn btn-sm btn-soft" data-edit="' + m.id + '"><svg class="ico ico-sm" style="margin-right:4px"><use href="#i-edit"/></svg>编辑</button>' +
        '<button class="btn btn-sm btn-danger" data-del="' + m.id + '">删除</button>' +
        '</div></div></div>';
    }).join('');

    return [
      '<div class="card">',
      '  <div class="card-title"><svg class="ico"><use href="#i-clipboard"/></svg>任务管理</div>',
      list || '<div class="empty-state"><img src="img/empty-note.jpg" alt="" class="es-img" onerror="this.style.display=\'none\'"><p>还没有任务<br>点击下方按钮添加</p></div>',
      '  <button class="btn btn-primary btn-block mt12" id="med-add"><svg class="ico ico-sm" style="margin-right:6px"><use href="#i-plus"/></svg>添加任务</button>',
      '  <div class="mt8 small muted">可从内置常用任务模板快速添加，或手动录入。</div>',
      '</div>'
    ].join('');
  }

  function statsHTML() {
    const week = compliance(7);
    const month = compliance(30);
    const range = App.state.medRange || 'week';
    const comp = range === 'week' ? week : month;
    const medFilter = App.state.medFilter || 'all';

    // 依从率柱状图（每日）
    const days = range === 'week' ? 7 : 30;
    const dailyKeys = Object.keys(comp.daily).sort();
    const bars = dailyKeys.map((ds) => ({
      v: comp.daily[ds].total ? Math.round(comp.daily[ds].taken / comp.daily[ds].total * 100) : 0,
      label: ds.slice(5)
    }));

    // 历史记录
    const filterChips = [['all', '全部']].concat(meds().map((m) => [m.id, m.name])).map((c) =>
      '<button class="chip' + (medFilter === c[0] ? ' active' : '') + '" data-med-filter="' + c[0] + '">' + Utils.esc(c[1]) + '</button>'
    ).join('');

    let history = logs().slice().sort((a, b) => (a.date + a.time) < (b.date + b.time) ? 1 : -1);
    if (medFilter !== 'all') history = history.filter((l) => l.medId === medFilter);
    history = history.slice(0, 40).map((l) => {
      const st = STATUS[l.status] || STATUS.pending;
      const med = findMed(l.medId);
      return '<div class="list-item"><div class="li-ico"><svg class="ico ico-sm"><use href="#i-check"/></svg></div>' +
        '<div class="grow"><div class="li-title">' + Utils.esc(med ? med.name : '（已删除）') + '</div>' +
        '<div class="li-sub">' + l.date + ' ' + l.time + '</div></div>' +
        '<span class="badge ' + st.cls + '">' + st.label + '</span></div>';
    }).join('');

    return [
      '<div class="card">',
      '  <div class="card-title">完成率统计</div>',
      '  <div class="row between mb12">',
      '    <div class="seg grow" id="med-range">',
      '      <button data-r="week" class="' + (range === 'week' ? 'active' : '') + '">近7天</button>',
      '      <button data-r="month" class="' + (range === 'month' ? 'active' : '') + '">近30天</button>',
      '    </div>',
      '  </div>',
      '  <div class="grid-3 mb12">',
      '    <div class="card" style="margin:0;padding:12px;text-align:center"><div class="stat-value num" style="color:var(--success)">' + comp.rate + '%</div><div class="stat-label">完成率</div></div>',
      '    <div class="card" style="margin:0;padding:12px;text-align:center"><div class="stat-value num">' + comp.taken + '</div><div class="stat-label">已完成</div></div>',
      '    <div class="card" style="margin:0;padding:12px;text-align:center"><div class="stat-value num" style="color:var(--danger)">' + comp.missed + '</div><div class="stat-label">未完成</div></div>',
      '  </div>',
      '  <div id="med-chart"></div>',
      '</div>',

      '<div class="card">',
      '  <div class="card-title">任务历史</div>',
      '  <div class="chips mb12">' + filterChips + '</div>',
      history || '<div class="empty-state"><img src="img/empty-note.jpg" alt="" class="es-img" onerror="this.style.display=\'none\'"><p>暂无任务记录</p></div>',
      '  <div class="modal-actions" style="margin-top:12px">',
      '    <button class="btn btn-ghost" id="med-csv">导出 CSV</button>',
      '    <button class="btn btn-primary" id="med-pdf">导出报告</button>',
      '  </div>',
      '</div>'
    ].join('');
  }

  /* ---------- 添加/编辑药品弹窗 ---------- */
  function openMedForm(medId) {
    const med = medId ? findMed(medId) : null;
    const presets = Data.DRUGS.map((d, i) =>
      '<option value="' + i + '">' + Utils.esc(d.name + '（' + d.generic + '）') + '</option>'
    ).join('');

    const times = (med && med.times && med.times.length ? med.times : ['08:00']);
    const sound = med ? med.sound : 'chime';
    const mealRef = med ? med.mealRef : '';
    const offset = med && med.offsetMin != null ? med.offsetMin : 30;
    const isMeal = !!mealRef;

    const mealOptions = ['breakfast', 'lunch', 'dinner', 'snack'].map((k) =>
      '<option value="' + k + '"' + (mealRef === k ? ' selected' : '') + '>' + (MEAL_LABEL[k] || k) + '</option>'
    ).join('');

    const html = [
      '<div class="modal-title">' + (med ? '编辑任务' : '添加任务') + '<button class="icon-btn modal-close" data-close><svg class="ico ico-sm"><use href="#i-x"/></svg></button></div>',
      med ? '' : '<div class="field"><label class="label">从常用任务模板快速选择</label><select class="select" id="med-preset"><option value="">— 手动填写 —</option>' + presets + '</select></div>',
      '<div class="row"><div class="field grow"><label class="label">任务名称 *</label><input class="input" id="med-name" value="' + Utils.esc(med ? med.name : '') + '"></div>' +
      '<div class="field grow"><label class="label">别名/通用名</label><input class="input" id="med-generic" value="' + Utils.esc(med ? med.generic : '') + '"></div></div>',
      '<div class="row"><div class="field grow"><label class="label">规格</label><input class="input" id="med-spec" placeholder="如 50μg/片" value="' + Utils.esc(med ? med.spec : '') + '"></div>' +
      '<div class="field grow"><label class="label">剂量单位</label><input class="input" id="med-unit" placeholder="如 μg/片/mg" value="' + Utils.esc(med ? med.unit : '') + '"></div></div>',
      '<div class="field"><label class="label">用途说明</label><input class="input" id="med-purpose" placeholder="如 甲状腺功能减退 / 测血糖" value="' + Utils.esc(med ? med.purpose : '') + '"></div>',
      '<div class="field"><label class="label">备注/剂量</label><input class="input" id="med-dosage" placeholder="如 每日1片 / 遵医嘱" value="' + Utils.esc(med ? med.dosage : '') + '"></div>',

      '<div class="field"><label class="label">提醒时机</label><select class="select" id="med-timing">',
      '  <option value="absolute"' + (!isMeal ? ' selected' : '') + '>固定时间（手动指定）</option>',
      '  <option value="meal"' + (isMeal ? ' selected' : '') + '>相对用餐（餐后/餐前自动推算）</option>',
      '</select></div>',

      '<div id="med-meal-block" style="display:' + (isMeal ? 'block' : 'none') + '">',
      '  <div class="row"><div class="field grow"><label class="label">关联餐次</label><select class="select" id="med-mealref">' + mealOptions + '</select></div>',
      '  <div class="field grow"><label class="label">偏移分钟（正=餐后，负=餐前）</label><input class="input" id="med-offset" type="number" value="' + offset + '"></div></div>',
      '  <div class="small muted mb12" id="med-meal-preview"></div>',
      '</div>',

      '<div id="med-times-block" style="display:' + (isMeal ? 'none' : 'block') + '">',
      '  <div class="field"><label class="label">每日提醒时间</label><div id="med-times">' +
      times.map((t) => '<div class="row mb8"><input class="input grow" type="time" value="' + t + '"><button class="icon-btn" data-del-time><svg class="ico ico-sm"><use href="#i-trash"/></svg></button></div>').join('') +
      '</div><button class="btn btn-sm btn-soft" id="med-add-time"><svg class="ico ico-sm" style="margin-right:4px"><use href="#i-plus"/></svg>添加时间</button></div>',
      '</div>',

      '<div class="row"><div class="field grow"><label class="label">提醒声音</label><select class="select" id="med-sound">' +
      SOUNDS.map((s) => '<option value="' + s.key + '"' + (sound === s.key ? ' selected' : '') + '>' + s.label + '</option>').join('') +
      '</select></div><div class="field" style="align-self:flex-end;padding-bottom:12px">' +
      '<label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" id="med-vibration" ' + (med ? (med.vibration ? 'checked' : '') : 'checked') + '> 振动提醒</label></div></div>',
      '<div class="modal-actions"><button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" id="med-save">保存</button></div>'
    ].join('');

    App.modal(html, (root) => {
      const timing = root.querySelector('#med-timing');
      const mealBlock = root.querySelector('#med-meal-block');
      const timesBlock = root.querySelector('#med-times-block');

      const updatePreview = () => {
        const pv = root.querySelector('#med-meal-preview');
        if (!pv) return;
        const ref = root.querySelector('#med-mealref').value;
        const off = parseInt(root.querySelector('#med-offset').value, 10) || 0;
        const s = Store.get('settings');
        const mt = (s.mealTimes || Store.DEFAULT_MEAL_TIMES)[ref];
        pv.textContent = mt
          ? '预计提醒时间：' + Utils.addMinToTime(mt, off) + '（' + (MEAL_LABEL[ref] || ref) + (off > 0 ? '后' + off + '分钟' : off < 0 ? '前' + (-off) + '分钟' : '') + '）'
          : '提示：该餐次尚未在「我的 → 用餐时间」里设置';
      };

      timing.addEventListener('change', () => {
        const m = timing.value === 'meal';
        mealBlock.style.display = m ? 'block' : 'none';
        timesBlock.style.display = m ? 'none' : 'block';
        if (m) updatePreview();
      });

      root.querySelector('#med-mealref').addEventListener('change', updatePreview);
      root.querySelector('#med-offset').addEventListener('input', updatePreview);
      if (isMeal) updatePreview();

      const preset = root.querySelector('#med-preset');
      if (preset) preset.addEventListener('change', () => {
        if (preset.value === '') return;
        const d = Data.DRUGS[parseInt(preset.value, 10)];
        root.querySelector('#med-name').value = d.name;
        root.querySelector('#med-generic').value = d.generic;
        root.querySelector('#med-spec').value = d.spec;
        root.querySelector('#med-unit').value = d.unit;
        root.querySelector('#med-purpose').value = d.purpose;
        root.querySelector('#med-dosage').value = d.dosage;
        root.querySelector('#med-times').innerHTML = (d.times || ['08:00']).map((t) => '<div class="row mb8"><input class="input grow" type="time" value="' + t + '"><button class="icon-btn" data-del-time><svg class="ico ico-sm"><use href="#i-trash"/></svg></button></div>').join('');
        bindTimeDelete(root);
        // 预设为「餐后」类时自动切到相对用餐并匹配餐次
        if (d.timing && (d.timing.indexOf('饭后') >= 0 || d.timing.indexOf('餐后') >= 0)) {
          timing.value = 'meal';
          mealBlock.style.display = 'block'; timesBlock.style.display = 'none';
          if (d.timing.indexOf('早') >= 0) root.querySelector('#med-mealref').value = 'breakfast';
          else if (d.timing.indexOf('午') >= 0) root.querySelector('#med-mealref').value = 'lunch';
          else if (d.timing.indexOf('晚') >= 0 || d.timing.indexOf('睡') >= 0) root.querySelector('#med-mealref').value = 'dinner';
          updatePreview();
        }
      });

      const bindTimeDelete = (root) => {
        root.querySelectorAll('[data-del-time]').forEach((b) => b.addEventListener('click', () => {
          const row = b.closest('.row'); row.parentNode.removeChild(row);
        }));
      };
      bindTimeDelete(root);
      root.querySelector('#med-add-time').addEventListener('click', () => {
        const div = document.createElement('div');
        div.className = 'row mb8';
        div.innerHTML = '<input class="input grow" type="time" value="08:00"><button class="icon-btn" data-del-time><svg class="ico ico-sm"><use href="#i-trash"/></svg></button>';
        root.querySelector('#med-times').appendChild(div);
        bindTimeDelete(root);
      });

      root.querySelector('#med-save').addEventListener('click', () => {
        const name = root.querySelector('#med-name').value.trim();
        if (!name) { Utils.toast('请填写任务名称', 'error'); return; }
        let mealRef = null, offsetMin = null, times = [];
        if (timing.value === 'meal') {
          mealRef = root.querySelector('#med-mealref').value;
          offsetMin = parseInt(root.querySelector('#med-offset').value, 10) || 0;
          const s = Store.get('settings');
          if (!s.mealTimes || !s.mealTimes[mealRef]) { Utils.toast('请先在「我的」设置该餐用餐时间', 'error'); return; }
        } else {
          times = Array.from(root.querySelectorAll('#med-times input')).map((i) => i.value).filter(Boolean);
          if (!times.length) { Utils.toast('请至少设置一个提醒时间', 'error'); return; }
        }
        const obj = {
          id: med ? med.id : Utils.uid(),
          name: name,
          generic: root.querySelector('#med-generic').value.trim(),
          spec: root.querySelector('#med-spec').value.trim(),
          unit: root.querySelector('#med-unit').value.trim(),
          purpose: root.querySelector('#med-purpose').value.trim(),
          dosage: root.querySelector('#med-dosage').value.trim(),
          times: times,
          mealRef: mealRef,
          offsetMin: offsetMin,
          sound: root.querySelector('#med-sound').value,
          vibration: root.querySelector('#med-vibration').checked,
          enabled: med ? med.enabled : true,
          createdAt: med ? med.createdAt : new Date().toISOString()
        };
        const list = meds();
        if (med) { const i = list.findIndex((x) => x.id === med.id); list[i] = obj; }
        else list.push(obj);
        saveMeds(list);
        App.closeModal(); Utils.toast('任务已保存', 'success'); App.reload();
        if (App.syncNativeReminders) App.syncNativeReminders();
      });
    });
  }

  /* ---------- 导出 ---------- */
  function buildReportHTML() {
    const w = compliance(7), m = compliance(30);
    const rows = logs().slice().sort((a, b) => (a.date + a.time) < (b.date + b.time) ? 1 : -1)
      .map((l) => {
        const med = findMed(l.medId);
        const st = STATUS[l.status] || STATUS.pending;
        return '<tr><td>' + l.date + '</td><td>' + l.time + '</td><td>' + Utils.esc(med ? med.name : '') + '</td><td>' + st.label + '</td></tr>';
      }).join('');
    return [
      '<h1>任务完成率报告</h1>',
      '<p>生成时间：' + new Date().toLocaleString('zh-CN') + '</p>',
      '<h2>完成率概览</h2>',
      '<p>近7天完成率：<b>' + w.rate + '%</b>（已完成 ' + w.taken + ' / 应完成 ' + w.scheduled + '，未完成 ' + w.missed + '，跳过 ' + w.skipped + '）</p>',
      '<p>近30天完成率：<b>' + m.rate + '%</b>（已完成 ' + m.taken + ' / 应完成 ' + m.scheduled + '）</p>',
      '<h2>任务记录明细</h2>',
      '<table border="1" cellspacing="0" cellpadding="6"><thead><tr><th>日期</th><th>时间</th><th>任务</th><th>状态</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="4">暂无记录</td></tr>') + '</tbody></table>'
    ].join('');
  }

  /* ---------- 视图入口 ---------- */
  const MedicationView = {
    render() {
      const tab = App.state.medTab || 'plan';
      return [
        '<div class="seg mb16" id="med-seg">',
        '  <button data-tab="plan" class="' + (tab === 'plan' ? 'active' : '') + '">今日提醒</button>',
        '  <button data-tab="meds" class="' + (tab === 'meds' ? 'active' : '') + '">任务</button>',
        '  <button data-tab="stats" class="' + (tab === 'stats' ? 'active' : '') + '">统计</button>',
        '</div>',
        '<div id="med-panel">' + (tab === 'plan' ? planHTML() : tab === 'meds' ? medsHTML() : statsHTML()) + '</div>'
      ].join('');
    },

    mount(container) {
      const tab = App.state.medTab || 'plan';
      container.querySelector('#med-seg').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        App.state.medTab = b.dataset.tab; App.reload();
      }));

      if (tab === 'plan') this.mountPlan(container);
      else if (tab === 'meds') this.mountMeds(container);
      else this.mountStats(container);
    },

    mountPlan(container) {
      container.querySelectorAll('[data-goto-diet]').forEach((b) => b.addEventListener('click', () => {
        App.state.dietTab = 'record';
        App.route('diet');
      }));
      container.querySelectorAll('[data-mark]').forEach((b) => b.addEventListener('click', () => {
        const medId = b.dataset.med, time = b.dataset.time, status = b.dataset.mark;
        const list = logs();
        const d = Utils.todayStr();
        const idx = list.findIndex((l) => l.medId === medId && l.date === d && l.time === time);
        const entry = { id: Utils.uid(), medId: medId, date: d, time: time, status: status, at: new Date().toISOString() };
        if (idx >= 0) list[idx] = Object.assign({}, list[idx], { status: status, at: entry.at });
        else list.push(entry);
        saveLogs(list);
        const med = findMed(medId);
        Utils.toast((med ? med.name : '') + ' ' + time + ' · ' + (STATUS[status] || {}).label, status === 'taken' ? 'success' : 'info');
        App.reload();
      }));
    },

    mountMeds(container) {
      container.querySelector('#med-add').addEventListener('click', () => openMedForm());
      container.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openMedForm(b.dataset.edit)));
      container.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
        const list = meds();
        const m = list.find((x) => x.id === b.dataset.toggle);
        if (m) { m.enabled = !m.enabled; saveMeds(list); Utils.toast(m.name + (m.enabled ? ' 已恢复提醒' : ' 已暂停提醒'), 'info'); App.reload(); if (App.syncNativeReminders) App.syncNativeReminders(); }
      }));
      container.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.del;
        App.confirm('删除该任务及其提醒？', () => {
          saveMeds(meds().filter((m) => m.id !== id));
          Utils.toast('已删除', 'success'); App.reload();
          if (App.syncNativeReminders) App.syncNativeReminders();
        });
      }));
    },

    mountStats(container) {
      container.querySelector('#med-range').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        App.state.medRange = b.dataset.r; App.reload();
      }));
      container.querySelectorAll('[data-med-filter]').forEach((b) => b.addEventListener('click', () => {
        App.state.medFilter = b.dataset.medFilter; App.reload();
      }));

      // 依从率图表
      const range = App.state.medRange || 'week';
      const comp = compliance(range === 'week' ? 7 : 30);
      const dailyKeys = Object.keys(comp.daily).sort();
      const bars = dailyKeys.map((ds) => ({
        v: comp.daily[ds].total ? Math.round(comp.daily[ds].taken / comp.daily[ds].total * 100) : 0,
        label: ds.slice(5)
      }));
      const box = container.querySelector('#med-chart');
      if (box) Charts.bar(box, { bars: bars, color: 'var(--success)', showValue: bars.length <= 8, ylo: 0, yhi: 100, refs: [{ v: 80, label: '目标80%', color: 'var(--border-strong)' }], emptyText: '暂无数据' });

      container.querySelector('#med-csv').addEventListener('click', () => {
        const header = '日期,时间,任务,状态';
        const lines = logs().slice().sort((a, b) => (a.date + a.time) < (b.date + b.time) ? 1 : -1)
          .map((l) => { const med = findMed(l.medId); const st = STATUS[l.status] || {}; return [l.date, l.time, (med ? med.name : ''), st.label].join(','); });
        Utils.download('任务记录_' + Utils.todayStr() + '.csv', [header].concat(lines).join('\n'), 'text/csv;charset=utf-8');
        Utils.toast('已导出 CSV', 'success');
      });

      container.querySelector('#med-pdf').addEventListener('click', () => {
        const body = buildReportHTML();
        const full = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>任务完成率报告</title><style>' +
          'body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;padding:24px;color:#1f2333}' +
          'h1{font-size:22px}h2{font-size:17px;margin-top:24px}table{border-collapse:collapse;width:100%}' +
          'td,th{padding:6px;font-size:13px;text-align:left;border:1px solid #ccc}' +
          '</style></head><body>' + body + '</body></html>';
        Utils.download('任务完成率报告_' + Utils.todayStr() + '.html', full, 'text/html;charset=utf-8');
        Utils.toast('报告已导出，可用浏览器打开后打印为 PDF', 'success');
      });
    }
  };

  global.MedicationView = MedicationView;
  global.MedicationView.todaySchedule = todaySchedule;
  global.MedicationView.compliance = compliance;
})(window);
