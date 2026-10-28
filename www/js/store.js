/* =====================================================================
 * store.js — 本地数据持久化层（localStorage）、通用工具、种子数据
 * ===================================================================== */
(function (global) {
  'use strict';

  const PREFIX = 'preg.';
  const KEYS = {
    user: 'user',
    weights: 'weights',
    sugars: 'sugars',
    diets: 'diets',
    meds: 'meds',
    medLogs: 'medLogs',
    customFoods: 'customFoods',
    settings: 'settings',
    fetalScans: 'fetalScans',       // B超胎儿测量数据
    amnioticFluid: 'amnioticFluid', // 羊水记录
    checkups: 'checkups',           // 产检记录（含常规+自定义项目）
    bloodPressure: 'bloodPressure', // 血压记录
    kickCounts: 'kickCounts',       // 胎动计数
    contractions: 'contractions'    // 宫缩计时记录
  };

  const Store = {
    get(key, def) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        if (raw === null) return def;
        return JSON.parse(raw);
      } catch (e) {
        return def;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(val));
        return true;
      } catch (e) {
        console.error('存储失败', e);
        return false;
      }
    },
    remove(key) { localStorage.removeItem(PREFIX + key); },
    clearAll() {
      Object.values(KEYS).forEach((k) => localStorage.removeItem(PREFIX + k));
    }
  };

  /* ---------- 默认设置 ---------- */
  const DEFAULT_MEAL_TIMES = { breakfast: '07:30', lunch: '12:00', dinner: '18:00', snack: '15:00' };

  const DEFAULT_SETTINGS = {
    theme: 'system',            // light | dark | system
    unit: 'kg',                 // kg | lb
    sugarUnit: 'mmol',          // mmol | mgdl
    classifyStrict: false,      // 红绿灯严格控糖模式
    quickActions: ['weight', 'sugar', 'diet', 'med'],
    reminderSound: 'chime',
    reminderVibration: true,
    notifyEnabled: true,        // 默认开启用药提醒
    mealTimes: DEFAULT_MEAL_TIMES,  // 用餐时间点（用于餐后用药联动）
    // 健康目标（用户可自定义）
    healthGoals: {
      weightTarget: '',         // 目标体重 kg（空=自动按BMI算）
      weightLow: '',            // 体重下限 kg
      weightHigh: '',           // 体重上限 kg
      weeklyGainMax: 0.5,       // 每周最大增重 kg
      weeklyLossMax: 0.5,       // 每周最大减重 kg
      sugarFastingLow: 3.9,     // 空腹血糖下限 mmol/L
      sugarFastingHigh: 6.1,    // 空腹血糖上限 mmol/L
      sugarAfterMealLow: 3.9,   // 餐后血糖下限
      sugarAfterMealHigh: 7.8,  // 餐后2h血糖上限
      sugarRandomHigh: 11.1,    // 随机血糖高限
      sugarLowWarn: 3.9,        // 低血糖预警值
      calorieTarget: 2000,      // 每日热量目标 kcal
      weightGoalMode: 'maintain' // lose | maintain | gain
    }
  };

  const DEFAULT_USER = {
    name: '',
    userMode: 'general',        // general 通用健康管理 | pregnancy 孕期模式
    gestationalWeek: '',        // 孕周（孕期模式）
    twinType: 'unknown',        // single 单胎 | monochorionic 单绒双胎 | dichorionic 双绒双胎 | unknown
    babyNames: [],              // 宝宝昵称（[大宝, 二宝]，双胎两项，单胎第一项）
    preWeight: '',              // 孕前体重 kg（孕期模式）
    height: '',                 // 身高 cm
    birthYear: '',              // 出生年份（通用模式，可选）
    gender: '',                 // 性别（通用模式，可选）
    onInsulin: false,
    activityLevel: 'light'      // light | moderate | active（活动量）
  };

  /* ---------- 默认用药（孕期三药方案，仅孕期模式预置） ---------- */
  function seedMeds() {
    const pick = (generic) => Data.DRUGS.find((d) => d.generic === generic);
    const now = new Date().toISOString();
    return [
      Object.assign({}, pick('左甲状腺素钠片'), { id: uid(), createdAt: now, enabled: true, sound: 'chime', vibration: true }),
      Object.assign({}, pick('琥珀酸亚铁片'), { id: uid(), createdAt: now, enabled: true, sound: 'chime', vibration: true, mealRef: 'lunch', offsetMin: 30 }),
      Object.assign({}, pick('碳酸钙D3片'), { id: uid(), createdAt: now, enabled: true, sound: 'chime', vibration: true })
    ];
  }

  function init() {
    let s = Store.get(KEYS.settings, null);
    if (!s) {
      s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    } else {
      // 老数据迁移：补齐新增字段
      s = Object.assign({}, DEFAULT_SETTINGS, s);
      if (!s.mealTimes) s.mealTimes = Object.assign({}, DEFAULT_MEAL_TIMES);
      else s.mealTimes = Object.assign({}, DEFAULT_MEAL_TIMES, s.mealTimes);
      // 迁移健康目标
      if (!s.healthGoals) s.healthGoals = Object.assign({}, DEFAULT_SETTINGS.healthGoals);
      else s.healthGoals = Object.assign({}, DEFAULT_SETTINGS.healthGoals, s.healthGoals);
    }
    Store.set(KEYS.settings, s);

    let u = Store.get(KEYS.user, null);
    if (!u) {
      Store.set(KEYS.user, DEFAULT_USER);
    } else {
      // 老用户迁移：补字段
      u = Object.assign({}, DEFAULT_USER, u);
      // 老版本默认是孕期模式
      if (!u.userMode) u.userMode = (u.gestationalWeek || u.twinType === 'dichorionic') ? 'pregnancy' : 'general';
      Store.set(KEYS.user, u);
      // 孕期模式才预置用药
      if (u.userMode === 'pregnancy' && !Store.get(KEYS.meds, null)) {
        Store.set(KEYS.meds, seedMeds());
      }
    }
    if (!Store.get(KEYS.meds, null)) Store.set(KEYS.meds, []);
    if (!Store.get(KEYS.weights, null)) Store.set(KEYS.weights, []);
    if (!Store.get(KEYS.sugars, null)) Store.set(KEYS.sugars, []);
    if (!Store.get(KEYS.diets, null)) Store.set(KEYS.diets, []);
    if (!Store.get(KEYS.medLogs, null)) Store.set(KEYS.medLogs, []);
    if (!Store.get(KEYS.customFoods, null)) Store.set(KEYS.customFoods, []);
    if (!Store.get(KEYS.fetalScans, null)) Store.set(KEYS.fetalScans, []);
    if (!Store.get(KEYS.amnioticFluid, null)) Store.set(KEYS.amnioticFluid, []);
    if (!Store.get(KEYS.checkups, null)) Store.set(KEYS.checkups, []);
    if (!Store.get(KEYS.bloodPressure, null)) Store.set(KEYS.bloodPressure, []);
    if (!Store.get(KEYS.kickCounts, null)) Store.set(KEYS.kickCounts, []);
    if (!Store.get(KEYS.contractions, null)) Store.set(KEYS.contractions, []);
  }

  /* ---------- 通用工具 ---------- */
  function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function dateStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function nowStr() { return dateStr(new Date()); }
  function timeStr(d) {
    d = d || new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function todayStr() { return dateStr(new Date()); }

  function parseDate(s) { // 'YYYY-MM-DD'
    const p = (s || '').split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }

  function fmtDateCN(s) {
    const d = parseDate(s);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function fmtDateShort(s) { return (s || '').slice(5); } // MM-DD

  function kgToLb(kg) { return +(kg * 2.20462).toFixed(1); }
  function lbToKg(lb) { return +(lb / 2.20462).toFixed(1); }
  function mmolToMgdl(v) { return +(v * 18.018).toFixed(0); }
  function mgdlToMmol(v) { return +(v / 18.018).toFixed(1); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function round(v, n) { n = n == null ? 1 : n; return +Number(v).toFixed(n); }

  function byDateDesc(a, b) {
    const ka = (a.date || '') + ' ' + (a.time || '00:00');
    const kb = (b.date || '') + ' ' + (b.time || '00:00');
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  }

  /* 时间换算（HH:mm <-> 分钟） */
  function timeToMin(t) { const p = (t || '').split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); }
  function minToTime(m) { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function addMinToTime(t, delta) { return minToTime(timeToMin(t) + (delta || 0)); }

  /* UTF-8 文本 → base64 */
  function utf8Base64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  /* 原生环境：写文件并调起系统分享/保存 */
  function exportNative(filename, text) {
    try {
      const C = global.Capacitor;
      if (!C.Plugins.Filesystem) C.registerPlugin('Filesystem');
      if (!C.Plugins.Share) C.registerPlugin('Share');
      const FS = C.Plugins.Filesystem, SH = C.Plugins.Share;
      FS.writeFile({ path: filename, data: utf8Base64(text), directory: 'CACHE' })
        .then((res) => SH.share({ title: filename, files: [res.uri] }))
        .catch(() => toast('导出失败，请重试', 'error'));
    } catch (e) {
      toast('导出失败，请重试', 'error');
    }
  }

  /* 下载/导出文本文件（跨平台） */
  function download(filename, text, mime) {
    const C = global.Capacitor;
    if (C && C.isNativePlatform && C.isNativePlatform()) {
      exportNative(filename, text);
      return;
    }
    mime = mime || 'text/plain;charset=utf-8';
    const blob = new Blob(['\ufeff' + text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  function toast(msg, type) {
    const host = document.getElementById('toast-host');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast-' + type : '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => host.removeChild(el), 300);
    }, 2600);
  }

  global.Store = Store;
  global.Store.KEYS = KEYS;
  global.Store.init = init;
  global.Store.seedMeds = seedMeds;
  global.Store.DEFAULT_MEAL_TIMES = DEFAULT_MEAL_TIMES;
  global.Utils = {
    uid, pad, dateStr, nowStr, timeStr, todayStr, parseDate, fmtDateCN, fmtDateShort,
    kgToLb, lbToKg, mmolToMgdl, mgdlToMmol, esc, round, byDateDesc, download, toast,
    timeToMin, minToTime, addMinToTime
  };
})(window);
