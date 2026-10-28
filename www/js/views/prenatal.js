/* =====================================================================
 * views/prenatal.js — 产检模块（B超胎儿数据、羊水、产检记录、血压、胎动）
 * 仅孕期模式使用
 * ===================================================================== */
(function (global) {
  'use strict';

  const Store = global.Store, Utils = global.Utils, Data = global.Data;

  const TABS = [
    { key: 'ultrasound', label: 'B超数据', svg: 'i-baby' },
    { key: 'amniotic', label: '羊水', svg: 'i-wave' },
    { key: 'checkup', label: '产检记录', svg: 'i-clipboard' },
    { key: 'bp', label: '血压', svg: 'i-heart-pulse' },
    { key: 'kick', label: '胎动', svg: 'i-activity' },
    { key: 'contraction', label: '宫缩', svg: 'i-clock' }
  ];

  function scans() { return Store.get('fetalScans', []); }
  function fluids() { return Store.get('amnioticFluid', []); }
  function checkups() { return Store.get('checkups', []); }
  function pressures() { return Store.get('bloodPressure', []); }
  function kicks() { return Store.get('kickCounts', []); }
  function contractions() { return Store.get('contractions', []); }

  function isTwin() {
    const u = Store.get('user');
    return u.twinType === 'dichorionic' || u.twinType === 'monochorionic';
  }

  /* 宝宝昵称：双胎返回两项，单胎返回一项；未设置时用默认名 */
  function babyNames() {
    const u = Store.get('user');
    const n = u.babyNames || [];
    return isTwin() ? [n[0] || '宝宝A', n[1] || '宝宝B'] : [n[0] || '宝宝'];
  }
  /* 按序号取昵称：直接读完整昵称数组，保证切换胎数后历史记录仍显示保存时的昵称 */
  function babyName(idx) {
    const n = Store.get('user').babyNames || [];
    if (n[idx]) return n[idx];
    return isTwin() ? '宝宝' + String.fromCharCode(65 + idx) : (idx === 0 ? '宝宝' : '宝宝' + String.fromCharCode(65 + idx));
  }

  /* ---------- B超胎儿数据 ---------- */
  function ultrasoundHTML() {
    const list = scans().slice().sort(Utils.byDateDesc);
    const twin = isTwin();

    const rows = list.slice(0, 20).map((r) => {
      const w1 = r.baby1 ? Data.calcEFW(r.baby1.bpd, r.baby1.hc, r.baby1.ac, r.baby1.fl) : null;
      const w2 = twin && r.baby2 ? Data.calcEFW(r.baby2.bpd, r.baby2.hc, r.baby2.ac, r.baby2.fl) : null;
      const disc = (w1 && w2) ? Data.twinDiscordance(w1, w2) : null;
      const discLv = disc != null ? Data.discordanceLevel(disc) : null;
      return '<div class="fetal-card">' +
        '<div class="fetal-card-head"><span class="bold">' + Utils.fmtDateCN(r.date) + '</span>' +
        (r.gestWeek ? '<span class="badge badge-blue">孕' + r.gestWeek + '周</span>' : '') +
        '<button class="icon-btn" data-del-scan="' + r.id + '"><svg class="ico ico-sm"><use href="#i-trash"/></svg></button></div>' +
        '<div class="fetal-babies">' +
        fetalBabyHTML(babyName(0), r.baby1, w1) +
        (twin ? fetalBabyHTML(babyName(1), r.baby2, w2) : '') +
        '</div>' +
        (discLv ? '<div class="fetal-disc ' + discLv.cls + '">' + babyName(0) + '与' + babyName(1) + '体重差异：' + disc + '% · ' + discLv.label +
          '<div class="small muted">' + discLv.desc + '</div></div>' : '') +
        (r.note ? '<div class="small muted mt8">备注：' + Utils.esc(r.note) + '</div>' : '') +
        '</div>';
    }).join('');

    return [
      '<div class="card">',
      '  <div class="card-title"><svg class="ico"><use href="#i-baby"/></svg>录入B超数据</div>',
      '  <div class="field"><label class="label">检查日期</label><input class="input" type="date" id="us-date" value="' + Utils.todayStr() + '"></div>',
      '  <div class="field"><label class="label">孕周（选填）</label><input class="input" type="number" id="us-week" placeholder="如 24" inputmode="numeric"></div>',
      '  <div class="fetal-input-group">',
      fetalInputHTML('baby1', babyName(0)),
      twin ? fetalInputHTML('baby2', babyName(1)) : '',
      '  </div>',
      '  <div class="field mt12"><label class="label">备注（选填）</label><input class="input" id="us-note" placeholder="如：双顶径标准切面上..."></div>',
      '  <div class="efw-preview" id="efw-preview"></div>',
      '  <button class="btn btn-primary btn-block mt12" id="us-save">保存B超记录</button>',
      '  <div class="small muted mt8">体重自动按 Hadlock III 公式计算（BPD+HC+AC+FL），误差约±15%。至少需要腹围(AC)和股骨长(FL)。</div>',
      '</div>',
      '<div class="card">',
      '  <div class="card-title">历史记录</div>',
      rows || '<div class="empty-state"><p>还没有B超记录<br>录入第一次产检数据吧</p></div>',
      '</div>'
    ].join('');
  }

  /* B超测量项定义：key、中文名 */
  const FETAL_FIELDS = [
    ['bpd', '双顶径'],
    ['hc', '头围'],
    ['ac', '腹围'],
    ['fl', '股骨长']
  ];

  function fetalBabyHTML(label, data, efw) {
    if (!data) return '';
    // 每项测量值显示为带边框的记录框
    const boxes = FETAL_FIELDS.map(([k, name]) => {
      const v = data[k];
      return '<div class="fetal-field' + (v ? '' : ' fetal-field-empty') + '">' +
        '<div class="ff-label">' + name + '</div>' +
        '<div class="ff-val">' + (v ? '<span class="num bold">' + v + '</span><span class="ff-unit">mm</span>' : '<span class="muted">--</span>') + '</div>' +
        '</div>';
    }).join('');
    return '<div class="fetal-baby">' +
      '<div class="fetal-baby-label">' + label + '</div>' +
      '<div class="fetal-fields">' + boxes + '</div>' +
      (efw ? '<div class="fetal-weight">预估体重 <span class="num bold">' + efw + '</span> g <span class="small muted">(' + (efw / 500).toFixed(2) + '斤)</span></div>' : '<div class="small muted">数据不足无法估重</div>') +
      '</div>';
  }

  function fetalInputHTML(prefix, label) {
    return '<div class="fetal-input-block">' +
      '<div class="fetal-input-title">' + label + '</div>' +
      '<div class="row mb8"><div class="field grow"><label class="label">双顶径 BPD(mm)</label><input class="input us-input" data-baby="' + prefix + '" data-field="bpd" type="number" inputmode="decimal" placeholder="mm"></div>' +
      '<div class="field grow"><label class="label">头围 HC(mm)</label><input class="input us-input" data-baby="' + prefix + '" data-field="hc" type="number" inputmode="decimal" placeholder="mm"></div></div>' +
      '<div class="row"><div class="field grow"><label class="label">腹围 AC(mm)</label><input class="input us-input" data-baby="' + prefix + '" data-field="ac" type="number" inputmode="decimal" placeholder="mm"></div>' +
      '<div class="field grow"><label class="label">股骨长 FL(mm)</label><input class="input us-input" data-baby="' + prefix + '" data-field="fl" type="number" inputmode="decimal" placeholder="mm"></div></div>' +
      '</div>';
  }

  function mountUltrasound(c) {
    // 实时计算预览
    const updatePreview = () => {
      const get = (baby, field) => {
        const el = c.querySelector('.us-input[data-baby="' + baby + '"][data-field="' + field + '"]');
        return el ? parseFloat(el.value) : null;
      };
      const b1 = { bpd: get('baby1', 'bpd'), hc: get('baby1', 'hc'), ac: get('baby1', 'ac'), fl: get('baby1', 'fl') };
      const w1 = Data.calcEFW(b1.bpd, b1.hc, b1.ac, b1.fl);
      const twin = isTwin();
      let html = '';
      if (w1) html += '<div class="efw-baby">' + Utils.esc(babyName(0)) + '：<b>' + w1 + 'g</b>（' + (w1 / 500).toFixed(2) + '斤）</div>';
      if (twin) {
        const b2 = { bpd: get('baby2', 'bpd'), hc: get('baby2', 'hc'), ac: get('baby2', 'ac'), fl: get('baby2', 'fl') };
        const w2 = Data.calcEFW(b2.bpd, b2.hc, b2.ac, b2.fl);
        if (w2) html += '<div class="efw-baby">' + Utils.esc(babyName(1)) + '：<b>' + w2 + 'g</b>（' + (w2 / 500).toFixed(2) + '斤）</div>';
        if (w1 && w2) {
          const disc = Data.twinDiscordance(w1, w2);
          const lv = Data.discordanceLevel(disc);
          html += '<div class="efw-discordance ' + lv.cls + '">体重差异 ' + disc + '% · ' + lv.label + '</div>';
        }
      }
      const prev = c.querySelector('#efw-preview');
      if (prev) prev.innerHTML = html;
    };
    c.querySelectorAll('.us-input').forEach((el) => el.addEventListener('input', updatePreview));

    c.querySelector('#us-save').addEventListener('click', () => {
      const date = c.querySelector('#us-date').value;
      if (!date) { Utils.toast('请选择日期', 'error'); return; }
      const readBaby = (prefix) => {
        const get = (field) => {
          const el = c.querySelector('.us-input[data-baby="' + prefix + '"][data-field="' + field + '"]');
          return el && el.value ? parseFloat(el.value) : null;
        };
        return { bpd: get('bpd'), hc: get('hc'), ac: get('ac'), fl: get('fl') };
      };
      const baby1 = readBaby('baby1');
      if (!baby1.ac && !baby1.fl) { Utils.toast('至少需要腹围和股骨长', 'error'); return; }
      const rec = {
        id: Utils.uid(), date: date,
        gestWeek: c.querySelector('#us-week').value || '',
        baby1: baby1, note: c.querySelector('#us-note').value.trim()
      };
      if (isTwin()) {
        rec.baby2 = readBaby('baby2');
      }
      const list = scans(); list.push(rec); Store.set('fetalScans', list);
      Utils.toast('B超记录已保存', 'success');
      App.reload();
    });

    c.querySelectorAll('[data-del-scan]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.delScan;
      App.confirm('删除这条B超记录？', () => {
        Store.set('fetalScans', scans().filter((r) => r.id !== id));
        Utils.toast('已删除', 'success'); App.reload();
      });
    }));
  }

  /* ---------- 羊水 ---------- */
  function amnioticHTML() {
    const list = fluids().slice().sort(Utils.byDateDesc);
    const twin = isTwin();
    const names = babyNames();
    const rows = list.slice(0, 20).map((r) => {
      const st = Data.amnioticStatus(r.type, r.value);
      return '<div class="list-item"><div class="li-ico"><svg class="ico ico-sm"><use href="#i-wave"/></svg></div>' +
        '<div class="grow"><div class="li-title num">' + r.value + ' cm <span class="small muted">(' + (r.type === 'afi' ? '羊水指数AFI' : '最大深度SDP') + ')</span></div>' +
        '<div class="li-sub">' + (twin && r.baby != null ? Utils.esc(names[r.baby] || '宝宝') + ' · ' : '') + Utils.fmtDateCN(r.date) + (r.note ? ' · ' + Utils.esc(r.note) : '') + '</div></div>' +
        '<span class="badge ' + st.cls + '">' + st.label + '</span>' +
        '<button class="icon-btn" data-del-fluid="' + r.id + '"><svg class="ico ico-sm"><use href="#i-trash"/></svg></button></div>';
    }).join('');

    return [
      '<div class="card stat-card">',
      '  <div class="card-title"><svg class="ico"><use href="#i-wave"/></svg>羊水参考</div>',
      '  <div class="row wrap small" style="gap:8px">',
      '    <span class="chip chip-static">AFI 8~25cm 正常</span>',
      '    <span class="chip chip-static">AFI 5~8cm 偏少</span>',
      '    <span class="chip chip-static">AFI <5cm 过少</span>',
      '    <span class="chip chip-static">SDP 2~8cm 正常</span>',
      '  </div>',
      (twin ? '<div class="mt8 small muted">双胎建议分别记录每个宝宝的羊水池深度（SDP）。</div>' : ''),
      '</div>',
      '<div class="card">',
      '  <div class="card-title">记录羊水</div>',
      '  <div class="seg mb12" id="fluid-type">',
      '    <button data-type="afi" class="active">羊水指数 AFI</button>',
      '    <button data-type="sdp">最大深度 SDP</button>',
      '  </div>',
      twin ? '<div class="seg mb12" id="fluid-baby">' +
        '<button data-baby="0" class="active">' + Utils.esc(names[0]) + '</button>' +
        '<button data-baby="1">' + Utils.esc(names[1]) + '</button>' +
        '</div>' : '',
      '  <div class="field"><label class="label">数值 (cm)</label><input class="input input-lg" id="fluid-value" type="number" inputmode="decimal" step="0.1" placeholder="cm"></div>',
      '  <div class="field"><label class="label">日期</label><input class="input" type="date" id="fluid-date" value="' + Utils.todayStr() + '"></div>',
      '  <div class="field"><label class="label">备注（选填）</label><input class="input" id="fluid-note" placeholder="如：B超测量"></div>',
      '  <button class="btn btn-primary btn-block mt12" id="fluid-save">保存</button>',
      '</div>',
      '<div class="card"><div class="card-title">历史记录</div>',
      rows || '<div class="empty-state"><p>还没有羊水记录</p></div></div>'
    ].join('');
  }

  function mountAmniotic(c) {
    let fluidType = 'afi';
    let fluidBaby = 0;
    c.querySelector('#fluid-type').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      fluidType = b.dataset.type;
      c.querySelectorAll('#fluid-type button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    }));
    const babySeg = c.querySelector('#fluid-baby');
    if (babySeg) babySeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      fluidBaby = Number(b.dataset.baby) || 0;
      babySeg.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    }));
    c.querySelector('#fluid-save').addEventListener('click', () => {
      const v = parseFloat(c.querySelector('#fluid-value').value);
      if (!v || v <= 0) { Utils.toast('请输入有效数值', 'error'); return; }
      const rec = {
        id: Utils.uid(), date: c.querySelector('#fluid-date').value,
        type: fluidType, value: Utils.round(v, 1),
        baby: isTwin() ? fluidBaby : null,
        note: c.querySelector('#fluid-note').value.trim()
      };
      const list = fluids(); list.push(rec); Store.set('amnioticFluid', list);
      const st = Data.amnioticStatus(fluidType, v);
      Utils.toast('已保存（' + (isTwin() ? babyName(fluidBaby) + ' · ' : '') + st.label + '）', st.cls === 'badge-red' ? 'error' : 'success');
      App.reload();
    });
    c.querySelectorAll('[data-del-fluid]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.delFluid;
      App.confirm('删除这条羊水记录？', () => {
        Store.set('amnioticFluid', fluids().filter((r) => r.id !== id));
        Utils.toast('已删除', 'success'); App.reload();
      });
    }));
  }

  /* ---------- 产检记录 ---------- */
  /* 宝宝专属产检项目（双胎时按宝宝分别录入） */
  const BABY_CHECKUP_KEYS = ['fhr', 'position'];

  function checkupHTML() {
    const twin = isTwin();
    const names = babyNames();
    const list = checkups().slice().sort(Utils.byDateDesc);
    const rows = list.slice(0, 20).map((r) => {
      const items = Object.entries(r.items || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => {
        const def = Data.CHECKUP_ITEMS.find((i) => i.key === k);
        return '<span class="chip chip-static">' + (def ? def.label : k) + '：' + v + (def && def.unit ? ' ' + def.unit : '') + '</span>';
      }).join('');
      // 按宝宝分别记录的项目（胎心率/胎位）
      const babyChips = Object.entries(r.babies || {}).map(([idx, b]) => {
        const nm = Utils.esc(names[idx] || '宝宝');
        return Object.entries(b || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => {
          const def = Data.CHECKUP_ITEMS.find((i) => i.key === k);
          return '<span class="chip chip-static" style="border-color:var(--primary-2)">' + nm + ' ' + (def ? def.label : k) + '：' + Utils.esc(v) + (def && def.unit ? ' ' + def.unit : '') + '</span>';
        }).join('');
      }).join('');
      const customs = Object.entries(r.custom || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) =>
        '<span class="chip chip-static" style="border-style:dashed">' + Utils.esc(k) + '：' + Utils.esc(v) + '</span>'
      ).join('');
      return '<div class="checkup-card">' +
        '<div class="checkup-head"><span class="bold">' + Utils.fmtDateCN(r.date) + '</span>' +
        (r.hospital ? '<span class="small muted">' + Utils.esc(r.hospital) + '</span>' : '') +
        '<button class="icon-btn" data-del-checkup="' + r.id + '"><svg class="ico ico-sm"><use href="#i-trash"/></svg></button></div>' +
        (r.gestWeek ? '<span class="badge badge-blue mb8">孕' + r.gestWeek + '周</span>' : '') +
        '<div class="chips-wrap">' + items + babyChips + customs + '</div>' +
        (r.note ? '<div class="small muted mt8">备注：' + Utils.esc(r.note) + '</div>' : '') +
        '</div>';
    }).join('');

    // 常规项目（不含宝宝专属项）
    const standardItems = Data.CHECKUP_ITEMS.filter((i) => BABY_CHECKUP_KEYS.indexOf(i.key) < 0).map((item) => {
      if (item.type === 'bp') {
        return '<div class="row"><div class="field grow"><label class="label">收缩压(mmHg)</label><input class="input cu-input" data-key="' + item.key + '_sys" type="number" inputmode="numeric" placeholder="如 120"></div>' +
          '<div class="field grow"><label class="label">舒张压(mmHg)</label><input class="input cu-input" data-key="' + item.key + '_dia" type="number" inputmode="numeric" placeholder="如 80"></div></div>';
      }
      return '<div class="field"><label class="label">' + item.label + (item.unit ? ' (' + item.unit + ')' : '') + '</label>' +
        '<input class="input cu-input" data-key="' + item.key + '" type="' + (item.type === 'number' ? 'number' : 'text') + '" inputmode="' + (item.type === 'number' ? 'decimal' : 'text') + '" placeholder="' + item.label + '"></div>';
    }).join('');

    // 宝宝专属项目（胎心率/胎位）：双胎每个宝宝一组，单胎一组
    const babyBlocks = [];
    const babyCount = twin ? 2 : 1;
    for (let bi = 0; bi < babyCount; bi++) {
      babyBlocks.push('<div class="section-subtitle mt12"><svg class="ico ico-sm" style="vertical-align:-2px"><use href="#i-baby"/></svg> ' + Utils.esc(names[bi] || '宝宝') + '（胎心率/胎位）</div>' +
        '<div class="row"><div class="field grow"><label class="label">胎心率(次/分)</label><input class="input cu-baby-input" data-baby="' + bi + '" data-key="fhr" type="number" inputmode="numeric" placeholder="如 142"></div>' +
        '<div class="field grow"><label class="label">胎位</label><input class="input cu-baby-input" data-baby="' + bi + '" data-key="position" type="text" placeholder="如 头位"></div></div>');
    }

    return [
      '<div class="card">',
      '  <div class="card-title"><svg class="ico"><use href="#i-clipboard"/></svg>新建产检记录</div>',
      '  <div class="row"><div class="field grow"><label class="label">检查日期</label><input class="input" type="date" id="cu-date" value="' + Utils.todayStr() + '"></div>' +
      '  <div class="field grow"><label class="label">孕周</label><input class="input" type="number" id="cu-week" placeholder="如 24" inputmode="numeric"></div></div>',
      '  <div class="field"><label class="label">医院/医生（选填）</label><input class="input" id="cu-hospital" placeholder="如：市妇幼保健院"></div>',
      '  <div class="section-subtitle">常规项目</div>',
      standardItems,
      babyBlocks.join(''),
      '  <div class="section-subtitle mt12">自定义项目</div>',
      '  <div id="cu-custom-list"></div>',
      '  <button class="btn btn-soft btn-block mt8" id="cu-add-custom"><svg class="ico ico-sm" style="vertical-align:-2px"><use href="#i-plus"/></svg> 添加自定义项目</button>',
      '  <div class="field mt12"><label class="label">备注</label><textarea class="input" id="cu-note" rows="2" placeholder="其他注意事项..."></textarea></div>',
      '  <button class="btn btn-primary btn-block mt12" id="cu-save">保存产检记录</button>',
      '</div>',
      '<div class="card"><div class="card-title">历史记录</div>',
      rows || '<div class="empty-state"><p>还没有产检记录</p></div></div>'
    ].join('');
  }

  function mountCheckup(c) {
    let customIdx = 0;
    const addCustom = () => {
      const wrap = c.querySelector('#cu-custom-list');
      const idx = customIdx++;
      const row = document.createElement('div');
      row.className = 'row mb8';
      row.innerHTML = '<input class="input grow cu-custom-name" placeholder="项目名称" style="margin-right:6px">' +
        '<input class="input grow cu-custom-val" placeholder="数值/结果"><button class="icon-btn cu-custom-del"><svg class="ico ico-sm"><use href="#i-x"/></svg></button>';
      wrap.appendChild(row);
      row.querySelector('.cu-custom-del').addEventListener('click', () => wrap.removeChild(row));
    };
    c.querySelector('#cu-add-custom').addEventListener('click', addCustom);

    c.querySelector('#cu-save').addEventListener('click', () => {
      const date = c.querySelector('#cu-date').value;
      if (!date) { Utils.toast('请选择日期', 'error'); return; }
      const items = {};
      c.querySelectorAll('.cu-input').forEach((el) => {
        if (el.value) items[el.dataset.key] = el.value;
      });
      // 合并血压
      const sys = items.bp_sys, dia = items.bp_dia;
      if (sys && dia) { items.bp = sys + '/' + dia; delete items.bp_sys; delete items.bp_dia; }
      else { delete items.bp_sys; delete items.bp_dia; }

      // 按宝宝分别记录的项目（胎心率/胎位）
      const babies = {};
      c.querySelectorAll('.cu-baby-input').forEach((el) => {
        if (!el.value) return;
        const bi = el.dataset.baby;
        (babies[bi] = babies[bi] || {})[el.dataset.key] = el.value;
      });

      const custom = {};
      c.querySelectorAll('#cu-custom-list > .row').forEach((row) => {
        const name = row.querySelector('.cu-custom-name').value.trim();
        const val = row.querySelector('.cu-custom-val').value.trim();
        if (name && val) custom[name] = val;
      });

      const rec = {
        id: Utils.uid(), date: date,
        gestWeek: c.querySelector('#cu-week').value || '',
        hospital: c.querySelector('#cu-hospital').value.trim(),
        items: items, babies: babies, custom: custom,
        note: c.querySelector('#cu-note').value.trim()
      };
      const list = checkups(); list.push(rec); Store.set('checkups', list);
      Utils.toast('产检记录已保存', 'success');
      App.reload();
    });

    c.querySelectorAll('[data-del-checkup]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.delCheckup;
      App.confirm('删除这条产检记录？', () => {
        Store.set('checkups', checkups().filter((r) => r.id !== id));
        Utils.toast('已删除', 'success'); App.reload();
      });
    }));
  }

  /* ---------- 血压 ---------- */
  function bpHTML() {
    const list = pressures().slice().sort(Utils.byDateDesc);
    const latest = list[0];
    const latestSt = latest ? Data.bpStatus(latest.sys, latest.dia) : null;

    const rows = list.slice(0, 30).map((r) => {
      const st = Data.bpStatus(r.sys, r.dia);
      const pulseSt = r.pulse ? Data.pulseStatus(r.pulse) : null;
      return '<div class="list-item"><div class="li-ico"><svg class="ico ico-sm"><use href="#i-heart-pulse"/></svg></div>' +
        '<div class="grow"><div class="li-title num">' + r.sys + '/' + r.dia + ' mmHg' +
          (r.pulse ? ' <span class="small muted">脉搏 ' + r.pulse + '次/分</span>' : '') + '</div>' +
        '<div class="li-sub">' + Utils.fmtDateCN(r.date) + ' ' + (r.time || '').slice(0, 5) + (r.note ? ' · ' + Utils.esc(r.note) : '') + '</div></div>' +
        '<span class="badge ' + st.cls + '">' + st.label + '</span>' +
        (pulseSt ? '<span class="badge ' + pulseSt.cls + '">' + pulseSt.label + '</span>' : '') +
        '<button class="icon-btn" data-del-bp="' + r.id + '"><svg class="ico ico-sm"><use href="#i-trash"/></svg></button></div>';
    }).join('');

    return [
      '<div class="card stat-card">',
      '  <div class="stat-label">最近血压</div>',
      '  <div class="mt8"><span class="stat-value num">' + (latest ? latest.sys + '/' + latest.dia : '--/--') + '</span><span class="stat-unit">mmHg</span></div>',
      latestSt ? '<div class="mt8"><span class="badge ' + latestSt.cls + '">' + latestSt.label + '</span></div>' : '',
      '  <div class="mt12 small muted">孕期正常血压：< 130/85 mmHg；≥140/90 需警惕妊娠高血压</div>',
      '</div>',
      '<div class="card">',
      '  <div class="card-title">记录血压</div>',
      '  <div class="row mb12"><div class="field grow"><label class="label">收缩压(高压)</label><input class="input input-lg" id="bp-sys" type="number" inputmode="numeric" placeholder="如 120"></div>' +
      '  <div class="field grow"><label class="label">舒张压(低压)</label><input class="input input-lg" id="bp-dia" type="number" inputmode="numeric" placeholder="如 80"></div></div>',
      '  <div class="field mb12"><label class="label">脉搏（次/分，选填）</label><input class="input" id="bp-pulse" type="number" inputmode="numeric" placeholder="如 78"></div>',
      '  <div class="row"><input class="input grow" id="bp-date" type="date" value="' + Utils.todayStr() + '">' +
      '  <input class="input grow" id="bp-time" type="time" value="' + Utils.timeStr() + '"></div>',
      '  <div class="field mt12"><label class="label">备注</label><input class="input" id="bp-note" placeholder="如：晨起、服药后"></div>',
      '  <button class="btn btn-primary btn-block mt12" id="bp-save">保存血压</button>',
      '</div>',
      '<div class="card"><div class="card-title">历史记录</div>',
      rows || '<div class="empty-state"><p>还没有血压记录</p></div></div>'
    ].join('');
  }

  function mountBP(c) {
    c.querySelector('#bp-save').addEventListener('click', () => {
      const sys = parseInt(c.querySelector('#bp-sys').value);
      const dia = parseInt(c.querySelector('#bp-dia').value);
      if (!sys || !dia || sys < 50 || sys > 250 || dia < 30 || dia > 200) {
        Utils.toast('请输入有效血压值', 'error'); return;
      }
      const pulseEl = c.querySelector('#bp-pulse');
      const pulse = pulseEl && pulseEl.value ? parseInt(pulseEl.value) : null;
      if (pulse && (pulse < 30 || pulse > 220)) { Utils.toast('请输入有效脉搏值', 'error'); return; }
      const rec = {
        id: Utils.uid(), date: c.querySelector('#bp-date').value,
        time: c.querySelector('#bp-time').value, sys: sys, dia: dia,
        note: c.querySelector('#bp-note').value.trim(),
        pulse: pulse
      };
      const list = pressures(); list.push(rec); Store.set('bloodPressure', list);
      const st = Data.bpStatus(sys, dia);
      const pulseSt = pulse ? Data.pulseStatus(pulse) : null;
      const msg = '血压已保存（' + st.label + (pulseSt ? '，脉搏' + pulseSt.label : '') + '）';
      Utils.toast(msg, st.cls === 'badge-red' || (pulseSt && pulseSt.cls === 'badge-red') ? 'error' : 'success');
      App.reload();
    });
    c.querySelectorAll('[data-del-bp]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.delBp;
      App.confirm('删除这条血压记录？', () => {
        Store.set('bloodPressure', pressures().filter((r) => r.id !== id));
        Utils.toast('已删除', 'success'); App.reload();
      });
    }));
  }

  /* ---------- 胎动计数 ---------- */
  function kickHTML() {
    const list = kicks().slice().sort(Utils.byDateDesc);
    const rows = list.slice(0, 20).map((r) => {
      const rate = r.duration > 0 ? (r.count / (r.duration / 60)).toFixed(1) : '--';
      const status = r.count >= 10 ? { label: '正常', cls: 'badge-green' } :
        r.count >= 4 ? { label: '偏少', cls: 'badge-yellow' } : { label: '需关注', cls: 'badge-red' };
      return '<div class="list-item"><div class="li-ico"><svg class="ico ico-sm"><use href="#i-activity"/></svg></div>' +
        '<div class="grow"><div class="li-title num">' + r.count + ' 次 <span class="small muted">/ ' + r.duration + '分钟</span></div>' +
        '<div class="li-sub">' + Utils.fmtDateCN(r.date) + ' ' + (r.startTime || '') + '-' + (r.endTime || '') + '（约' + rate + '次/小时）' +
        (r.note ? ' · ' + Utils.esc(r.note) : '') + '</div></div>' +
        '<span class="badge ' + status.cls + '">' + status.label + '</span>' +
        '<button class="icon-btn" data-del-kick="' + r.id + '"><svg class="ico ico-sm"><use href="#i-trash"/></svg></button></div>';
    }).join('');

    return [
      '<div class="card">',
      '  <div class="card-title"><svg class="ico"><use href="#i-activity"/></svg>胎动计数器</div>',
      '  <div class="kick-counter" id="kick-counter">',
      '    <div class="kick-count"><span id="kick-num" class="num">0</span><span class="kick-unit">次</span></div>',
      '    <div class="kick-time"><span id="kick-elapsed">00:00</span></div>',
      '    <button class="kick-btn" id="kick-tap"><svg class="ico ico-xl"><use href="#i-activity"/></svg><br>感受到胎动<br>点这里</button>',
      '    <div class="kick-controls">',
      '      <button class="btn btn-primary" id="kick-start">开始计数</button>',
      '      <button class="btn btn-ghost" id="kick-stop" disabled>结束并保存</button>',
      '      <button class="btn btn-ghost" id="kick-reset">重置</button>',
      '    </div>',
      '  </div>',
      '  <div class="small muted mt12">建议：餐后2小时内计数，达到10次即为正常。若2小时内不足10次或胎动明显减少，请及时就医。</div>',
      '</div>',
      '<div class="card">',
      '  <div class="card-title">手动记录</div>',
      '  <div class="row"><div class="field grow"><label class="label">日期</label><input class="input" type="date" id="kick-date" value="' + Utils.todayStr() + '"></div>' +
      '  <div class="field grow"><label class="label">时长(分钟)</label><input class="input" type="number" id="kick-duration" value="60" inputmode="numeric"></div></div>',
      '  <div class="row"><div class="field grow"><label class="label">胎动次数</label><input class="input" type="number" id="kick-count" inputmode="numeric" placeholder="次数"></div>' +
      '  <div class="field grow"><label class="label">备注</label><input class="input" id="kick-manual-note" placeholder="选填"></div></div>',
      '  <button class="btn btn-primary btn-block mt12" id="kick-manual-save">保存</button>',
      '</div>',
      '<div class="card"><div class="card-title">历史记录</div>',
      rows || '<div class="empty-state"><p>还没有胎动记录</p></div></div>'
    ].join('');
  }

  let kickTimer = null, kickSeconds = 0, kickCount = 0, kickRunning = false;

  function mountKick(c) {
    const numEl = c.querySelector('#kick-num');
    const elapsedEl = c.querySelector('#kick-elapsed');
    const startBtn = c.querySelector('#kick-start');
    const stopBtn = c.querySelector('#kick-stop');
    const resetBtn = c.querySelector('#kick-reset');
    const tapBtn = c.querySelector('#kick-tap');

    const updateElapsed = () => {
      const m = Math.floor(kickSeconds / 60), s = kickSeconds % 60;
      elapsedEl.textContent = Utils.pad(m) + ':' + Utils.pad(s);
    };

    startBtn.addEventListener('click', () => {
      if (kickRunning) return;
      kickRunning = true; kickCount = 0; kickSeconds = 0;
      numEl.textContent = '0'; updateElapsed();
      kickTimer = setInterval(() => { kickSeconds++; updateElapsed(); }, 1000);
      startBtn.disabled = true; stopBtn.disabled = false;
      tapBtn.disabled = false;
    });

    tapBtn.addEventListener('click', () => {
      if (!kickRunning) return;
      kickCount++;
      numEl.textContent = kickCount;
      if (navigator.vibrate) navigator.vibrate(50);
    });

    stopBtn.addEventListener('click', () => {
      if (!kickRunning) return;
      clearInterval(kickTimer); kickRunning = false;
      startBtn.disabled = false; stopBtn.disabled = true;
      const now = new Date();
      const endTime = Utils.timeStr(now);
      const startTime = Utils.timeStr(new Date(now.getTime() - kickSeconds * 1000));
      if (kickCount > 0) {
        const rec = {
          id: Utils.uid(), date: Utils.todayStr(),
          startTime: startTime, endTime: endTime,
          duration: Math.max(1, Math.round(kickSeconds / 60)),
          count: kickCount, note: ''
        };
        const list = kicks(); list.push(rec); Store.set('kickCounts', list);
        Utils.toast('已保存 ' + kickCount + ' 次胎动', 'success');
        App.reload();
      } else {
        Utils.toast('未记录到胎动', 'info');
      }
    });

    resetBtn.addEventListener('click', () => {
      clearInterval(kickTimer); kickRunning = false; kickCount = 0; kickSeconds = 0;
      numEl.textContent = '0'; updateElapsed();
      startBtn.disabled = false; stopBtn.disabled = true;
    });

    c.querySelector('#kick-manual-save').addEventListener('click', () => {
      const count = parseInt(c.querySelector('#kick-count').value);
      const duration = parseInt(c.querySelector('#kick-duration').value);
      if (!count || count < 0) { Utils.toast('请输入有效次数', 'error'); return; }
      const rec = {
        id: Utils.uid(), date: c.querySelector('#kick-date').value,
        startTime: '', endTime: '', duration: duration || 60,
        count: count, note: c.querySelector('#kick-manual-note').value.trim()
      };
      const list = kicks(); list.push(rec); Store.set('kickCounts', list);
      Utils.toast('胎动记录已保存', 'success');
      App.reload();
    });

    c.querySelectorAll('[data-del-kick]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.delKick;
      App.confirm('删除这条胎动记录？', () => {
        Store.set('kickCounts', kicks().filter((r) => r.id !== id));
        Utils.toast('已删除', 'success'); App.reload();
      });
    }));
  }

  /* ---------- 宫缩计时 ---------- */
  function parseStamp(date, time) {
    const p = (date || '').split('-').map(Number);
    const t = (time || '00:00').split(':').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1, t[0] || 0, t[1] || 0, 0).getTime();
  }

  function fmtDuration(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    return Utils.pad(Math.floor(sec / 60)) + ':' + Utils.pad(sec % 60);
  }

  function contractionInterval(startStamp) {
    const latest = contractions().slice().sort((a, b) => {
      return parseStamp(b.date, b.startTime) - parseStamp(a.date, a.startTime);
    })[0];
    if (!latest) return null;
    const prev = parseStamp(latest.date, latest.startTime);
    if (!prev || !startStamp || startStamp <= prev) return null;
    return Math.round((startStamp - prev) / 60000);
  }

  function contractionHTML() {
    const week = Store.get('user').gestationalWeek || '';
    const list = contractions().slice().sort((a, b) => parseStamp(b.date, b.startTime) - parseStamp(a.date, a.startTime));
    const rows = list.slice(0, 30).map((r) => {
      const st = Data.contractionStatus(r.durationSec, r.intervalMin, week);
      return '<div class="list-item"><div class="li-ico"><svg class="ico ico-sm"><use href="#i-clock"/></svg></div>' +
        '<div class="grow"><div class="li-title num">' + fmtDuration(r.durationSec) +
          '<span class="small muted"> 持续</span>' +
          (r.intervalMin ? '<span class="small muted"> · 间隔' + r.intervalMin + '分</span>' : '') +
          (r.intensity ? '<span class="small muted"> · ' + Utils.esc(r.intensity) + '</span>' : '') + '</div>' +
        '<div class="li-sub">' + Utils.fmtDateCN(r.date) + ' ' + (r.startTime || '') +
          (r.note ? ' · ' + Utils.esc(r.note) : '') + '</div>' +
        (st.desc ? '<div class="small muted mt4">' + st.desc + '</div>' : '') + '</div>' +
        '<span class="badge ' + st.cls + '">' + st.label + '</span>' +
        '<button class="icon-btn" data-del-ctr="' + r.id + '"><svg class="ico ico-sm"><use href="#i-trash"/></svg></button></div>';
    }).join('');

    return [
      '<div class="card">',
      '  <div class="card-title"><svg class="ico"><use href="#i-clock"/></svg>宫缩计时器</div>',
      '  <div class="kick-counter" id="ctr-counter">',
      '    <div class="kick-count"><span id="ctr-elapsed" class="num">00:00</span></div>',
      '    <div class="kick-time" id="ctr-status">点击“宫缩开始”计时</div>',
      '    <div class="kick-controls">',
      '      <button class="btn btn-primary" id="ctr-start">宫缩开始</button>',
      '      <button class="btn btn-ghost" id="ctr-stop" disabled>宫缩结束并保存</button>',
      '      <button class="btn btn-ghost" id="ctr-reset">重置</button>',
      '    </div>',
      '  </div>',
      '  <div class="row mt12"><div class="field grow"><label class="label">强度</label><select class="input" id="ctr-intensity"><option value="">选填</option><option>弱</option><option>中</option><option>强</option></select></div>' +
      '  <div class="field grow"><label class="label">备注</label><input class="input" id="ctr-note" placeholder="如：休息后缓解"></div></div>',
      '  <div class="small muted mt12">记录每次宫缩开始到结束的持续时间，以及距离上一次宫缩开始的间隔。未足月（&lt;37周）若10分钟内规律出现，请尽快就医。</div>',
      '</div>',
      '<div class="card">',
      '  <div class="card-title">手动记录</div>',
      '  <div class="row"><div class="field grow"><label class="label">日期</label><input class="input" type="date" id="ctr-date" value="' + Utils.todayStr() + '"></div>' +
      '  <div class="field grow"><label class="label">开始时间</label><input class="input" type="time" id="ctr-start-time" value="' + Utils.timeStr() + '"></div></div>',
      '  <div class="row"><div class="field grow"><label class="label">持续(分)</label><input class="input" type="number" id="ctr-dur-min" min="0" inputmode="numeric" placeholder="0"></div>' +
      '  <div class="field grow"><label class="label">持续(秒)</label><input class="input" type="number" id="ctr-dur-sec" min="0" max="59" inputmode="numeric" placeholder="如 45"></div>' +
      '  <div class="field grow"><label class="label">间隔(分)</label><input class="input" type="number" id="ctr-interval" min="0" inputmode="numeric" placeholder="自动"></div></div>',
      '  <div class="row"><div class="field grow"><label class="label">强度</label><select class="input" id="ctr-manual-intensity"><option value="">选填</option><option>弱</option><option>中</option><option>强</option></select></div>' +
      '  <div class="field grow"><label class="label">备注</label><input class="input" id="ctr-manual-note" placeholder="选填"></div></div>',
      '  <button class="btn btn-primary btn-block mt12" id="ctr-manual-save">保存宫缩记录</button>',
      '</div>',
      '<div class="card"><div class="card-title">历史记录</div>',
      rows || '<div class="empty-state"><p>还没有宫缩记录</p></div></div>'
    ].join('');
  }

  let ctrTimer = null, ctrStartStamp = 0, ctrRunning = false;

  function mountContraction(c) {
    const elapsedEl = c.querySelector('#ctr-elapsed');
    const statusEl = c.querySelector('#ctr-status');
    const startBtn = c.querySelector('#ctr-start');
    const stopBtn = c.querySelector('#ctr-stop');
    const resetBtn = c.querySelector('#ctr-reset');

    const tick = () => {
      const sec = ctrStartStamp ? Math.round((Date.now() - ctrStartStamp) / 1000) : 0;
      elapsedEl.textContent = fmtDuration(sec);
    };

    startBtn.addEventListener('click', () => {
      if (ctrRunning) return;
      ctrStartStamp = Date.now();
      ctrRunning = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      statusEl.textContent = '宫缩进行中，结束时点击保存';
      tick();
      ctrTimer = setInterval(tick, 250);
      if (navigator.vibrate) navigator.vibrate(80);
    });

    const resetTimer = () => {
      clearInterval(ctrTimer);
      ctrRunning = false;
      ctrStartStamp = 0;
      elapsedEl.textContent = '00:00';
      statusEl.textContent = '点击“宫缩开始”计时';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    };

    stopBtn.addEventListener('click', () => {
      if (!ctrRunning) return;
      const durationSec = Math.max(1, Math.round((Date.now() - ctrStartStamp) / 1000));
      const start = new Date(ctrStartStamp);
      const intervalMin = contractionInterval(ctrStartStamp);
      const rec = {
        id: Utils.uid(),
        date: Utils.dateStr(start),
        startTime: Utils.timeStr(start),
        durationSec: durationSec,
        intervalMin: intervalMin,
        intensity: c.querySelector('#ctr-intensity').value,
        note: c.querySelector('#ctr-note').value.trim()
      };
      clearInterval(ctrTimer);
      const list = contractions(); list.push(rec); Store.set('contractions', list);
      const st = Data.contractionStatus(durationSec, intervalMin, Store.get('user').gestationalWeek);
      Utils.toast('宫缩已保存（' + st.label + '）', st.cls === 'badge-red' ? 'error' : 'success');
      App.reload();
    });

    resetBtn.addEventListener('click', resetTimer);

    c.querySelector('#ctr-manual-save').addEventListener('click', () => {
      const date = c.querySelector('#ctr-date').value;
      const startTime = c.querySelector('#ctr-start-time').value;
      const dm = parseInt(c.querySelector('#ctr-dur-min').value) || 0;
      const ds = parseInt(c.querySelector('#ctr-dur-sec').value) || 0;
      const durationSec = dm * 60 + ds;
      if (!date || !startTime) { Utils.toast('请选择日期和开始时间', 'error'); return; }
      if (durationSec <= 0) { Utils.toast('请输入有效持续时间', 'error'); return; }
      const stamp = parseStamp(date, startTime);
      const intervalInput = parseInt(c.querySelector('#ctr-interval').value);
      const rec = {
        id: Utils.uid(), date: date, startTime: startTime,
        durationSec: durationSec,
        intervalMin: !isNaN(intervalInput) && intervalInput >= 0 ? intervalInput : contractionInterval(stamp),
        intensity: c.querySelector('#ctr-manual-intensity').value,
        note: c.querySelector('#ctr-manual-note').value.trim()
      };
      const list = contractions(); list.push(rec); Store.set('contractions', list);
      const st = Data.contractionStatus(durationSec, rec.intervalMin, Store.get('user').gestationalWeek);
      Utils.toast('宫缩已保存（' + st.label + '）', st.cls === 'badge-red' ? 'error' : 'success');
      App.reload();
    });

    c.querySelectorAll('[data-del-ctr]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.delCtr;
      App.confirm('删除这条宫缩记录？', () => {
        Store.set('contractions', contractions().filter((r) => r.id !== id));
        Utils.toast('已删除', 'success'); App.reload();
      });
    }));
  }

  /* ---------- 导出产检数据 ---------- */
  function exportPrenatalCSV() {
    const lines = ['产检数据导出 ' + Utils.todayStr(), '']; ;

    // B超
    lines.push('=== B超胎儿测量 ===');
    lines.push('日期,孕周,宝宝,BPD(mm),HC(mm),AC(mm),FL(mm),EFW(g)');
    scans().slice().sort(Utils.byDateDesc).forEach((r) => {
      ['baby1', 'baby2'].forEach((bk, bi) => {
        const b = r[bk]; if (!b) return;
        const efw = Data.calcEFW(b.bpd, b.hc, b.ac, b.fl);
        lines.push([r.date, r.gestWeek || '', babyName(bi), b.bpd || '', b.hc || '', b.ac || '', b.fl || '', efw || ''].join(','));
      });
    });
    lines.push('');

    // 双胎差异
    if (isTwin()) {
      lines.push('=== 双胎体重差异 ===');
      lines.push('日期,孕周,' + babyName(0) + '(g),' + babyName(1) + '(g),差异(%),判定');
      scans().slice().sort(Utils.byDateDesc).forEach((r) => {
        const w1 = r.baby1 ? Data.calcEFW(r.baby1.bpd, r.baby1.hc, r.baby1.ac, r.baby1.fl) : null;
        const w2 = r.baby2 ? Data.calcEFW(r.baby2.bpd, r.baby2.hc, r.baby2.ac, r.baby2.fl) : null;
        if (w1 && w2) {
          const disc = Data.twinDiscordance(w1, w2);
          const lv = Data.discordanceLevel(disc);
          lines.push([r.date, r.gestWeek || '', w1, w2, disc, lv.label].join(','));
        }
      });
      lines.push('');
    }

    // 羊水
    lines.push('=== 羊水记录 ===');
    lines.push('日期,宝宝,类型,数值(cm),判定,备注');
    fluids().slice().sort(Utils.byDateDesc).forEach((r) => {
      const st = Data.amnioticStatus(r.type, r.value);
      lines.push([r.date, r.baby != null ? babyName(r.baby) : '', r.type.toUpperCase(), r.value, st.label, r.note || ''].join(','));
    });
    lines.push('');

    // 血压
    lines.push('=== 血压记录 ===');
    lines.push('日期,时间,收缩压,舒张压,脉搏,血压判定,脉搏判定,备注');
    pressures().slice().sort(Utils.byDateDesc).forEach((r) => {
      const st = Data.bpStatus(r.sys, r.dia);
      const pulseSt = r.pulse ? Data.pulseStatus(r.pulse) : null;
      lines.push([r.date, r.time || '', r.sys, r.dia, r.pulse || '', st.label, pulseSt ? pulseSt.label : '', r.note || ''].join(','));
    });
    lines.push('');

    // 产检
    lines.push('=== 产检记录 ===');
    checkups().slice().sort(Utils.byDateDesc).forEach((r) => {
      lines.push('日期: ' + r.date + (r.gestWeek ? '  孕周: ' + r.gestWeek : '') + (r.hospital ? '  医院: ' + r.hospital : ''));
      Object.entries(r.items || {}).forEach(([k, v]) => {
        const def = Data.CHECKUP_ITEMS.find((i) => i.key === k);
        lines.push('  ' + (def ? def.label : k) + ': ' + v + (def && def.unit ? ' ' + def.unit : ''));
      });
      // 按宝宝分别记录的项目
      Object.entries(r.babies || {}).forEach(([idx, b]) => {
        Object.entries(b || {}).forEach(([k, v]) => {
          const def = Data.CHECKUP_ITEMS.find((i) => i.key === k);
          lines.push('  [' + babyName(Number(idx)) + '] ' + (def ? def.label : k) + ': ' + v + (def && def.unit ? ' ' + def.unit : ''));
        });
      });
      Object.entries(r.custom || {}).forEach(([k, v]) => lines.push('  [自定义] ' + k + ': ' + v));
      if (r.note) lines.push('  备注: ' + r.note);
      lines.push('');
    });

    // 胎动
    lines.push('=== 胎动记录 ===');
    lines.push('日期,开始,结束,时长(分),次数,备注');
    kicks().slice().sort(Utils.byDateDesc).forEach((r) => {
      lines.push([r.date, r.startTime || '', r.endTime || '', r.duration, r.count, r.note || ''].join(','));
    });
    lines.push('');

    // 宫缩
    lines.push('=== 宫缩记录 ===');
    lines.push('日期,开始时间,持续(秒),间隔(分),强度,判定,备注');
    contractions().slice().sort((a, b) => parseStamp(b.date, b.startTime) - parseStamp(a.date, a.startTime)).forEach((r) => {
      const st = Data.contractionStatus(r.durationSec, r.intervalMin, Store.get('user').gestationalWeek);
      lines.push([r.date, r.startTime || '', r.durationSec, r.intervalMin || '', r.intensity || '', st.label, r.note || ''].join(','));
    });

    Utils.download('产检数据_' + Utils.todayStr() + '.csv', lines.join('\n'), 'text/csv;charset=utf-8');
    Utils.toast('产检数据已导出', 'success');
  }

  /* ---------- 视图 ---------- */
  const PrenatalView = {
    render() {
      const tab = App.state.prenatalTab || 'ultrasound';
      const seg = TABS.map((t) =>
        '<button data-ptab="' + t.key + '" class="' + (tab === t.key ? 'active' : '') + '">' + t.label + '</button>'
      ).join('');

      let panel = '';
      if (tab === 'ultrasound') panel = ultrasoundHTML();
      else if (tab === 'amniotic') panel = amnioticHTML();
      else if (tab === 'checkup') panel = checkupHTML();
      else if (tab === 'bp') panel = bpHTML();
      else if (tab === 'kick') panel = kickHTML();
      else if (tab === 'contraction') panel = contractionHTML();

      return [
        '<div class="seg seg-scroll mb16" id="prenatal-seg">' + seg + '</div>',
        '<div id="prenatal-panel">' + panel + '</div>',
        '<div class="card mt16"><button class="btn btn-soft btn-block" id="prenatal-export"><svg class="ico ico-sm" style="vertical-align:-2px"><use href="#i-download"/></svg> 导出全部产检数据（CSV）</button></div>'
      ].join('');
    },

    mount(c) {
      const tab = App.state.prenatalTab || 'ultrasound';
      c.querySelector('#prenatal-seg').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        App.state.prenatalTab = b.dataset.ptab; App.reload();
      }));
      if (tab === 'ultrasound') mountUltrasound(c);
      else if (tab === 'amniotic') mountAmniotic(c);
      else if (tab === 'checkup') mountCheckup(c);
      else if (tab === 'bp') mountBP(c);
      else if (tab === 'kick') mountKick(c);
      else if (tab === 'contraction') mountContraction(c);

      c.querySelector('#prenatal-export').addEventListener('click', exportPrenatalCSV);
    }
  };

  global.PrenatalView = PrenatalView;
})(window);
