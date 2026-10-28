/* =====================================================================
 * data.js — 内置数据：食物营养库、GI 分类、药品库、参考标准
 * 数据来源：《中国食物成分表（第6版）》、国家卫健委《体重管理指导原则
 * （2024年版）》、《中国2型糖尿病防治指南（2024）》、WS/T 428-2013
 * ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- 参考标准 ---------- */
  // 孕期标准（妊娠期糖尿病控制目标）
  const PREGNANCY_REF = {
    bloodSugar: {
      fasting: { low: 3.3, high: 5.3 },
      beforeMeal: { low: 3.3, high: 5.3 },
      afterMeal1h: { low: 3.3, high: 7.8 },
      afterMeal2h: { low: 3.3, high: 6.7 },
      afterMeal3h: { low: 3.3, high: 5.3 },
      afterMealCustom: { low: 3.3, high: 6.7 },
      random: { low: 3.3, high: 7.8 },
      bedtime: { low: 3.3, high: 6.7 }
    },
    hba1c: 6.0,
    calorie: { low: 2000, high: 2400, target: 2100 },
    macro: { carbPct: [45, 55], proteinPct: [15, 20], fatPct: [30, 35] },
    protein: { low: 90, high: 110 },
    fiber: { low: 25, high: 30 },
    twinGainTotal: [16.7, 24.3],
    twinGainWeekly: [0.5, 0.75]
  };

  // 通用成人标准（健康人 / 糖尿病前期 / 糖尿病管理通用参考）
  // 数据来源：国家卫健委2024健康素养、CDS2024指南、ADA2024标准
  const GENERAL_REF = {
    bloodSugar: {
      fasting: { low: 3.9, high: 6.1 },        // 正常空腹 3.9~6.1
      beforeMeal: { low: 3.9, high: 6.1 },     // 餐前
      afterMeal1h: { low: 3.9, high: 9.0 },    // 餐后1h峰值<11.1
      afterMeal2h: { low: 3.9, high: 7.8 },    // 餐后2h <7.8
      afterMeal3h: { low: 3.9, high: 6.1 },    // 餐后3h应回落到空腹水平
      afterMealCustom: { low: 3.9, high: 7.8 },// 自定义餐后
      random: { low: 3.9, high: 11.1 },        // 随机
      bedtime: { low: 3.9, high: 7.8 }         // 睡前
    },
    hba1c: 5.7,
    calorie: { low: 1500, high: 2500, target: 2000 },
    macro: { carbPct: [50, 60], proteinPct: [15, 20], fatPct: [20, 30] },
    protein: { low: 50, high: 80 },
    fiber: { low: 25, high: 30 },
    // BMI 分类（中国标准 WS/T 428-2013）
    bmi: { under: 18.5, normal: 24.0, overweight: 28.0 },
    // 体重管理目标（国家卫健委2024）
    weightLossWeeklyMax: 0.5,   // 每周减重≤0.5kg
    weightLoss3mPct: 0.05,      // 3个月减5%
    weightLoss6mPct: 0.10,      // 6个月减10%
    waistMale: 90,              // 男性腰围≥90cm为中心型肥胖
    waistFemale: 85             // 女性腰围≥85cm为中心型肥胖
  };

  // 根据用户模式返回参考标准
  function getReference(userMode) {
    return userMode === 'pregnancy' ? PREGNANCY_REF : GENERAL_REF;
  }

  /* 按场景解析血糖判定阈值（统一入口，供首页与记录页共用）
   * 规则：自定义目标优先，但不同场景只应用各自的上下限：
   * - 空腹/餐前：sugarFastingLow/High
   * - 餐后1h：sugar1hLow/High（独立字段，默认用所选模式标准，孕期 7.8）
   * - 餐后2h/睡前/自定义(<3h)：sugarAfterMealLow/High
   * - 餐后3h/自定义(≥3h)：应回落到空腹水平，用空腹标准
   * - 随机：下限沿用餐后下限，上限用 sugarRandomHigh
   */
  function resolveSugar(scene, customHours) {
    const Store = global.Store;
    const g = (Store.get('settings').healthGoals) || {};
    const R = getReference(Store.get('user').userMode).bloodSugar;
    const ref = R[scene] || R.random;
    let low = ref.low, high = ref.high;
    const apply = (lo, hi) => {
      if (lo !== '' && lo != null && !isNaN(Number(lo))) low = Number(lo);
      if (hi !== '' && hi != null && !isNaN(Number(hi))) high = Number(hi);
    };
    const customLate = customHours != null && Number(customHours) >= 3;
    if (scene === 'fasting' || scene === 'beforeMeal') {
      apply(g.sugarFastingLow, g.sugarFastingHigh);
    } else if (scene === 'afterMeal1h') {
      apply(g.sugar1hLow, g.sugar1hHigh);
    } else if (scene === 'afterMeal2h' || scene === 'bedtime' || (scene === 'afterMealCustom' && !customLate)) {
      apply(g.sugarAfterMealLow, g.sugarAfterMealHigh);
    } else if (scene === 'afterMeal3h' || (scene === 'afterMealCustom' && customLate)) {
      apply(g.sugarFastingLow, g.sugarFastingHigh);
    } else if (scene === 'random') {
      apply(g.sugarAfterMealLow, g.sugarRandomHigh);
    }
    return { low: low, high: high };
  }

  // 兼容旧代码：默认引用（将在app.js中根据模式动态替换）
  const REFERENCE = GENERAL_REF;

  /* ---------- 血糖场景定义 ---------- */
  const SUGAR_SCENES = [
    { key: 'fasting', label: '空腹', hint: '晨起空腹 3.9~6.1' },
    { key: 'beforeMeal', label: '餐前', hint: '任一餐前 3.9~6.1' },
    { key: 'afterMeal1h', label: '餐后1h', hint: '< 9.0 mmol/L' },
    { key: 'afterMeal2h', label: '餐后2h', hint: '< 7.8 mmol/L' },
    { key: 'afterMeal3h', label: '餐后3h', hint: '应回落至空腹水平' },
    { key: 'afterMealCustom', label: '餐后自定义', hint: '自定义餐后小时数' },
    { key: 'random', label: '随机', hint: '任意时间 < 11.1' },
    { key: 'bedtime', label: '睡前', hint: '睡前 3.9~7.8' }
  ];

  /* ---------- 食物分类（红绿灯依据） ---------- */
  const FOOD_CATEGORIES = {
    grain:  '主食谷类',
    tuber:  '薯类淀粉',
    veg:    '蔬菜',
    fruit:  '水果',
    meat:   '畜禽蛋',
    fish:   '水产',
    soy:    '豆类及制品',
    dairy:  '奶类',
    nut:    '坚果',
    oil:    '油脂',
    drink:  '饮品',
    snack:  '甜点零食'
  };

  /*
   * 食物字段说明（每 100g 可食部，估算值）：
   *  n=名称  cat=分类  kcal=热量(kcal)  p=蛋白质(g)  c=碳水(g)
   *  f=脂肪(g)  fb=膳食纤维(g)  gi=升糖指数(0=无)
   *  s=常见份量(g)  sn=份量名  light=人工覆盖(可选)  note=提示
   */
  const FOODS = [
    /* ---- 主食谷类 ---- */
    { n: '白米饭(熟)', cat: 'grain', kcal: 116, p: 2.6, c: 25.9, f: 0.3, fb: 0.3, gi: 83, s: 150, sn: '1小碗' },
    { n: '糙米饭(熟)', cat: 'grain', kcal: 112, p: 2.6, c: 24.0, f: 0.9, fb: 1.8, gi: 68, s: 150, sn: '1小碗' },
    { n: '黑米饭(熟)', cat: 'grain', kcal: 110, p: 3.1, c: 23.0, f: 0.8, fb: 2.5, gi: 55, s: 150, sn: '1小碗' },
    { n: '藜麦饭(熟)', cat: 'grain', kcal: 120, p: 4.4, c: 21.0, f: 1.9, fb: 2.8, gi: 53, s: 150, sn: '1小碗' },
    { n: '燕麦饭(整粒)', cat: 'grain', kcal: 110, p: 3.3, c: 20.5, f: 1.2, fb: 2.5, gi: 42, s: 150, sn: '1小碗' },
    { n: '燕麦片(原粒,干)', cat: 'grain', kcal: 338, p: 10.1, c: 77.4, f: 0.2, fb: 6.0, gi: 42, s: 30, sn: '约3勺' },
    { n: '即食燕麦片(干)', cat: 'grain', kcal: 350, p: 12.0, c: 66.0, f: 6.5, fb: 5.0, gi: 64, s: 30, sn: '约3勺' },
    { n: '荞麦面(干)', cat: 'grain', kcal: 340, p: 11.3, c: 70.2, f: 2.8, fb: 6.5, gi: 59, s: 60, sn: '1小把' },
    { n: '全麦面包', cat: 'grain', kcal: 246, p: 8.5, c: 41.0, f: 4.0, fb: 6.5, gi: 69, s: 35, sn: '1片' },
    { n: '白面包', cat: 'grain', kcal: 266, p: 8.0, c: 49.0, f: 4.0, fb: 2.0, gi: 75, s: 35, sn: '1片' },
    { n: '全麦馒头', cat: 'grain', kcal: 223, p: 7.0, c: 47.0, f: 1.1, fb: 1.3, gi: 65, s: 60, sn: '1个' },
    { n: '白馒头', cat: 'grain', kcal: 235, p: 7.1, c: 50.9, f: 1.3, fb: 0.5, gi: 88, s: 60, sn: '1个' },
    { n: '白米粥', cat: 'grain', kcal: 46, p: 1.1, c: 9.9, f: 0.3, fb: 0.1, gi: 69, s: 250, sn: '1碗', light: 'red', note: '精制+液态+低纤维，升糖快' },
    { n: '小米粥', cat: 'grain', kcal: 46, p: 1.4, c: 8.4, f: 0.7, fb: 0.3, gi: 60, s: 250, sn: '1碗' },
    { n: '玉米(甜,煮)', cat: 'grain', kcal: 112, p: 4.0, c: 22.8, f: 1.2, fb: 2.9, gi: 55, s: 100, sn: '半根' },
    { n: '糯玉米(煮)', cat: 'grain', kcal: 140, p: 4.0, c: 32.0, f: 1.0, fb: 2.0, gi: 82, s: 100, sn: '半根' },
    { n: '荞麦(干)', cat: 'grain', kcal: 337, p: 9.3, c: 73.0, f: 2.3, fb: 6.5, gi: 54, s: 50, sn: '1小把' },

    /* ---- 薯类淀粉 ---- */
    { n: '红薯(蒸)', cat: 'tuber', kcal: 90, p: 1.4, c: 20.0, f: 0.2, fb: 1.6, gi: 55, s: 100, sn: '1小个' },
    { n: '烤红薯', cat: 'tuber', kcal: 100, p: 1.5, c: 24.0, f: 0.2, fb: 1.6, gi: 94, s: 100, sn: '1小个' },
    { n: '马铃薯(蒸)', cat: 'tuber', kcal: 69, p: 3.0, c: 15.3, f: 0.2, fb: 0.2, gi: 65, s: 100, sn: '1个' },
    { n: '山药(蒸)', cat: 'tuber', kcal: 57, p: 1.9, c: 12.4, f: 0.2, fb: 0.8, gi: 51, s: 100, sn: '1段' },
    { n: '芋头(蒸)', cat: 'tuber', kcal: 79, p: 2.2, c: 18.0, f: 0.2, fb: 1.0, gi: 48, s: 100, sn: '1个' },
    { n: '南瓜', cat: 'tuber', kcal: 22, p: 0.7, c: 5.3, f: 0.1, fb: 0.8, gi: 65, s: 100, sn: '1块', note: 'GI高但碳水低，控制份量' },
    { n: '莲藕', cat: 'tuber', kcal: 47, p: 1.9, c: 11.5, f: 0.2, fb: 1.2, gi: 38, s: 100, sn: '1节' },

    /* ---- 蔬菜（绿灯主力） ---- */
    { n: '西兰花', cat: 'veg', kcal: 36, p: 4.1, c: 4.3, f: 0.6, fb: 1.6, gi: 15, s: 150, sn: '1小朵' },
    { n: '菠菜', cat: 'veg', kcal: 28, p: 2.6, c: 4.5, f: 0.3, fb: 1.7, gi: 15, s: 200, sn: '1把' },
    { n: '油麦菜', cat: 'veg', kcal: 16, p: 1.4, c: 2.4, f: 0.4, fb: 1.2, gi: 15, s: 200, sn: '1把' },
    { n: '芹菜', cat: 'veg', kcal: 22, p: 1.2, c: 4.5, f: 0.2, fb: 1.2, gi: 15, s: 150, sn: '1把' },
    { n: '黄瓜', cat: 'veg', kcal: 16, p: 0.8, c: 2.9, f: 0.2, fb: 0.5, gi: 15, s: 100, sn: '1根' },
    { n: '番茄', cat: 'veg', kcal: 20, p: 0.9, c: 4.0, f: 0.2, fb: 0.5, gi: 15, s: 100, sn: '1个' },
    { n: '彩椒', cat: 'veg', kcal: 26, p: 1.0, c: 6.0, f: 0.2, fb: 2.1, gi: 15, s: 50, sn: '半个' },
    { n: '冬瓜', cat: 'veg', kcal: 12, p: 0.4, c: 2.6, f: 0.2, fb: 0.7, gi: 15, s: 200, sn: '1块' },
    { n: '生菜', cat: 'veg', kcal: 15, p: 1.3, c: 2.0, f: 0.3, fb: 0.7, gi: 15, s: 150, sn: '1把' },
    { n: '小白菜', cat: 'veg', kcal: 17, p: 1.5, c: 2.7, f: 0.3, fb: 1.1, gi: 15, s: 150, sn: '1把' },
    { n: '胡萝卜', cat: 'veg', kcal: 39, p: 1.0, c: 8.8, f: 0.2, fb: 1.1, gi: 71, s: 100, sn: '半根', note: 'GI偏高，少量作配菜' },
    { n: '茄子', cat: 'veg', kcal: 23, p: 1.1, c: 4.9, f: 0.2, fb: 1.3, gi: 15, s: 100, sn: '1个' },

    /* ---- 水果（低GI限量吃） ---- */
    { n: '苹果', cat: 'fruit', kcal: 53, p: 0.4, c: 13.7, f: 0.2, fb: 1.7, gi: 36, s: 100, sn: '1个' },
    { n: '梨', cat: 'fruit', kcal: 51, p: 0.3, c: 13.1, f: 0.1, fb: 2.6, gi: 36, s: 100, sn: '1个' },
    { n: '柚子', cat: 'fruit', kcal: 42, p: 0.8, c: 9.5, f: 0.2, fb: 0.4, gi: 25, s: 150, sn: '2瓣' },
    { n: '草莓', cat: 'fruit', kcal: 32, p: 1.0, c: 7.1, f: 0.2, fb: 1.1, gi: 40, s: 150, sn: '1小盒' },
    { n: '樱桃', cat: 'fruit', kcal: 46, p: 1.1, c: 10.2, f: 0.2, fb: 0.3, gi: 22, s: 100, sn: '1小把' },
    { n: '猕猴桃', cat: 'fruit', kcal: 61, p: 0.8, c: 14.5, f: 0.6, fb: 2.6, gi: 52, s: 80, sn: '1个' },
    { n: '橙子', cat: 'fruit', kcal: 48, p: 0.8, c: 11.1, f: 0.2, fb: 0.6, gi: 43, s: 100, sn: '1个' },
    { n: '蓝莓', cat: 'fruit', kcal: 57, p: 0.7, c: 14.5, f: 0.3, fb: 2.4, gi: 53, s: 100, sn: '1小盒' },
    { n: '桃', cat: 'fruit', kcal: 42, p: 0.9, c: 10.1, f: 0.1, fb: 1.3, gi: 28, s: 100, sn: '1个' },
    { n: '圣女果', cat: 'fruit', kcal: 22, p: 1.0, c: 5.8, f: 0.2, fb: 1.8, gi: 30, s: 100, sn: '1把' },
    { n: '香蕉', cat: 'fruit', kcal: 93, p: 1.4, c: 22.0, f: 0.2, fb: 1.2, gi: 52, s: 100, sn: '1根', light: 'yellow', note: '糖分较高，熟透慎食' },
    { n: '芒果', cat: 'fruit', kcal: 35, p: 0.6, c: 8.3, f: 0.2, fb: 1.3, gi: 55, s: 100, sn: '1个' },
    { n: '菠萝', cat: 'fruit', kcal: 44, p: 0.5, c: 10.8, f: 0.1, fb: 1.3, gi: 66, s: 100, sn: '1块' },
    { n: '西瓜', cat: 'fruit', kcal: 31, p: 0.6, c: 7.9, f: 0.1, fb: 0.3, gi: 72, s: 200, sn: '1小块' },
    { n: '荔枝', cat: 'fruit', kcal: 71, p: 0.9, c: 16.6, f: 0.2, fb: 0.5, gi: 79, s: 100, sn: '数颗' },
    { n: '龙眼', cat: 'fruit', kcal: 71, p: 1.2, c: 16.2, f: 0.1, fb: 0.4, gi: 70, s: 100, sn: '数颗' },
    { n: '葡萄', cat: 'fruit', kcal: 45, p: 0.4, c: 10.3, f: 0.3, fb: 0.4, gi: 56, s: 100, sn: '1小串' },
    { n: '红枣(干)', cat: 'fruit', kcal: 276, p: 3.2, c: 67.8, f: 0.5, fb: 6.2, gi: 55, s: 20, sn: '3颗', light: 'red', note: '糖分浓缩，少食' },

    /* ---- 畜禽蛋 ---- */
    { n: '鸡蛋(水煮)', cat: 'meat', kcal: 144, p: 13.3, c: 2.8, f: 8.8, fb: 0, gi: 0, s: 50, sn: '1个' },
    { n: '鸡胸肉', cat: 'meat', kcal: 133, p: 19.4, c: 2.5, f: 5.0, fb: 0, gi: 0, s: 100, sn: '1块' },
    { n: '鸡腿肉(去皮)', cat: 'meat', kcal: 146, p: 20.2, c: 0.6, f: 7.2, fb: 0, gi: 0, s: 100, sn: '1块' },
    { n: '牛里脊(瘦)', cat: 'meat', kcal: 106, p: 20.2, c: 1.2, f: 2.3, fb: 0, gi: 0, s: 100, sn: '1块' },
    { n: '猪里脊(瘦)', cat: 'meat', kcal: 155, p: 20.2, c: 0.7, f: 7.9, fb: 0, gi: 0, s: 100, sn: '1块' },
    { n: '瘦猪肉', cat: 'meat', kcal: 143, p: 20.3, c: 1.5, f: 6.2, fb: 0, gi: 0, s: 100, sn: '1块' },
    { n: '猪肝', cat: 'meat', kcal: 129, p: 19.3, c: 5.0, f: 3.5, fb: 0, gi: 0, s: 50, sn: '几片', note: '补铁好，每周1次勿多' },

    /* ---- 水产 ---- */
    { n: '鲈鱼', cat: 'fish', kcal: 105, p: 18.6, c: 0, f: 3.4, fb: 0, gi: 0, s: 150, sn: '1条' },
    { n: '三文鱼', cat: 'fish', kcal: 139, p: 17.2, c: 0, f: 7.8, fb: 0, gi: 0, s: 100, sn: '1块' },
    { n: '鳕鱼', cat: 'fish', kcal: 88, p: 20.4, c: 0.5, f: 0.5, fb: 0, gi: 0, s: 150, sn: '1块' },
    { n: '虾仁', cat: 'fish', kcal: 93, p: 18.6, c: 2.8, f: 0.8, fb: 0, gi: 0, s: 100, sn: '1小碗' },

    /* ---- 豆类及制品 ---- */
    { n: '北豆腐', cat: 'soy', kcal: 98, p: 12.2, c: 2.0, f: 4.8, fb: 0.5, gi: 15, s: 150, sn: '半块' },
    { n: '内酯豆腐', cat: 'soy', kcal: 50, p: 5.0, c: 2.0, f: 2.2, fb: 0.1, gi: 15, s: 150, sn: '半盒' },
    { n: '豆腐干', cat: 'soy', kcal: 142, p: 16.2, c: 4.5, f: 6.0, fb: 0.8, gi: 20, s: 60, sn: '2块' },
    { n: '千张', cat: 'soy', kcal: 260, p: 24.5, c: 5.5, f: 16.0, fb: 0.2, gi: 20, s: 50, sn: '1张' },
    { n: '无糖豆浆', cat: 'soy', kcal: 30, p: 3.0, c: 1.2, f: 1.6, fb: 0.1, gi: 30, s: 300, sn: '1杯' },
    { n: '黄豆(干)', cat: 'soy', kcal: 390, p: 35.0, c: 34.2, f: 16.0, fb: 15.5, gi: 18, s: 25, sn: '1小把' },
    { n: '鹰嘴豆(熟)', cat: 'soy', kcal: 164, p: 8.9, c: 27.4, f: 2.6, fb: 7.6, gi: 33, s: 50, sn: '小半碗' },
    { n: '黑豆(干)', cat: 'soy', kcal: 401, p: 36.0, c: 33.6, f: 15.9, fb: 10.2, gi: 20, s: 25, sn: '1小把' },

    /* ---- 奶类 ---- */
    { n: '低脂牛奶', cat: 'dairy', kcal: 43, p: 3.4, c: 5.0, f: 1.3, fb: 0, gi: 27, s: 250, sn: '1杯' },
    { n: '全脂牛奶', cat: 'dairy', kcal: 54, p: 3.0, c: 5.0, f: 3.2, fb: 0, gi: 27, s: 250, sn: '1杯' },
    { n: '无糖酸奶', cat: 'dairy', kcal: 62, p: 3.2, c: 4.6, f: 3.5, fb: 0, gi: 35, s: 130, sn: '1杯' },
    { n: '奶酪', cat: 'dairy', kcal: 328, p: 25.7, c: 3.5, f: 23.5, fb: 0, gi: 0, s: 20, sn: '1片' },

    /* ---- 坚果（好油脂，限量） ---- */
    { n: '核桃仁', cat: 'nut', kcal: 646, p: 14.9, c: 19.1, f: 58.8, fb: 9.5, gi: 15, s: 15, sn: '约3颗' },
    { n: '巴旦木', cat: 'nut', kcal: 578, p: 21.0, c: 21.7, f: 50.6, fb: 11.8, gi: 15, s: 15, sn: '1小把' },
    { n: '花生仁', cat: 'nut', kcal: 580, p: 25.0, c: 21.7, f: 44.3, fb: 5.5, gi: 14, s: 15, sn: '1小把' },
    { n: '腰果', cat: 'nut', kcal: 559, p: 17.3, c: 41.6, f: 36.7, fb: 3.6, gi: 22, s: 15, sn: '1小把' },

    /* ---- 油脂 ---- */
    { n: '橄榄油', cat: 'oil', kcal: 899, p: 0, c: 0, f: 99.9, fb: 0, gi: 0, s: 5, sn: '1茶匙' },
    { n: '花生油', cat: 'oil', kcal: 899, p: 0, c: 0, f: 99.9, fb: 0, gi: 0, s: 5, sn: '1茶匙' },
    { n: '芝麻酱', cat: 'oil', kcal: 618, p: 19.2, c: 22.7, f: 52.7, fb: 5.9, gi: 0, s: 10, sn: '1勺' },

    /* ---- 饮品 ---- */
    { n: '无糖豆浆', cat: 'drink', kcal: 30, p: 3.0, c: 1.2, f: 1.6, fb: 0.1, gi: 30, s: 300, sn: '1杯' },
    { n: '白开水', cat: 'drink', kcal: 0, p: 0, c: 0, f: 0, fb: 0, gi: 0, s: 250, sn: '1杯' },
    { n: '鲜榨果汁', cat: 'drink', kcal: 46, p: 0.3, c: 11.0, f: 0.1, fb: 0.1, gi: 55, s: 250, sn: '1杯', light: 'red', note: '去纤维=速效糖' },
    { n: '含糖饮料', cat: 'drink', kcal: 43, p: 0, c: 10.6, f: 0, fb: 0, gi: 68, s: 330, sn: '1罐', light: 'red', note: '液态糖，禁饮' },
    { n: '蜂蜜水', cat: 'drink', kcal: 32, p: 0, c: 8.0, f: 0, fb: 0, gi: 73, s: 250, sn: '1杯', light: 'red', note: '游离糖，禁饮' },

    /* ---- 甜点零食 ---- */
    { n: '苏打饼干', cat: 'snack', kcal: 408, p: 8.4, c: 76.2, f: 7.7, fb: 3.0, gi: 72, s: 20, sn: '约2片' },
    { n: '蛋糕', cat: 'snack', kcal: 347, p: 8.6, c: 55.0, f: 11.0, fb: 0.5, gi: 65, s: 50, sn: '1小块', light: 'red', note: '糖+精面+油脂' },
    { n: '巧克力', cat: 'snack', kcal: 546, p: 4.3, c: 61.0, f: 40.0, fb: 1.0, gi: 43, s: 20, sn: '1小块', light: 'red', note: '高糖高脂' },
    { n: '冰激凌', cat: 'snack', kcal: 207, p: 3.5, c: 23.6, f: 11.0, fb: 0, gi: 61, s: 80, sn: '1球', light: 'red', note: '高糖高脂' },
    { n: '饼干(奶油)', cat: 'snack', kcal: 480, p: 6.5, c: 70.0, f: 20.0, fb: 1.0, gi: 70, s: 30, sn: '2片', light: 'red', note: '高糖高脂' },
    { n: '汤圆/元宵', cat: 'snack', kcal: 230, p: 4.0, c: 44.0, f: 3.0, fb: 1.0, gi: 87, s: 60, sn: '3个', light: 'red', note: '糯米+糖，升糖极快' }
  ];

  /* ---------- 红绿灯分类算法 ----------
   * 规则：优先人工标注；否则按 GI + 碳水 + 纤维 + 类别判定。
   * strict=true（严格控糖模式）会收紧 GI 阈值。
   */
  function classifyFood(food, strict) {
    strict = !!strict;
    // 1) 人工覆盖
    if (food.light) {
      return { light: food.light, reason: food.note || '已按专业建议标注' };
    }
    const hiGi = strict ? 65 : 70;   // 高 GI 阈值
    const loGi = strict ? 50 : 55;   // 低 GI 阈值

    // 2) 高 GI → 红灯
    if (food.gi >= hiGi) {
      return { light: 'red', reason: '高GI（≥' + hiGi + '），升糖快，需避免或极少食用' };
    }
    // 3) 中 GI → 黄灯
    if (food.gi >= loGi) {
      return { light: 'yellow', reason: '中GI（' + loGi + '~' + hiGi + '），需控制份量、搭配蔬菜蛋白' };
    }
    // 4) 无 GI 或低 GI 时，按碳水/类别细分
    if (food.carb <= 5) {
      if (food.cat === 'oil' || food.cat === 'nut') {
        return { light: 'green', reason: '几乎不升糖；注意脂肪，控制份量（坚果限一小把）' };
      }
      return { light: 'green', reason: '碳水极低，几乎不升糖，可放心食用' };
    }
    if (food.gi > 0 && food.gi < loGi) {
      // 低 GI 但若碳水高且纤维低仍要限量
      if (food.carb >= 60 && food.fb < 4) {
        return { light: 'yellow', reason: '低GI但碳水密度高，纤维不足，需限量' };
      }
      return { light: 'green', reason: '低GI（<' + loGi + '），缓慢释放葡萄糖，可适量食用' };
    }
    if (food.cat === 'fruit' && food.carb >= 18) {
      return { light: 'yellow', reason: '水果糖分较高，两餐之间限量吃、勿榨汁' };
    }
    if (food.cat === 'veg') {
      return { light: 'green', reason: '蔬菜热量低、纤维高，几乎不升糖，可放开吃' };
    }
    if (food.cat === 'fruit') {
      return { light: 'green', reason: '低GI水果，两餐之间限量吃' };
    }
    return { light: 'green', reason: '整体升糖负担低' };
  }

  /* ---------- 孕期药品库 ---------- */
  const DRUGS = [
    {
      name: '优甲乐', generic: '左甲状腺素钠片', cat: '甲状腺', spec: '50μg/片',
      purpose: '甲状腺功能减退替代治疗（双胎负担重，需长期）',
      dosage: '遵医嘱（常用 50~150μg）', unit: 'μg',
      timing: '清晨空腹，温水整片吞服，服药后 30~60 分钟再进食',
      times: ['06:30'],
      precautions: '与钙、铁、牛奶、豆浆至少间隔 4 小时；每 4 周复查 TSH，勿自行停药',
      safety: '孕期安全（FDA B类），对胎儿神经发育至关重要'
    },
    {
      name: '铁剂', generic: '琥珀酸亚铁片', cat: '补血', spec: '0.1g/片',
      purpose: '缺铁性贫血治疗（双胎风险为单胎 2.4~4 倍）',
      dosage: '遵医嘱', unit: '片',
      timing: '午饭后 30 分钟，配维生素C/橙汁促吸收',
      times: ['12:30'],
      precautions: '与钙、牛奶、茶、咖啡间隔≥2小时；服后大便变黑属正常；血色素正常后仍需补足储存铁',
      safety: '孕期常用补铁药'
    },
    {
      name: '钙剂+维D', generic: '碳酸钙D3片', cat: '补钙', spec: '钙600mg+D3 125IU/片',
      purpose: '补钙与维生素D（双胎骨钙消耗大）',
      dosage: '遵医嘱（单次≤500mg钙吸收更佳）', unit: '片',
      timing: '晚餐后或睡前，与中午的铁间隔≥8小时',
      times: ['21:00'],
      precautions: '与铁剂错开（早铁晚钙）；避免与大量草酸蔬菜（菠菜）同餐',
      safety: '孕期安全'
    },
    {
      name: '维生素D3', generic: '维生素D滴剂/胶囊', cat: '维生素', spec: '400IU/粒',
      purpose: '促进钙吸收，维持骨骼与免疫',
      dosage: '每日 400~1000IU 遵医嘱', unit: 'IU',
      timing: '随钙同服或随餐',
      times: ['21:00'],
      precautions: '配合户外晒太阳；勿与其它维D制剂叠加过量',
      safety: '孕期安全'
    },
    {
      name: '叶酸', generic: '叶酸片', cat: '维生素', spec: '0.4mg/片',
      purpose: '预防神经管畸形、辅助造血（双胎常建议1mg/日）',
      dosage: '每日 0.4~1mg 遵医嘱', unit: 'mg',
      timing: '每日固定时间，可随餐',
      times: ['10:00'],
      precautions: '医生可能建议全程服用至分娩',
      safety: '孕期必需'
    },
    {
      name: '维生素C', generic: '维生素C片', cat: '维生素', spec: '100mg/片',
      purpose: '促进铁吸收（补铁黄金搭档）',
      dosage: '与铁同服 100~200mg', unit: 'mg',
      timing: '与铁剂同服',
      times: ['12:30'],
      precautions: '不超量',
      safety: '孕期安全'
    },
    {
      name: '门冬胰岛素', generic: '门冬胰岛素注射液', cat: '降糖', spec: '300U/3ml',
      purpose: '速效胰岛素，控制餐后血糖',
      dosage: '遵医嘱（按血糖记录调整）', unit: 'U',
      timing: '餐前 0~5 分钟注射，注射后立即进食',
      times: ['07:30', '12:00', '18:00'],
      precautions: '注射部位轮换；警惕低血糖，备糖果/果汁',
      safety: '不过胎盘，对宝宝安全'
    },
    {
      name: '地特胰岛素', generic: '地特胰岛素注射液', cat: '降糖', spec: '300U/3ml',
      purpose: '长效基础胰岛素，控制空腹血糖',
      dosage: '遵医嘱', unit: 'U',
      timing: '每日固定时间（常睡前）注射',
      times: ['22:00'],
      precautions: '固定时间注射；警惕夜间低血糖',
      safety: '不过胎盘，对宝宝安全'
    },
    {
      name: '甘精胰岛素', generic: '甘精胰岛素注射液', cat: '降糖', spec: '300U/3ml',
      purpose: '长效基础胰岛素，控制全天基础血糖',
      dosage: '遵医嘱', unit: 'U',
      timing: '每日固定时间（常睡前）注射',
      times: ['22:00'],
      precautions: '不与其它胰岛素混用同一注射器',
      safety: '不过胎盘，对宝宝安全'
    },
    {
      name: '二甲双胍', generic: '盐酸二甲双胍片', cat: '降糖', spec: '0.5g/片',
      purpose: '改善胰岛素抵抗（必要时遵医嘱）',
      dosage: '遵医嘱', unit: '片',
      timing: '随餐或餐后立即服（缓释片随晚餐整片吞）',
      times: ['18:30'],
      precautions: '单用一般不引起低血糖；与胰岛素联用需防低血糖',
      safety: '孕期可用（遵医嘱）'
    },
    {
      name: '拉贝洛尔', generic: '盐酸拉贝洛尔片', cat: '降压', spec: '50mg/片',
      purpose: '妊娠期高血压降压',
      dosage: '遵医嘱，每日2~3次', unit: '片',
      timing: '严格定时（如早8/下午4/晚10）',
      times: ['08:00', '16:00', '22:00'],
      precautions: '服药后起身要慢；勿因血压正常自行停药',
      safety: '妊娠期常用降压药'
    },
    {
      name: '硝苯地平控释片', generic: '硝苯地平控释片', cat: '降压', spec: '30mg/片',
      purpose: '妊娠期高血压降压',
      dosage: '遵医嘱，每日1次', unit: '片',
      timing: '每日固定时间（常早晨）整片吞服，勿掰开/嚼碎',
      times: ['08:00'],
      precautions: '控释片勿压碎；粪便中可见完整药壳属正常',
      safety: '妊娠期常用降压药'
    },
    {
      name: '维生素B6', generic: '维生素B6片', cat: '止吐', spec: '10mg/片',
      purpose: '缓解早孕反应/孕吐',
      dosage: '每次10mg，遵医嘱', unit: '片',
      timing: '随餐或餐后，分次服用',
      times: ['08:00', '12:00', '18:00'],
      precautions: '短期使用',
      safety: '孕期安全'
    },
    {
      name: 'DHA', generic: '藻油DHA软胶囊', cat: '营养', spec: '200mg/粒',
      purpose: '促进胎儿大脑与视网膜发育',
      dosage: '每日 200~300mg', unit: 'mg',
      timing: '随餐服用',
      times: ['12:30'],
      precautions: '低汞来源更安全',
      safety: '孕期安全'
    },
    {
      name: '复合维生素', generic: '孕期复合维生素', cat: '营养', spec: '—',
      purpose: '补充孕期多种维生素矿物质',
      dosage: '每日1片', unit: '片',
      timing: '随餐服用',
      times: ['08:00'],
      precautions: '勿与同类补充剂叠加过量',
      safety: '孕期安全'
    }
  ];

  /* =====================================================================
   * 产检/孕期专用数据
   * ===================================================================== */

  /* Hadlock III 胎儿体重估算公式
   * log₁₀(EFW) = 1.3596 + 0.0064×HC + 0.0424×AC + 0.174×FL
   *              + 0.00061×BPD×AC − 0.00386×AC×FL
   * 所有测量值单位 cm，EFW 单位 g
   * 来源：Hadlock et al. 1985, Radiology; 全球最广泛验证的公式
   */
  function calcEFW(bpd, hc, ac, fl) {
    // 输入为 mm，转换为 cm
    const B = (Number(bpd) || 0) / 10;
    const H = (Number(hc) || 0) / 10;
    const A = (Number(ac) || 0) / 10;
    const F = (Number(fl) || 0) / 10;
    // 至少需要 AC + FL 两个参数才能计算
    if (A <= 0 || F <= 0) return null;
    const log10EFW = 1.3596 + 0.0064 * H + 0.0424 * A + 0.174 * F
      + 0.00061 * B * A - 0.00386 * A * F;
    return Math.round(Math.pow(10, log10EFW));
  }

  /* 双胎体重差异百分比
   * discordance = (大胎儿体重 - 小胎儿体重) / 大胎儿体重 × 100%
   * <15% 一致；15-25% 轻度不一致；≥25% 重度不一致
   * 来源：ACOG/ISUOG 2016共识；中华围产医学杂志2020双胎指南
   */
  function twinDiscordance(w1, w2) {
    const a = Number(w1) || 0, b = Number(w2) || 0;
    if (a <= 0 || b <= 0) return null;
    const big = Math.max(a, b), small = Math.min(a, b);
    return +(((big - small) / big) * 100).toFixed(1);
  }

  function discordanceLevel(pct) {
    if (pct == null) return { label: '--', cls: 'badge-gray', desc: '' };
    if (pct < 15) return { label: '一致', cls: 'badge-green', desc: '双胎发育协调' };
    if (pct < 25) return { label: '轻度差异', cls: 'badge-yellow', desc: '建议定期复查关注趋势' };
    return { label: '重度差异', cls: 'badge-red', desc: '≥25%需密切监测，遵医嘱' };
  }

  /* 羊水参考标准
   * AFI 羊水指数：8~25cm 正常；<5 过少；5~8 偏少；>25 过多
   * SDP 最大羊水池深度：2~8cm 正常；<2 过少；>8 过多
   */
  const AMNIOTIC_REF = {
    afi: { low: 8, high: 25, veryLow: 5, veryHigh: 25, unit: 'cm' },
    sdp: { low: 2, high: 8, unit: 'cm' }
  };

  function amnioticStatus(type, value) {
    const v = Number(value);
    if (!v) return { label: '--', cls: 'badge-gray' };
    if (type === 'afi') {
      if (v < 5) return { label: '羊水过少', cls: 'badge-red' };
      if (v < 8) return { label: '羊水偏少', cls: 'badge-yellow' };
      if (v > 25) return { label: '羊水过多', cls: 'badge-red' };
      return { label: '正常', cls: 'badge-green' };
    } else {
      if (v < 2) return { label: '羊水过少', cls: 'badge-red' };
      if (v > 8) return { label: '羊水过多', cls: 'badge-red' };
      return { label: '正常', cls: 'badge-green' };
    }
  }

  /* 孕期血压参考 */
  function bpStatus(sys, dia) {
    const s = Number(sys), d = Number(dia);
    if (!s || !d) return { label: '--', cls: 'badge-gray' };
    if (s >= 160 || d >= 110) return { label: '重度高血压', cls: 'badge-red' };
    if (s >= 140 || d >= 90) return { label: '高血压', cls: 'badge-red' };
    if (s >= 130 || d >= 85) return { label: '正常高值', cls: 'badge-yellow' };
    if (s < 90 || d < 60) return { label: '偏低', cls: 'badge-blue' };
    return { label: '正常', cls: 'badge-green' };
  }

  /* 常规产检项目（可自定义添加） */
  const CHECKUP_ITEMS = [
    { key: 'bp', label: '血压', unit: 'mmHg', icon: 'i-heart-pulse', type: 'bp' },
    { key: 'weight', label: '体重', unit: 'kg', icon: 'i-scale', type: 'number' },
    { key: 'fundalHeight', label: '宫高', unit: 'cm', icon: 'i-ruler', type: 'number' },
    { key: 'maternalAC', label: '腹围', unit: 'cm', icon: 'i-ruler', type: 'number' },
    { key: 'fhr', label: '胎心率', unit: '次/分', icon: 'i-activity', type: 'number' },
    { key: 'position', label: '胎位', unit: '', icon: 'i-baby', type: 'text' },
    { key: 'edema', label: '水肿', unit: '', icon: 'i-droplet', type: 'text' },
    { key: 'urineProtein', label: '尿蛋白', unit: '', icon: 'i-test-tube', type: 'text' },
    { key: 'hgb', label: '血红蛋白', unit: 'g/L', icon: 'i-droplet', type: 'number' },
    { key: 'nst', label: '胎心监护', unit: '', icon: 'i-activity', type: 'text' }
  ];

  /* 胎心率参考范围（110~160 次/分） */
  function fhrStatus(fhr) {
    const v = Number(fhr);
    if (!v) return { label: '--', cls: 'badge-gray' };
    if (v < 110) return { label: '偏慢', cls: 'badge-red' };
    if (v > 160) return { label: '偏快', cls: 'badge-yellow' };
    return { label: '正常', cls: 'badge-green' };
  }

  /* 脉搏/心率参考（成人静息 60~100 次/分；孕期略快常见） */
  function pulseStatus(pulse) {
    const v = Number(pulse);
    if (!v) return { label: '--', cls: 'badge-gray' };
    if (v < 50) return { label: '过缓', cls: 'badge-red' };
    if (v < 60) return { label: '偏慢', cls: 'badge-yellow' };
    if (v > 110) return { label: '偏快', cls: 'badge-yellow' };
    if (v > 120) return { label: '心动过速', cls: 'badge-red' };
    return { label: '正常', cls: 'badge-green' };
  }

  /* 宫缩状态判断
   * durationSec：单次持续秒数；intervalMin：距上次宫缩开始的分钟数
   * 孕周 <37：规律且间隔≤10分钟、持续≥30秒需警惕早产
   * 孕周 ≥37：间隔≤5分钟、持续≥45~60秒提示临产可能
   * 不规则、持续短、间隔长多为假性宫缩/Braxton Hicks
   */
  function contractionStatus(durationSec, intervalMin, gestWeek) {
    const dur = Number(durationSec) || 0;
    const gap = Number(intervalMin);
    const week = Number(gestWeek) || 0;
    if (dur <= 0) return { label: '--', cls: 'badge-gray', desc: '' };
    if (week && week < 37 && gap > 0 && gap <= 10 && dur >= 30) {
      return { label: '需警惕早产', cls: 'badge-red', desc: '未足月出现规律宫缩，请尽快联系医生或就医' };
    }
    if (week >= 37 && gap > 0 && gap <= 5 && dur >= 45) {
      return { label: '可能临产', cls: 'badge-red', desc: '规律宫缩伴持续时间延长，请准备就医' };
    }
    if (dur < 30 || !gap || gap > 15) {
      return { label: '疑似假性宫缩', cls: 'badge-blue', desc: '通常不规则、休息/换姿势后缓解；若加重请记录并咨询医生' };
    }
    return { label: '继续观察', cls: 'badge-yellow', desc: '请连续记录间隔和持续时间，若越来越规律请就医' };
  }

  /* ---------- 帮助文档与常见问题 ---------- */
  const FAQS = [
    { q: '血糖正常范围是多少？', a: '健康成人空腹血糖 3.9~6.1 mmol/L，餐后2小时 <7.8 mmol/L。6.1~7.0 为空腹血糖受损（糖尿病前期），≥7.0 需就医排查糖尿病。糖尿病患者控制目标因人而异，请遵医嘱。' },
    { q: '体重多少算健康？', a: '中国成人BMI正常范围为 18.5~24.0（BMI=体重kg÷身高m²）。24.0~28.0 为超重，≥28.0 为肥胖。超重/肥胖者建议每周减重不超过0.5kg，3~6个月减5%~10%。' },
    { q: '如何看红绿灯？', a: '绿灯可放心吃；黄灯限量、搭配蔬菜蛋白；红灯尽量避免。所有水果两餐之间限量吃、勿榨汁。具体阈值可在设置中自定义。' },
    { q: '任务提醒怎么设置？', a: '在「任务」页添加任务，设置每日提醒时间。如标注为「餐后/餐前」，只需设置用餐时间，提醒会自动联动推算。' },
    { q: '一天吃几顿？', a: '建议规律三餐，如需控糖可在两餐之间少量加餐。进食顺序建议「蔬菜→蛋白质→主食」，有助于平缓餐后血糖。' },
    { q: '数据存在哪里？安全吗？', a: '所有数据仅保存在本机浏览器 localStorage，不上传任何服务器；卸载/清除浏览器数据会清空，可导出备份。' }
  ];

  /* ---------- 隐私说明 ---------- */
  const PRIVACY_TEXT = [
    '本应用为本地离线工具，所有健康数据仅存储于您的设备浏览器（localStorage），不会上传至任何服务器或第三方。',
    '应用不要求注册登录，不收集身份信息，不使用第三方统计追踪。',
    '清除浏览器缓存或卸载应用会删除本地数据，建议定期在「设置」中导出备份。',
    '本应用内容仅供健康管理参考，不能替代医生诊断与处方；用药、胰岛素剂量调整请以主治医生为准。'
  ];

  global.Data = {
    REFERENCE: REFERENCE,
    PREGNANCY_REF: PREGNANCY_REF,
    GENERAL_REF: GENERAL_REF,
    getReference: getReference,
    resolveSugar: resolveSugar,
    SUGAR_SCENES: SUGAR_SCENES,
    FOOD_CATEGORIES: FOOD_CATEGORIES,
    FOODS: FOODS,
    DRUGS: DRUGS,
    FAQS: FAQS,
    PRIVACY_TEXT: PRIVACY_TEXT,
    classifyFood: classifyFood,
    // 产检/孕期
    calcEFW: calcEFW,
    twinDiscordance: twinDiscordance,
    discordanceLevel: discordanceLevel,
    AMNIOTIC_REF: AMNIOTIC_REF,
    amnioticStatus: amnioticStatus,
    bpStatus: bpStatus,
    fhrStatus: fhrStatus,
    pulseStatus: pulseStatus,
    contractionStatus: contractionStatus,
    CHECKUP_ITEMS: CHECKUP_ITEMS
  };
})(window);
