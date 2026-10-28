/* 逻辑单测：血糖阈值解析（Data.resolveSugar / App.sugarStatusText）
 * 模拟 localStorage 与最小 DOM，加载真实源码后断言判定结果 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const WWW = path.join(__dirname, '..', 'www');

const storage = {};
const localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};
const sandbox = {
  console,
  setTimeout,
  document: { addEventListener() {}, readyState: 'loading', getElementById: () => null },
  navigator: {},
  localStorage
};
sandbox.window = sandbox;
sandbox.window.localStorage = localStorage;
vm.createContext(sandbox);

['js/data.js', 'js/store.js', 'js/charts.js', 'js/views/records.js', 'js/views/diet.js',
 'js/views/medication.js', 'js/views/prenatal.js', 'js/app.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(WWW, f), 'utf8'), sandbox, { filename: f });
});

const W = sandbox.window;
const Store = W.Store, Data = W.Data, App = W.App;
Store.init();

let pass = 0, fail = 0;
function eq(actual, expected, msg) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log('  ok  ' + msg); }
  else { fail++; console.log('FAIL  ' + msg + '\n      expected=' + JSON.stringify(expected) + ' actual=' + JSON.stringify(actual)); }
}

function setMode(mode, applyModeDefaults) {
  const u = Store.get('user'); u.userMode = mode; Store.set('user', u);
  if (applyModeDefaults) {
    // 模拟设置页「切换模式」后写入的默认目标（旧版行为：2h 上限写入 afterMealHigh）
    const ref = Data.getReference(mode);
    const s = Store.get('settings');
    s.healthGoals = Object.assign({}, s.healthGoals, {
      sugarFastingLow: ref.bloodSugar.fasting.low,
      sugarFastingHigh: ref.bloodSugar.fasting.high,
      sugarAfterMealLow: ref.bloodSugar.afterMeal2h.low,
      sugarAfterMealHigh: ref.bloodSugar.afterMeal2h.high,
      sugarRandomHigh: ref.bloodSugar.random.high,
      sugarLowWarn: ref.bloodSugar.fasting.low
    });
    Store.set('settings', s);
  }
}

console.log('== 孕期模式（默认目标，模拟旧数据：无 sugar1hHigh） ==');
setMode('pregnancy', true);

eq(Data.resolveSugar('afterMeal1h').high, 7.8, '餐后1h 上限取模式标准 7.8（不再用2h的6.7）');
eq(App.sugarStatusText({ scene: 'afterMeal1h', value: 6.9 }).label, '正常', '用户场景：孕期餐后1h 6.9 → 正常');
eq(App.sugarStatusText({ scene: 'afterMeal1h', value: 7.9 }).label, '偏高', '孕期餐后1h 7.9 → 偏高');
eq(App.sugarStatusText({ scene: 'afterMeal2h', value: 6.9 }).label, '偏高', '孕期餐后2h 6.9 → 偏高（上限6.7不变）');
eq(App.sugarStatusText({ scene: 'afterMeal2h', value: 6.5 }).label, '正常', '孕期餐后2h 6.5 → 正常');
eq(App.sugarStatusText({ scene: 'fasting', value: 5.5 }).label, '偏高', '孕期空腹 5.5 → 偏高');
eq(App.sugarStatusText({ scene: 'fasting', value: 3.2 }).label, '低血糖', '孕期空腹 3.2 → 低于预警值3.3判低血糖');
eq(App.sugarStatusText({ scene: 'afterMeal3h', value: 5.5 }).label, '偏高', '孕期餐后3h 5.5 → 偏高（回落到空腹5.3）');
eq(App.sugarStatusText({ scene: 'afterMeal3h', value: 5.2 }).label, '正常', '孕期餐后3h 5.2 → 正常');
eq(App.sugarStatusText({ scene: 'afterMealCustom', value: 5.5, customHours: 4 }).label, '偏高', '自定义餐后4h 5.5 → 按空腹标准偏高');
eq(App.sugarStatusText({ scene: 'afterMealCustom', value: 6.0, customHours: 2.5 }).label, '正常', '自定义餐后2.5h 6.0 → 按餐后标准正常');
eq(App.sugarStatusText({ scene: 'bedtime', value: 6.5 }).label, '正常', '孕期睡前 6.5 → 正常');
eq(App.sugarStatusText({ scene: 'random', value: 7.5 }).label, '正常', '孕期随机 7.5 → 正常');
eq(App.sugarStatusText({ scene: 'random', value: 8.0 }).label, '偏高', '孕期随机 8.0 → 偏高');
{
  // 单独验证自定义低血糖预警阈值
  const s = Store.get('settings'); s.healthGoals.sugarLowWarn = 3.9; Store.set('settings', s);
  eq(App.sugarStatusText({ scene: 'fasting', value: 3.5 }).label, '低血糖', '自定义预警3.9：空腹 3.5 → 低血糖');
  s.healthGoals.sugarLowWarn = 3.3; Store.set('settings', s);
}

console.log('== 通用模式（默认目标） ==');
setMode('general', true);
eq(Data.resolveSugar('afterMeal1h').high, 9.0, '通用餐后1h 上限取模式标准 9.0');
eq(App.sugarStatusText({ scene: 'afterMeal1h', value: 8.5 }).label, '正常', '通用餐后1h 8.5 → 正常');
eq(App.sugarStatusText({ scene: 'afterMeal1h', value: 9.5 }).label, '偏高', '通用餐后1h 9.5 → 偏高');
eq(App.sugarStatusText({ scene: 'afterMeal2h', value: 7.5 }).label, '正常', '通用餐后2h 7.5 → 正常');
eq(App.sugarStatusText({ scene: 'fasting', value: 6.3 }).label, '偏高', '通用空腹 6.3 → 偏高');

console.log('== 自定义「餐后1h上限」覆盖 ==');
setMode('pregnancy', true);
{
  const s = Store.get('settings'); s.healthGoals.sugar1hHigh = 8.0; Store.set('settings', s);
}
eq(Data.resolveSugar('afterMeal1h').high, 8.0, '自定义1h上限 8.0 生效');
eq(App.sugarStatusText({ scene: 'afterMeal1h', value: 7.9 }).label, '正常', '1h 7.9 → 正常');
eq(Data.resolveSugar('afterMeal2h').high, 6.7, '2h 上限不受自定义1h影响（仍6.7）');
// 清掉自定义，回到默认
{
  const s = Store.get('settings'); delete s.healthGoals.sugar1hHigh; Store.set('settings', s);
}
eq(Data.resolveSugar('afterMeal1h').high, 7.8, '清空自定义后回到模式标准 7.8');

console.log('== Store.init 老数据迁移不产生 sugar1hHigh（避免覆盖模式标准） ==');
{
  const s = Store.get('settings');
  eq(s.healthGoals.sugar1hHigh, undefined, '默认配置不含硬编码 1h 上限');
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
