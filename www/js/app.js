/* =====================================================================
 * app.js — 应用入口：路由、导航、首页、设置、通知、弹窗、主题
 * ===================================================================== */
(function (global) {
  'use strict';

  const Store = global.Store, Utils = global.Utils, Charts = global.Charts, Data = global.Data;

  const ROUTES = {
    home: { title: '暖语', sub: '体重血糖 · 健康每一天' },
    records: { title: '健康记录', sub: '体重与血糖' },
    prenatal: { title: '产检记录', sub: 'B超·羊水·血压·胎动' },
    diet: { title: '饮食管理', sub: '记录与红绿灯' },
    medication: { title: '任务提醒', sub: '按时完成不遗漏' },
    settings: { title: '我的', sub: '设置与帮助' }
  };

  const QUICK = {
    weight: { label: '记体重', svg: 'i-scale', color: 'linear-gradient(135deg,#3faa76,#6bc4a6)' },
    sugar: { label: '记血糖', svg: 'i-droplet', color: 'linear-gradient(135deg,#d98c3a,#f4957a)' },
    diet: { label: '记饮食', svg: 'i-salad', color: 'linear-gradient(135deg,#7ec4a0,#a8dcc0)' },
    med: { label: '记任务', svg: 'i-pill', color: 'linear-gradient(135deg,#5b8fd6,#8ab6f0)' },
    prenatal: { label: '记产检', svg: 'i-clipboard', color: 'linear-gradient(135deg,#e57392,#f2a4b8)' },
    kick: { label: '数胎动', svg: 'i-activity', color: 'linear-gradient(135deg,#b87bd6,#d6a8f0)' }
  };

  const MEAL_DEFS = [
    { key: 'breakfast', label: '早餐', svg: 'i-sun' },
    { key: 'lunch', label: '午餐', svg: 'i-flame' },
    { key: 'dinner', label: '晚餐', svg: 'i-moon' },
    { key: 'snack', label: '加餐', svg: 'i-leaf' }
  ];

  const App = {
    state: {
      currentRoute: 'home',
      recordsTab: 'weight', weightPeriod: 'month', weightChart: 'line',
      sugarPeriod: 'week', sugarScene: 'all',
      dietTab: 'record', dietMeal: 'breakfast', dietDate: Utils.todayStr(),
      lightCat: 'all', lightFilter: 'all',
      medTab: 'plan', medRange: 'week', medFilter: 'all',
      pendingFocus: null, notified: {}
    },

    /* ---------- 初始化 ---------- */
    init() {
      if (this._inited) return;
      this._inited = true;
      Store.init();
      this.installWidgetDataHook();
      this.applyTheme();
      this.bindSystemTheme();
      this.applyCustomBg();
      this.renderNav();
      this.updatePrenatalTab();
      this.bindGlobal();
      this.registerSW();
      this.initNativeNotifications();
      this.bindWidgetBridge();

      // 首次启动引导
      if (!Store.get('onboarded')) {
        this.showOnboarding();
      } else {
        this.route('home');
        this.renderFab();
        this.startScheduler();
      }
    },

    registerSW() {
      if (this.isNative()) return; // 原生 App 由 Capacitor 提供资源，无需 Service Worker
      if (!('serviceWorker' in navigator)) return;
      if (!/^https?:$/.test(location.protocol)) return;
      navigator.serviceWorker.register('sw.js').catch(() => {});
    },

    bindGlobal() {
      document.getElementById('fab-main').addEventListener('click', () => {
        document.getElementById('fab-wrap').classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#fab-wrap')) {
          document.getElementById('fab-wrap').classList.remove('open');
        }
      });
      // 视口变化时重新对齐分段滑块
      let rsT = null;
      window.addEventListener('resize', () => {
        clearTimeout(rsT);
        rsT = setTimeout(() => {
          document.querySelectorAll('.seg').forEach((seg) => { if (seg._thumb) this.placeSegThumb(seg); });
        }, 120);
      });
    },

    bindThemeToggle() {
      // 顶栏已移除；主题切换入口在「我的 → 外观」，此方法保留为空以兼容调用
    },

    /* ---------- 主题 ---------- */
    applyTheme() {
      const s = Store.get('settings');
      let theme = s.theme || 'system';
      if (theme === 'system') {
        theme = (global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', theme);
      // 同步状态栏颜色（原生App）
      const meta = document.getElementById('meta-theme-color');
      if (meta) meta.setAttribute('content', theme === 'dark' ? '#17151c' : '#ec7a96');
    },

    /* 主题切换：液态圆形扩散动画（从点击位置晕开） */
    switchTheme(next, x, y) {
      const reveal = document.getElementById('theme-reveal');
      const docEl = document.documentElement;
      const cur = docEl.getAttribute('data-theme') || 'light';
      const target = next === 'system'
        ? ((global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light')
        : next;
      const commit = () => {
        const s = Store.get('settings'); s.theme = next; Store.set('settings', s);
        this.applyTheme();
      };
      if (!reveal || target === cur) { commit(); return; }
      const R = Math.hypot(Math.max(x || 0, global.innerWidth - (x || 0)), Math.max(y || 0, global.innerHeight - (y || 0))) + 40;
      // 用目标主题的底色做扩散幕布
      reveal.style.background = target === 'dark' ? '#17151c' : '#fcf6f2';
      reveal.style.transition = 'none';
      reveal.style.opacity = '1';
      reveal.style.clipPath = 'circle(0px at ' + (x || global.innerWidth / 2) + 'px ' + (y || 40) + 'px)';
      reveal.style.display = 'block';
      requestAnimationFrame(() => {
        commit();
        requestAnimationFrame(() => {
          reveal.style.transition = 'clip-path .55s cubic-bezier(.22,.61,.36,1)';
          reveal.style.clipPath = 'circle(' + R + 'px at ' + (x || global.innerWidth / 2) + 'px ' + (y || 40) + 'px)';
          setTimeout(() => {
            reveal.style.display = 'none';
            reveal.style.clipPath = 'none';
            Utils.toast(next === 'dark' ? '已切换深色模式' : next === 'light' ? '已切换浅色模式' : '已跟随系统', 'info');
          }, 580);
        });
      });
    },

    /* 跟随系统：监听系统深浅变化 */
    bindSystemTheme() {
      if (this._sysThemeBound || !global.matchMedia) return;
      this._sysThemeBound = true;
      const mq = global.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        const s = Store.get('settings');
        if ((s.theme || 'system') === 'system') this.applyTheme();
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    },

    /* ---------- 自定义背景 ---------- */
    applyCustomBg() {
      const s = Store.get('settings');
      const bg = document.getElementById('custom-bg');
      const scrim = document.getElementById('custom-bg-scrim');
      if (!bg || !scrim) return;
      const has = !!s.customBg;
      document.documentElement.classList.toggle('has-custom-bg', has);
      bg.style.backgroundImage = has ? 'url(' + s.customBg + ')' : 'none';
      const blurOn = s.customBgBlur !== false;
      bg.style.filter = blurOn ? ('blur(' + (s.customBgBlurPx || 18) + 'px)') : 'none';
      bg.style.transform = blurOn ? 'scale(1.1)' : 'none';
      scrim.style.background = 'rgba(0, 0, 0, ' + ((s.customBgDim != null ? s.customBgDim : 35) / 100).toFixed(2) + ')';
    },

    /* 选择图片：压缩到最长边 1440 的 JPEG 再存入本地设置 */
    pickCustomBg(file) {
      if (!file) return;
      const self = this;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 1440;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          let data;
          try { data = canvas.toDataURL('image/jpeg', 0.82); } catch (e) { Utils.toast('图片处理失败', 'error'); return; }
          const s = Store.get('settings');
          s.customBg = data;
          Store.set('settings', s);
          self.applyCustomBg();
          Utils.toast('自定义背景已启用', 'success');
          self.reload();
        };
        img.onerror = () => Utils.toast('图片读取失败', 'error');
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    },

    setCustomBgOption(key, val, rerender) {
      const s = Store.get('settings'); s[key] = val; Store.set('settings', s);
      this.applyCustomBg();
      if (rerender) this.reload();
    },

    /* ---------- 路由 ---------- */
    route(name) {
      this.state.currentRoute = name;

      const view = document.getElementById('view');
      const v = this.views[name];
      view.innerHTML = v.render();
      v.mount(view);

      // 更新导航高亮
      document.querySelectorAll('#tabbar .tab').forEach((t) => {
        t.classList.toggle('active', t.dataset.route === name);
      });

      this.enhanceSegs(view);
      this.state.pendingFocus = null;
    },

    /* ---------- 分段控件滑块（液态动效） ---------- */
    /* 为 .seg 注入滑动跟随的白色圆角滑块；不改变无 JS 时的回退样式 */
    enhanceSegs(root) {
      (root || document).querySelectorAll('.seg:not(.seg-scroll)').forEach((seg) => {
        const active = seg.querySelector('button.active');
        if (!seg._thumb) {
          if (!active) return;
          const thumb = document.createElement('span');
          thumb.className = 'seg-thumb';
          seg.insertBefore(thumb, seg.firstChild);
          seg._thumb = thumb;
          this.placeSegThumb(seg);
          // 首帧定位后再开启过渡，避免滑块从 0 位置飞入
          requestAnimationFrame(() => requestAnimationFrame(() => seg.classList.add('has-thumb')));
        } else {
          this.placeSegThumb(seg);
        }
      });
    },

    placeSegThumb(seg) {
      const thumb = seg._thumb;
      if (!thumb) return;
      const active = seg.querySelector('button.active');
      if (!active) { thumb.style.width = '0px'; return; }
      thumb.style.width = active.offsetWidth + 'px';
      thumb.style.transform = 'translateX(' + active.offsetLeft + 'px)';
    },

    /* 点击切换时就地移动滑块并更新高亮（供不整页刷新的切换使用） */
    moveSegThumb(seg, btn) {
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      this.placeSegThumb(seg);
    },

    reload() {
      this.route(this.state.currentRoute);
    },

    renderNav() {
      document.querySelectorAll('#tabbar .tab').forEach((t) => {
        t.addEventListener('click', () => this.route(t.dataset.route));
      });
    },

    /* ---------- 视图映射 ---------- */
    views: {
      home: {
        render() { return App.homeHTML(); },
        mount(c) { App.mountHome(c); }
      },
      records: global.RecordsView,
      prenatal: global.PrenatalView,
      diet: global.DietView,
      medication: global.MedicationView,
      settings: {
        render() { return App.settingsHTML(); },
        mount(c) { App.mountSettings(c); }
      }
    },

    /* ---------- 根据模式显示/隐藏产检Tab ---------- */
    updatePrenatalTab() {
      const user = Store.get('user');
      const isPreg = user.userMode === 'pregnancy';
      const tab = document.querySelector('.tab-prenatal');
      if (tab) tab.style.display = isPreg ? 'flex' : 'none';
    },

    /* ---------- 悬浮快捷按钮 ---------- */
    renderFab() {
      const s = Store.get('settings');
      const user = Store.get('user');
      let order = s.quickActions || ['weight', 'sugar', 'diet', 'med'];
      // 孕期模式追加产检/胎动快捷入口
      if (user.userMode === 'pregnancy') {
        order = order.concat(['prenatal', 'kick']);
      }
      const menu = document.getElementById('fab-menu');
      menu.innerHTML = order.map((k) => {
        const q = QUICK[k]; if (!q) return '';
        return '<div class="fab-item"><span class="fab-label">' + q.label + '</span>' +
          '<button data-quick="' + k + '" style="background:' + q.color + '">' +
          '<svg class="ico"><use href="#' + q.svg + '"/></svg></button></div>';
      }).join('');
      menu.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => {
        document.getElementById('fab-wrap').classList.remove('open');
        this.openQuick(b.dataset.quick);
      }));
    },

    openQuick(action) {
      if (action === 'weight') { this.state.recordsTab = 'weight'; this.state.pendingFocus = 'weight'; this.route('records'); }
      else if (action === 'sugar') { this.state.recordsTab = 'sugar'; this.state.pendingFocus = 'sugar'; this.state.sugarInputScene = null; this.state.sugarInputSceneManual = false; this.route('records'); }
      else if (action === 'diet') { this.state.dietTab = 'record'; this.state.pendingFocus = 'diet'; this.route('diet'); }
      else if (action === 'med') { this.state.medTab = 'meds'; this.route('medication'); }
      else if (action === 'prenatal') { this.state.prenatalTab = 'ultrasound'; this.route('prenatal'); }
      else if (action === 'kick') { this.state.prenatalTab = 'kick'; this.route('prenatal'); }
    },

    /* ---------- 提醒排程（用药 + 用餐联动） ---------- */
    // 某药品的实际提醒时间：相对用餐的按用餐时间+偏移计算，否则用固定时间
    effectiveMedTimes(m) {
      if (m.mealRef) {
        const s = Store.get('settings');
        const mt = (s.mealTimes || Store.DEFAULT_MEAL_TIMES)[m.mealRef];
        if (mt) return [Utils.addMinToTime(mt, m.offsetMin || 30)];
        return [];
      }
      return m.times || [];
    },

    // 统一提醒时间轴（用餐 + 用药，按时间排序）
    buildSchedule() {
      const d = Utils.todayStr();
      const s = Store.get('settings');
      const mealTimes = s.mealTimes || Store.DEFAULT_MEAL_TIMES;
      const now = Utils.timeStr();
      const out = [];
      MEAL_DEFS.forEach((md) => {
        const t = mealTimes[md.key];
        if (!t) return;
        out.push({ type: 'meal', key: md.key, label: md.label, svg: md.svg, time: t, past: t < now });
      });
      Store.get('meds', []).forEach((m) => {
        if (!m.enabled) return;
        this.effectiveMedTimes(m).forEach((t) => {
          const log = Store.get('medLogs', []).find((l) => l.medId === m.id && l.date === d && l.time === t);
          const status = log ? log.status : (t < now ? 'missed' : 'pending');
          out.push({ type: 'med', medId: m.id, name: m.name, time: t, status: status, mealRef: m.mealRef });
        });
      });
      return out.sort((a, b) => a.time < b.time ? -1 : 1);
    },

    /* ---------- 首次启动引导 ---------- */
    showOnboarding() {
      const view = document.getElementById('view');
      const steps = [
        {
          img: 'img/welcome.jpg',
          title: '欢迎使用暖语',
          desc: '您的贴身健康管家，记录体重血糖、管理饮食任务，陪您养成健康好习惯。'
        },
        {
          img: 'img/hero-banner.jpg',
          title: '记录体重血糖',
          desc: '便捷记录体重与血糖，趋势图表一目了然，异常值及时提醒。'
        },
        {
          img: 'img/empty-note.jpg',
          title: '饮食红绿灯',
          desc: '科学的食材分级系统，帮您轻松控糖，吃对每一口。'
        }
      ];
      let step = 0;
      let selectedMode = Store.get('user').userMode || 'general';

      const render = () => {
        const s = steps[step];
        const dots = steps.map((_, i) => '<span class="' + (i === step ? 'on' : '') + '"></span>').join('');
        const isLast = step === steps.length - 1;
        const u = Store.get('user');

        // 最后一步显示模式选择和个人资料表单
        const modeSection = isLast ?
          '<div class="mode-select mt16">' +
          '  <div class="mode-card ' + (selectedMode === 'general' ? 'active' : '') + '" data-mode="general">' +
          '    <svg class="ico ico-xl"><use href="#i-heart"/></svg>' +
          '    <div class="mode-title">通用健康管理</div>' +
          '    <div class="mode-desc">体重、血糖、饮食全面管理</div>' +
          '  </div>' +
          '  <div class="mode-card ' + (selectedMode === 'pregnancy' ? 'active' : '') + '" data-mode="pregnancy">' +
          '    <svg class="ico ico-xl"><use href="#i-baby"/></svg>' +
          '    <div class="mode-title">孕期模式</div>' +
          '    <div class="mode-desc">孕周跟踪、双胎专属目标</div>' +
          '  </div>' +
          '</div>' : '';

        const profileSection = isLast ?
          '<div class="field mt16"><label class="label">您的称呼（选填）</label>' +
          '  <input class="input" id="ob-name" placeholder="您的昵称" value="' + Utils.esc(u.name || '') + '"></div>' +
          (selectedMode === 'pregnancy' ?
            '<div class="row"><div class="field grow"><label class="label">当前孕周</label>' +
            '  <input class="input" id="ob-week" type="number" inputmode="numeric" placeholder="如 24" value="' + Utils.esc(u.gestationalWeek || '') + '"></div>' +
            '  <div class="field grow"><label class="label">身高(cm)</label>' +
            '  <input class="input" id="ob-height" type="number" inputmode="decimal" value="' + Utils.esc(u.height || '') + '"></div></div>' +
            '<div class="field"><label class="label">胎数类型</label><select class="select" id="ob-twin">' +
            '  <option value="single"' + (u.twinType === 'single' ? ' selected' : '') + '>单胎</option>' +
            '  <option value="dichorionic"' + (u.twinType === 'dichorionic' ? ' selected' : '') + '>双绒毛膜双胎</option>' +
            '  <option value="monochorionic"' + (u.twinType === 'monochorionic' ? ' selected' : '') + '>单绒毛膜双胎</option>' +
            '  <option value="unknown"' + (u.twinType === 'unknown' ? ' selected' : '') + '>暂不确定</option>' +
            '</select></div>' +
            '<div class="row"><div class="field grow"><label class="label">宝宝昵称（选填）</label>' +
            '  <input class="input" id="ob-bname1" placeholder="宝宝" value="' + Utils.esc((u.babyNames || [])[0] || '') + '"></div>' +
            '  <div class="field grow" id="ob-bname2-wrap"><label class="label">宝宝B昵称（双胎）</label>' +
            '  <input class="input" id="ob-bname2" placeholder="宝宝B" value="' + Utils.esc((u.babyNames || [])[1] || '') + '"></div></div>'
            :
            '<div class="row"><div class="field grow"><label class="label">身高(cm)</label>' +
            '  <input class="input" id="ob-height" type="number" inputmode="decimal" placeholder="如 165" value="' + Utils.esc(u.height || '') + '"></div>' +
            '  <div class="field grow"><label class="label">体重目标</label>' +
            '  <select class="select" id="ob-goalmode">' +
            '    <option value="maintain">保持体重</option>' +
            '    <option value="lose">减重</option>' +
            '    <option value="gain">增重</option>' +
            '  </select></div></div>'
          ) : '';

        view.innerHTML =
          '<div class="onboard">' +
          '  <img src="' + s.img + '" alt="' + s.title + '" onerror="this.style.display=\'none\'">' +
          '  <h2>' + s.title + '</h2>' +
          '  <p>' + s.desc + '</p>' +
          '  <div class="onboard-dots">' + dots + '</div>' +
          modeSection +
          profileSection +
          '  <button class="btn btn-primary btn-block mt12" id="ob-next">' + (isLast ? '开始使用' : '下一步') + '</button>' +
          (step > 0 ? '<button class="btn btn-ghost btn-block mt8" id="ob-prev">上一步</button>' : '') +
          '  <button class="btn btn-ghost btn-block mt8" id="ob-skip" style="font-size:13px;opacity:.7">跳过引导</button>' +
          '</div>';

        // 模式选择
        if (isLast) {
          view.querySelectorAll('.mode-card').forEach((card) => {
            card.addEventListener('click', () => {
              selectedMode = card.dataset.mode;
              render();
              // 恢复滚动位置
              view.scrollTop = view.scrollHeight;
            });
          });
          // 胎数切换：双胎时才显示宝宝B昵称
          const obTwin = view.querySelector('#ob-twin');
          if (obTwin) obTwin.addEventListener('change', () => {
            const b2 = view.querySelector('#ob-bname2-wrap');
            if (b2) b2.style.display = (obTwin.value === 'dichorionic' || obTwin.value === 'monochorionic') ? '' : 'none';
          });
          const obTwinInit = view.querySelector('#ob-twin');
          const obB2 = view.querySelector('#ob-bname2-wrap');
          if (obTwinInit && obB2) obB2.style.display = (obTwinInit.value === 'dichorionic' || obTwinInit.value === 'monochorionic') ? '' : 'none';
        }

        view.querySelector('#ob-next').addEventListener('click', () => {
          const user = Store.get('user');
          const nameEl = view.querySelector('#ob-name');
          if (nameEl) user.name = nameEl.value.trim();
          user.userMode = selectedMode;

          if (selectedMode === 'pregnancy') {
            const weekEl = view.querySelector('#ob-week');
            const heightEl = view.querySelector('#ob-height');
            const twinEl = view.querySelector('#ob-twin');
            if (weekEl) user.gestationalWeek = weekEl.value;
            if (heightEl) user.height = heightEl.value;
            if (twinEl) user.twinType = twinEl.value;
            // 宝宝昵称
            const bn1 = view.querySelector('#ob-bname1');
            const bn2 = view.querySelector('#ob-bname2');
            if (bn1) user.babyNames = [bn1.value.trim(), bn2 ? bn2.value.trim() : ''];
            // 孕期模式预置用药
            if (!Store.get('meds', null) || !Store.get('meds', []).length) {
              Store.set('meds', Store.seedMeds ? Store.seedMeds() : []);
            }
          } else {
            const heightEl = view.querySelector('#ob-height');
            const goalEl = view.querySelector('#ob-goalmode');
            if (heightEl) user.height = heightEl.value;
            if (goalEl) {
              const s = Store.get('settings');
              s.healthGoals.weightGoalMode = goalEl.value;
              Store.set('settings', s);
            }
          }
          Store.set('user', user);

          if (isLast) {
            Store.set('onboarded', true);
            this.updatePrenatalTab();
            this.route('home');
            this.renderFab();
            this.startScheduler();
            Utils.toast('欢迎加入暖语', 'success');
          } else {
            step++;
            render();
          }
        });
        const prev = view.querySelector('#ob-prev');
        if (prev) prev.addEventListener('click', () => { step--; render(); });
        view.querySelector('#ob-skip').addEventListener('click', () => {
          const user = Store.get('user');
          user.userMode = selectedMode;
          Store.set('user', user);
          Store.set('onboarded', true);
          this.updatePrenatalTab();
          this.route('home');
          this.renderFab();
          this.startScheduler();
        });
      };
      render();
    },

    /* ---------- 首页 ---------- */
    homeHTML() {
      const h = new Date().getHours();
      const greet = h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
      const user = Store.get('user');
      const settings = Store.get('settings');
      const isPreg = user.userMode === 'pregnancy';
      let wk;
      if (isPreg && user.gestationalWeek) {
        wk = '孕 ' + user.gestationalWeek + ' 周';
      } else if (isPreg) {
        wk = '孕期管理';
      } else {
        const modeLabel = settings.healthGoals.weightGoalMode === 'lose' ? '减重管理' :
          settings.healthGoals.weightGoalMode === 'gain' ? '增重管理' : '健康管理';
        wk = modeLabel;
      }
      const dateLabel = Utils.fmtDateCN(Utils.todayStr()) + ' · ' + ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date().getDay()];

      const weights = Store.get('weights', []).slice().sort(Utils.byDateDesc);
      const sugars = Store.get('sugars', []).slice().sort(Utils.byDateDesc);

      /* 指标卡元信息：场景/时间 + 较上次变化 */
      const tdy = Utils.todayStr();
      const whenLabel = (r) => r.date === tdy ? (r.time || '').slice(0, 5) : Utils.fmtDateShort(r.date);
      const deltaHTML = (diff, unit) => {
        if (!isFinite(diff)) return '';
        const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
        const arrow = diff > 0 ? '<svg class="ico ico-xs"><use href="#i-trending-up"/></svg>'
          : diff < 0 ? '<svg class="ico ico-xs"><use href="#i-trending-down"/></svg>' : '';
        const num = (diff > 0 ? '+' : '') + Utils.round(diff, 1);
        return '<span class="stat-delta ' + cls + '">' + arrow + num + (unit ? '<i>' + unit + '</i>' : '') + '</span>';
      };

      // 血糖
      const latestSugar = sugars[0];
      const sUnit = settings.sugarUnit || 'mmol';
      const sDisp = latestSugar ? (sUnit === 'mmol' ? latestSugar.value : Utils.mmolToMgdl(latestSugar.value)) : '--';
      const sStatus = latestSugar ? this.sugarStatusText(latestSugar) : { label: '待记录', cls: 'badge-gray' };
      let sMeta = '<span class="muted">记录第一笔血糖</span>';
      if (latestSugar) {
        const prev = sugars.slice(1).find((x) => x.scene === latestSugar.scene);
        const scene = this.sugarSceneLabel(latestSugar);
        const diff = prev ? deltaHTML((sUnit === 'mmol' ? latestSugar.value - prev.value
          : Utils.mmolToMgdl(latestSugar.value) - Utils.mmolToMgdl(prev.value)), sUnit === 'mmol' ? '' : '') : '';
        sMeta = Utils.esc(scene) + ' · ' + whenLabel(latestSugar) + (diff ? ' <span class="muted">较上次</span> ' + diff : '');
      }

      // 体重
      const latestW = weights[0];
      const wUnit = settings.unit || 'kg';
      const wDisp = latestW ? (wUnit === 'kg' ? Utils.round(latestW.value, 1) : Utils.kgToLb(latestW.value)) : '--';
      const wStatus = latestW ? this.weightStatusText() : { label: '待记录', cls: 'badge-gray' };
      let wMeta = '<span class="muted">记录第一笔体重</span>';
      if (latestW) {
        if (weights[1]) {
          const diff = wUnit === 'kg'
            ? latestW.value - weights[1].value
            : Utils.kgToLb(latestW.value) - Utils.kgToLb(weights[1].value);
          wMeta = '<span class="muted">较上次 · ' + Utils.fmtDateShort(weights[1].date) + '</span> ' + deltaHTML(diff, wUnit);
        } else {
          wMeta = '<span class="muted">已开始记录 · ' + Utils.fmtDateShort(latestW.date) + '</span>';
        }
      }

      // 依从率
      const comp = global.MedicationView.compliance(7);

      // 今日饮食完成度
      const today = Utils.todayStr();
      const totals = global.DietView.dayTotals(today);
      const calorieTarget = settings.healthGoals.calorieTarget || 2000;
      const caloriePct = Math.min(100, Math.round(totals.kcal / calorieTarget * 100));
      const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
      const recordedMeals = meals.filter((m) => Store.get('diets', []).some((d) => d.date === today && d.meal === m)).length;
      const mealPct = Math.round(recordedMeals / 4 * 100);

      // 综合健康分（简易：用药依从率30% + 饮食记录25% + 血糖正常25% + 体重达标20%）
      let healthScore = 0;
      healthScore += comp.rate * 0.3;
      healthScore += mealPct * 0.25;
      if (latestSugar) {
        const st = this.sugarStatusText(latestSugar);
        healthScore += (st.cls === 'badge-green' ? 100 : st.cls === 'badge-yellow' ? 60 : 30) * 0.25;
      }
      if (latestW) {
        const wst = this.weightStatusText();
        healthScore += (wst.cls === 'badge-green' || wst.cls === 'badge-blue' ? 100 : wst.cls === 'badge-yellow' ? 60 : 30) * 0.2;
      }
      healthScore = Math.round(healthScore);

      return [
        this.heroHTML(greet, user.name, wk, dateLabel, healthScore),
        '<div class="grid-2 stat-grid">',
        this.statCardHTML('sugar', 'i-droplet', '血糖', sDisp, (sUnit === 'mmol' ? 'mmol/L' : 'mg/dL'), sStatus, sMeta),
        this.statCardHTML('weight', 'i-scale', '体重', wDisp, wUnit, wStatus, wMeta),
        '</div>',
        isPreg ? this.homePrenatalCardHTML() : '',
        this.quickActionsHTML(),
        this.homeMedTimelineHTML(),
        this.homeDietHTML(totals, calorieTarget, caloriePct, recordedMeals),
        '<div class="card card-hover" data-goto="medication" style="cursor:pointer">',
        '  <div class="card-title"><svg class="ico"><use href="#i-bell"/></svg>本周任务完成率 <span class="more">查看 ›</span></div>',
        '  <div class="row between mb8"><span class="stat-value num" style="color:var(--success)">' + comp.rate + '%</span>',
        '  <span class="small muted">已完成 ' + comp.taken + ' / ' + comp.scheduled + ' 次</span></div>',
        '  <div class="progress"><span style="width:' + comp.rate + '%"></span></div>',
        '</div>'
      ].join('');
    },

    heroHTML(greet, name, wk, dateLabel, healthScore) {
      const scoreColor = healthScore >= 80 ? 'var(--success)' : healthScore >= 60 ? 'var(--warning)' : 'var(--danger)';
      const circumference = 2 * Math.PI * 42;
      const offset = circumference - (healthScore / 100) * circumference;
      return [
        '<div class="hero-card">',
        '  <img src="img/hero-banner.jpg" alt="" class="hero-img" onerror="this.style.display=\'none\'">',
        '  <div class="row between" style="position:relative;z-index:1">',
        '    <div style="flex:1;min-width:0">',
        '      <div class="small" style="opacity:.85">' + dateLabel + '</div>',
        '      <div style="font-size:22px;font-weight:800;margin-top:4px">' + greet + (name ? '，' + Utils.esc(name) : '') + '</div>',
        '      <div style="margin-top:4px;font-size:14px;opacity:.92">' + Utils.esc(wk) + '</div>',
        '    </div>',
        '    <div class="ring-wrap" style="flex-shrink:0">',
        '      <svg width="96" height="96" viewBox="0 0 100 100">',
        '        <circle class="ring-track" cx="50" cy="50" r="42" fill="none" stroke-width="7" opacity="0.25"/>',
        '        <circle class="ring-fill" cx="50" cy="50" r="42" fill="none" stroke-width="7"',
        '          stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '"/>',
        '      </svg>',
        '      <div class="ring-center"><div class="ring-num" style="color:#fff">' + healthScore + '</div><div class="ring-cap" style="color:rgba(255,255,255,.8)">健康分</div></div>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');
    },

    quickActionsHTML() {
      const user = Store.get('user');
      const isPreg = user.userMode === 'pregnancy';
      const actions = [
        { key: 'weight', label: '记体重', svg: 'i-scale' },
        { key: 'sugar', label: '记血糖', svg: 'i-droplet' },
        { key: 'diet', label: '记饮食', svg: 'i-salad' },
        { key: 'med', label: '记任务', svg: 'i-pill' }
      ];
      if (isPreg) {
        actions.push({ key: 'prenatal', label: '记产检', svg: 'i-clipboard' });
        actions.push({ key: 'kick', label: '数胎动', svg: 'i-activity' });
      }
      return [
        '<div class="grid-2" style="margin-bottom:14px">',
        actions.map((a) => {
          const q = QUICK[a.key];
          return '<div class="quick-add" data-quick-action="' + a.key + '">' +
            '<div class="qa-ico" style="background:' + q.color + '"><svg class="ico"><use href="#' + a.svg + '"/></svg></div>' +
            '<div><div class="qa-title">' + a.label + '</div><div class="qa-sub">点击快速记录</div></div></div>';
        }).join(''),
        '</div>'
      ].join('');
    },

    sugarSceneLabel(r) {
      const s = Data.SUGAR_SCENES.find((x) => x.key === r.scene);
      if (r.scene === 'afterMealCustom' && r.customHours) return '餐后' + r.customHours + 'h';
      return s ? s.label : '';
    },

    statCardHTML(key, svg, label, value, unit, status, meta) {
      // 液态玻璃质感：彩色晕染底 + 高光描边 + 彩色图标章
      const tint = key === 'sugar' ? 'var(--grad-warm)' : 'var(--grad-sage)';
      return [
        '<div class="card stat-card stat-' + key + ' card-hover liquid" data-goto="records" data-sub="' + key + '" style="cursor:pointer">',
        '  <div class="stat-head">',
        '    <span class="stat-chip" style="background:' + tint + '"><svg class="ico"><use href="#' + svg + '"/></svg></span>',
        '    <span class="stat-label">' + label + '</span>',
        '    <span class="badge ' + status.cls + '">' + status.label + '</span>',
        '  </div>',
        '  <div class="mt8"><span class="stat-value num">' + value + '</span><span class="stat-unit">' + unit + '</span></div>',
        '  <div class="stat-meta">' + (meta || '') + '</div>',
        '  <div class="spark" id="spark-' + key + '"></div>',
        '</div>'
      ].join('');
    },

    homeMedTimelineHTML() {
      const schedule = this.buildSchedule();
      const items = schedule.slice(0, 5).map((s) => {
        if (s.type === 'meal') {
          return '<div class="tl-item meal"><div class="row between">' +
            '<div class="grow"><span class="bold"><svg class="ico ico-sm" style="vertical-align:-3px;margin-right:4px"><use href="#' + (s.svg || 'i-leaf') + '"/></svg>' + Utils.esc(s.label) + '</span></div>' +
            '<span class="small muted num">' + s.time + '</span>' +
            '<span class="badge ' + (s.past ? 'badge-gray' : 'badge-blue') + '" style="margin-left:6px">' + (s.past ? '已到点' : '待用餐') + '</span></div></div>';
        }
        const st = { taken: 'badge-green', missed: 'badge-red', skipped: 'badge-gray', pending: 'badge-blue' }[s.status];
        const label = { taken: '已完成', missed: '未完成', skipped: '跳过', pending: '待完成' }[s.status];
        return '<div class="tl-item ' + s.status + '"><div class="row between">' +
          '<div class="grow"><span class="bold"><svg class="ico ico-sm" style="vertical-align:-3px;margin-right:4px"><use href="#i-pill"/></svg>' + Utils.esc(s.name) + '</span></div>' +
          '<span class="small muted num">' + s.time + '</span> ' +
          '<span class="badge ' + st + '" style="margin-left:6px">' + label + '</span></div></div>';
      }).join('');
      return [
        '<div class="card" data-goto="medication" style="cursor:pointer">',
        '  <div class="card-title"><svg class="ico"><use href="#i-clock"/></svg>今日提醒 <span class="more">全部 ›</span></div>',
        schedule.length ? '<div class="timeline">' + items + '</div>' : '<div class="empty-state"><p>暂无提醒，去添加任务或设置用餐时间</p></div>',
        '</div>'
      ].join('');
    },

    homeDietHTML(totals, calorieTarget, caloriePct, recordedMeals) {
      totals = totals || global.DietView.dayTotals(Utils.todayStr());
      const s = Store.get('settings');
      calorieTarget = calorieTarget || (s.healthGoals && s.healthGoals.calorieTarget) || 2000;
      caloriePct = caloriePct != null ? caloriePct : Math.min(100, Math.round(totals.kcal / calorieTarget * 100));
      recordedMeals = recordedMeals != null ? recordedMeals : ['breakfast', 'lunch', 'dinner', 'snack'].filter((m) => Store.get('diets', []).some((d) => d.date === Utils.todayStr() && d.meal === m)).length;
      return [
        '<div class="card" data-goto="diet" style="cursor:pointer">',
        '  <div class="card-title"><svg class="ico"><use href="#i-salad"/></svg>今日饮食 <span class="more">记录 ›</span></div>',
        '  <div class="row between mb8"><span class="small">已记录 ' + recordedMeals + '/4 餐次</span><span class="bold num">' + totals.kcal + ' / ' + calorieTarget + ' 千卡</span></div>',
        '  <div class="progress mb12"><span style="width:' + caloriePct + '%"></span></div>',
        '  <div class="row wrap small muted">',
        '    <span>碳水 ' + totals.c + 'g</span><span style="margin:0 12px">蛋白 ' + totals.p + 'g</span><span>脂肪 ' + totals.f + 'g</span>',
        '  </div>',
        '</div>'
      ].join('');
    },

    /* ---------- 首页产检摘要卡片（孕期模式） ---------- */
    homePrenatalCardHTML() {
      const scans = Store.get('fetalScans', []).slice().sort(Utils.byDateDesc);
      const bps = Store.get('bloodPressure', []).slice().sort(Utils.byDateDesc);
      const kicks = Store.get('kickCounts', []).slice().sort(Utils.byDateDesc);
      const user = Store.get('user');
      const twin = user.twinType === 'dichorionic' || user.twinType === 'monochorionic';
      const names = user.babyNames || [];
      const n1 = twin ? (names[0] || '宝宝A') : (names[0] || '宝宝');
      const n2 = twin ? (names[1] || '宝宝B') : '';

      let fetalInfo = '<span class="muted small">暂无B超数据</span>';
      if (scans.length > 0) {
        const latest = scans[0];
        const w1 = latest.baby1 ? Data.calcEFW(latest.baby1.bpd, latest.baby1.hc, latest.baby1.ac, latest.baby1.fl) : null;
        if (w1) {
          fetalInfo = '<span class="bold num">' + w1 + 'g</span><span class="muted small" style="margin-left:4px">' + Utils.esc(n1) + '</span>';
          if (twin && latest.baby2) {
            const w2 = Data.calcEFW(latest.baby2.bpd, latest.baby2.hc, latest.baby2.ac, latest.baby2.fl);
            if (w2) fetalInfo += '<span class="muted small" style="margin-left:6px">/ ' + w2 + 'g ' + Utils.esc(n2) + '</span>';
          }
        }
      }

      const bpInfo = bps.length > 0
        ? '<span class="bold num">' + bps[0].sys + '/' + bps[0].dia + '</span><span class="muted small" style="margin-left:4px">mmHg</span>'
        : '<span class="muted small">暂无</span>';

      const kickInfo = kicks.length > 0
        ? '<span class="bold num">' + kicks[0].count + '</span><span class="muted small" style="margin-left:4px">次/' + kicks[0].duration + '分</span>'
        : '<span class="muted small">今日未数</span>';

      return [
        '<div class="card card-hover" data-goto="prenatal" style="cursor:pointer;background:var(--grad-soft);border:none">',
        '  <div class="card-title"><svg class="ico"><use href="#i-baby"/></svg>产检概览 <span class="more">查看 ›</span></div>',
        '  <div class="row" style="gap:10px">',
        '    <div class="prenatal-stat"><div class="ps-label"><svg class="ico ico-sm"><use href="#i-scale"/></svg> 胎儿估重</div><div class="ps-val">' + fetalInfo + '</div></div>',
        '    <div class="prenatal-stat"><div class="ps-label"><svg class="ico ico-sm"><use href="#i-heart-pulse"/></svg> 血压</div><div class="ps-val">' + bpInfo + '</div></div>',
        '    <div class="prenatal-stat"><div class="ps-label"><svg class="ico ico-sm"><use href="#i-activity"/></svg> 胎动</div><div class="ps-val">' + kickInfo + '</div></div>',
        '  </div>',
        '</div>'
      ].join('');
    },

    sugarStatusText(r) {
      const g = Store.get('settings').healthGoals || {};
      const t = Data.resolveSugar(r.scene, r.customHours);
      // 低血糖预警
      if (g.sugarLowWarn && r.value < Number(g.sugarLowWarn)) return { label: '低血糖', cls: 'badge-red' };
      if (r.value < t.low) return { label: '偏低', cls: 'badge-yellow' };
      if (r.value > t.high) return { label: '偏高', cls: 'badge-red' };
      return { label: '正常', cls: 'badge-green' };
    },

    weightStatusText() {
      const list = Store.get('weights', []).slice().sort(Utils.byDateDesc);
      const settings = Store.get('settings');
      const g = settings.healthGoals;
      const user = Store.get('user');
      if (list.length < 2) {
        // 只有一条记录时，检查是否在目标范围内
        if (list.length === 1 && (g.weightHigh || g.weightLow)) {
          const v = list[0].value;
          if (g.weightHigh && v > Number(g.weightHigh)) return { label: '超标', cls: 'badge-red' };
          if (g.weightLow && v < Number(g.weightLow)) return { label: '偏低', cls: 'badge-yellow' };
        }
        // 检查BMI
        if (list.length === 1 && user.height && user.userMode !== 'pregnancy') {
          const bmi = list[0].value / Math.pow(Number(user.height) / 100, 2);
          if (bmi >= 28) return { label: '肥胖', cls: 'badge-red' };
          if (bmi >= 24) return { label: '超重', cls: 'badge-yellow' };
          if (bmi < 18.5) return { label: '偏瘦', cls: 'badge-blue' };
        }
        return { label: '正常', cls: 'badge-green' };
      }
      const days = (Utils.parseDate(list[0].date) - Utils.parseDate(list[1].date)) / 86400000;
      if (days <= 0) return { label: '正常', cls: 'badge-green' };
      const weekly = ((list[0].value - list[1].value) / days) * 7;

      // 孕期模式：使用孕期增重标准
      if (user.userMode === 'pregnancy') {
        if (weekly > 0.75) return { label: '偏快', cls: 'badge-yellow' };
        if (weekly < 0.5) return { label: '偏慢', cls: 'badge-blue' };
        return { label: '适宜', cls: 'badge-green' };
      }

      // 通用模式：根据目标模式判断
      const goalMode = g.weightGoalMode || 'maintain';
      const maxGain = g.weeklyGainMax ? Number(g.weeklyGainMax) : 0.5;
      const maxLoss = g.weeklyLossMax ? Number(g.weeklyLossMax) : 0.5;

      if (goalMode === 'lose') {
        // 减重模式：每周减重0.3~0.5kg为宜
        if (weekly < -maxLoss) return { label: '过快', cls: 'badge-red' };
        if (weekly < -0.2) return { label: '达标', cls: 'badge-green' };
        if (weekly > maxGain) return { label: '反弹', cls: 'badge-yellow' };
        return { label: '平稳', cls: 'badge-blue' };
      } else if (goalMode === 'gain') {
        // 增重模式
        if (weekly > maxGain * 2) return { label: '偏快', cls: 'badge-yellow' };
        if (weekly > 0.1) return { label: '增重中', cls: 'badge-green' };
        return { label: '偏慢', cls: 'badge-blue' };
      } else {
        // 保持模式：波动在±0.3kg/周内
        if (Math.abs(weekly) > maxGain) return { label: '波动大', cls: 'badge-yellow' };
        return { label: '稳定', cls: 'badge-green' };
      }
    },

    mountHome(container) {
      // 迷你趋势图
      const weights = Store.get('weights', []).slice().sort((a, b) => (a.date + a.time) < (b.date + b.time) ? -1 : 1).slice(-10).map((r) => r.value);
      const sugars = Store.get('sugars', []).slice().sort((a, b) => (a.date + a.time) < (b.date + b.time) ? -1 : 1).slice(-10).map((r) => r.value);
      Charts.spark(container.querySelector('#spark-weight'), { values: weights, color: 'var(--success)' });
      Charts.spark(container.querySelector('#spark-sugar'), { values: sugars, color: 'var(--info)' });

      // 卡片跳转
      container.querySelectorAll('[data-goto]').forEach((el) => el.addEventListener('click', () => {
        const r = el.dataset.goto;
        if (el.dataset.sub === 'sugar') { this.state.recordsTab = 'sugar'; }
        else if (el.dataset.sub === 'weight') { this.state.recordsTab = 'weight'; }
        else if (r === 'diet') { this.state.dietTab = 'record'; }
        else if (r === 'medication') { this.state.medTab = 'plan'; }
        else if (r === 'records') { this.state.recordsTab = 'weight'; }
        else if (r === 'prenatal') { this.state.prenatalTab = 'ultrasound'; }
        this.route(r);
      }));

      // 首页快捷操作卡片
      container.querySelectorAll('[data-quick-action]').forEach((el) => el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openQuick(el.dataset.quickAction);
      }));
    },

    /* ---------- 局部刷新（避免整页重渲染） ---------- */
    refreshHome() {
      if (this.state.currentRoute !== 'home') return;
      const view = document.getElementById('view');
      // 淡入淡出刷新
      view.style.opacity = '0.6';
      view.style.transform = 'translateY(4px)';
      view.style.transition = 'opacity .2s, transform .2s';
      setTimeout(() => {
        view.innerHTML = this.homeHTML();
        this.mountHome(view);
        view.style.opacity = '';
        view.style.transform = '';
      }, 120);
    },

    /* ---------- 设置页 ---------- */
    settingsHTML() {
      const user = Store.get('user');
      const s = Store.get('settings');
      const g = s.healthGoals || {};
      const ref = Data.getReference(user.userMode);
      const isPreg = user.userMode === 'pregnancy';
      const faqs = Data.FAQS.map((f, i) =>
        '<details class="faq"><summary>' + Utils.esc(f.q) + '</summary><p>' + Utils.esc(f.a) + '</p></details>'
      ).join('');
      const privacy = Data.PRIVACY_TEXT.map((p) => '<li>' + Utils.esc(p) + '</li>').join('');

      const quickList = (s.quickActions || ['weight', 'sugar', 'diet', 'med']).map((k, i) => {
        const q = QUICK[k]; if (!q) return '';
        return '<div class="list-item"><div class="li-ico" style="background:' + q.color + ';color:#fff"><svg class="ico ico-sm"><use href="#' + q.svg + '"/></svg></div>' +
          '<div class="grow li-title">' + q.label + '</div>' +
          '<button class="icon-btn" data-quick-up="' + i + '"><svg class="ico ico-sm"><use href="#i-chevron-left"/></svg></button>' +
          '<button class="icon-btn" data-quick-down="' + i + '"><svg class="ico ico-sm"><use href="#i-chevron-right"/></svg></button></div>';
      }).join('');

      return [
        '<div class="section-title">外观</div>',
        '<div class="card">',
        '  <div class="field"><label class="label">主题模式</label>',
        '    <div class="seg" id="set-theme-seg">',
        '      <button data-t="system" class="' + ((s.theme || 'system') === 'system' ? 'active' : '') + '"><svg class="ico"><use href="#i-refresh"/></svg>跟随系统</button>',
        '      <button data-t="light" class="' + (s.theme === 'light' ? 'active' : '') + '"><svg class="ico"><use href="#i-sun"/></svg>浅色</button>',
        '      <button data-t="dark" class="' + (s.theme === 'dark' ? 'active' : '') + '"><svg class="ico"><use href="#i-moon"/></svg>深色</button>',
        '    </div>',
        '  </div>',
        '  <div class="field"><label class="label"><svg class="ico ico-sm" style="vertical-align:-3px;margin-right:4px"><use href="#i-image"/></svg>自定义背景</label>',
        '    <div class="row">',
        '      <button class="btn btn-soft grow" id="set-bg-pick">' + (s.customBg ? '更换背景图片' : '选择背景图片') + '</button>',
        '      <button class="btn btn-ghost" id="set-bg-clear"' + (s.customBg ? '' : ' disabled') + '>恢复默认</button>',
        '    </div>',
        '    <input type="file" id="set-bg-file" accept="image/*" style="display:none">',
        s.customBg ? (
        '    <div class="mt12" style="height:110px;border-radius:14px;background:url(' + s.customBg + ') center/cover;border:1px solid var(--border)"></div>' +
        '    <div class="row between mt12"><span class="small bold">模糊效果</span>' +
        '      <label class="switch"><input type="checkbox" id="set-bg-blur"' + (s.customBgBlur !== false ? ' checked' : '') + '><span></span></label></div>' +
        '    <div class="row between mt8"><span class="small bold">模糊强度</span>' +
        '      <input type="range" id="set-bg-blurpx" min="4" max="30" step="2" value="' + (s.customBgBlurPx || 18) + '" style="width:150px;accent-color:var(--primary)"></div>' +
        '    <div class="row between mt8"><span class="small bold">遮罩浓度</span>' +
        '      <input type="range" id="set-bg-dim" min="0" max="60" step="5" value="' + (s.customBgDim != null ? s.customBgDim : 35) + '" style="width:150px;accent-color:var(--primary)"></div>' +
        '    <div class="hint">模糊基于当前背景实时预览；遮罩用于压暗背景、提升文字可读性。</div>'
        ) : (
        '    <div class="hint mt8">选择一张图片作为全局背景，支持模糊与遮罩调节，让玻璃卡片更有质感。</div>'
        ),
        '  </div>',
        '</div>',

        '<div class="section-title">使用模式</div>',
        '<div class="card">',
        '  <div class="mode-select">',
        '    <div class="mode-card ' + (!isPreg ? 'active' : '') + '" data-mode="general">',
        '      <svg class="ico ico-xl"><use href="#i-heart"/></svg>',
        '      <div class="mode-title">通用健康管理</div>',
        '      <div class="mode-desc">适合所有人群</div>',
        '    </div>',
        '    <div class="mode-card ' + (isPreg ? 'active' : '') + '" data-mode="pregnancy">',
        '      <svg class="ico ico-xl"><use href="#i-baby"/></svg>',
        '      <div class="mode-title">孕期模式</div>',
        '      <div class="mode-desc">含孕周/双胎标准</div>',
        '    </div>',
        '  </div>',
        '  <div class="small muted mt8">切换模式会使用对应的健康参考标准；自定义目标优先级更高。</div>',
        '</div>',

        '<div class="section-title">个人资料</div>',
        '<div class="card">',
        '  <div class="field"><label class="label">称呼</label><input class="input" id="set-name" value="' + Utils.esc(user.name || '') + '" placeholder="您的昵称"></div>',
        isPreg ? (
          '  <div class="row"><div class="field grow"><label class="label">当前孕周</label><input class="input" id="set-week" type="number" inputmode="numeric" value="' + Utils.esc(user.gestationalWeek || '') + '" placeholder="如 24"></div>' +
          '  <div class="field grow"><label class="label">身高(cm)</label><input class="input" id="set-height" type="number" inputmode="decimal" value="' + Utils.esc(user.height || '') + '"></div></div>' +
          '  <div class="field"><label class="label">胎数类型</label><select class="select" id="set-twin">' +
          '    <option value="single"' + (user.twinType === 'single' ? ' selected' : '') + '>单胎</option>' +
          '    <option value="dichorionic"' + (user.twinType === 'dichorionic' ? ' selected' : '') + '>双绒毛膜双胎</option>' +
          '    <option value="monochorionic"' + (user.twinType === 'monochorionic' ? ' selected' : '') + '>单绒毛膜双胎</option>' +
          '    <option value="unknown"' + (user.twinType === 'unknown' ? ' selected' : '') + '>暂不确定</option>' +
          '  </select></div>' +
          '  <div class="row"><div class="field grow"><label class="label">宝宝昵称（选填）</label><input class="input" id="set-bname1" placeholder="宝宝" value="' + Utils.esc((user.babyNames || [])[0] || '') + '"></div>' +
          '  <div class="field grow" id="set-bname2-wrap"><label class="label">宝宝B昵称（双胎）</label><input class="input" id="set-bname2" placeholder="宝宝B" value="' + Utils.esc((user.babyNames || [])[1] || '') + '"></div></div>' +
          '  <div class="field"><label class="label">孕前体重(kg)</label><input class="input" id="set-preweight" type="number" inputmode="decimal" value="' + Utils.esc(user.preWeight || '') + '"></div>'
        ) : (
          '  <div class="row"><div class="field grow"><label class="label">身高(cm)</label><input class="input" id="set-height" type="number" inputmode="decimal" value="' + Utils.esc(user.height || '') + '" placeholder="如 165"></div>' +
          '  <div class="field grow"><label class="label">活动量</label><select class="select" id="set-activity">' +
          '    <option value="light"' + (user.activityLevel === 'light' ? ' selected' : '') + '>轻度（久坐）</option>' +
          '    <option value="moderate"' + (user.activityLevel === 'moderate' ? ' selected' : '') + '>中度（每周运动1-3次）</option>' +
          '    <option value="active"' + (user.activityLevel === 'active' ? ' selected' : '') + '>高度（每周运动4次以上）</option>' +
          '  </select></div></div>'
        ),
        '  <div class="row" style="gap:8px"><input type="checkbox" id="set-insulin" ' + (user.onInsulin ? 'checked' : '') + '> <span>已使用胰岛素</span></div>',
        '  <button class="btn btn-primary btn-block mt12" id="set-profile-save">保存资料</button>',
        '</div>',

        '<div class="section-title">健康目标 <span class="small muted" style="font-weight:400">自定义上下限与目标</span></div>',
        '<div class="card">',
        '  <div class="small muted mb12">设置您的体重和血糖控制目标。留空则使用所选模式的默认参考标准。</div>',
        // 体重目标
        '  <div class="goal-group">',
        '    <div class="goal-group-title"><svg class="ico ico-sm"><use href="#i-scale"/></svg>体重目标</div>',
        !isPreg ? ('    <div class="field"><label class="label">体重管理方向</label><select class="select" id="set-goalmode">' +
          '      <option value="lose"' + (g.weightGoalMode === 'lose' ? ' selected' : '') + '>减重</option>' +
          '      <option value="maintain"' + (g.weightGoalMode === 'maintain' ? ' selected' : '') + '>保持体重</option>' +
          '      <option value="gain"' + (g.weightGoalMode === 'gain' ? ' selected' : '') + '>增重</option>' +
          '    </select></div>') : '',
        '    <div class="row">',
        '      <div class="field grow"><label class="label">体重下限 (kg)</label><input class="input" id="set-wlow" type="number" inputmode="decimal" step="0.1" value="' + Utils.esc(g.weightLow || '') + '" placeholder="留空=自动"></div>',
        '      <div class="field grow"><label class="label">体重上限 (kg)</label><input class="input" id="set-whigh" type="number" inputmode="decimal" step="0.1" value="' + Utils.esc(g.weightHigh || '') + '" placeholder="留空=自动"></div>',
        '    </div>',
        '    <div class="field"><label class="label">目标体重 (kg)</label><input class="input" id="set-wtarget" type="number" inputmode="decimal" step="0.1" value="' + Utils.esc(g.weightTarget || '') + '" placeholder="留空=按BMI自动计算"></div>',
        '    <div class="row">',
        '      <div class="field grow"><label class="label">每周最大增重 (kg)</label><input class="input" id="set-wgain" type="number" inputmode="decimal" step="0.1" value="' + Utils.esc(g.weeklyGainMax != null ? g.weeklyGainMax : '0.5') + '"></div>',
        '      <div class="field grow"><label class="label">每周最大减重 (kg)</label><input class="input" id="set-wloss" type="number" inputmode="decimal" step="0.1" value="' + Utils.esc(g.weeklyLossMax != null ? g.weeklyLossMax : '0.5') + '"></div>',
        '    </div>',
        '  </div>',
        // 血糖目标
        '  <div class="goal-group mt16">',
        '    <div class="goal-group-title"><svg class="ico ico-sm"><use href="#i-droplet"/></svg>血糖目标 (mmol/L)</div>',
        '    <div class="row">',
        '      <div class="field grow"><label class="label">空腹下限</label><input class="input" id="set-sflow" type="number" inputmode="decimal" step="0.1" value="' + Utils.esc(g.sugarFastingLow != null ? g.sugarFastingLow : '3.9') + '"></div>',
        '      <div class="field grow"><label class="label">空腹上限</label><input class="input" id="set-sfhigh" type="number" inputmode="decimal" step="0.1" value="' + Utils.esc(g.sugarFastingHigh != null ? g.sugarFastingHigh : '6.1') + '"></div>',
        '    </div>',
        '    <div class="row">',
        '      <div class="field grow"><label class="label">餐后下限</label><input class="input" id="set-salow" type="number" inputmode="decimal" step="0.1" value="' + Utils.esc(g.sugarAfterMealLow != null ? g.sugarAfterMealLow : '3.9') + '"></div>',
        '      <div class="field grow"><label class="label">餐后2h上限</label><input class="input" id="set-sahigh" type="number" inputmode="decimal" step="0.1" value="' + Utils.esc(g.sugarAfterMealHigh != null ? g.sugarAfterMealHigh : '7.8') + '"></div>',
        '    </div>',
        '    <div class="row">',
        '      <div class="field grow"><label class="label">餐后1h上限</label><input class="input" id="set-s1h" type="number" inputmode="decimal" step="0.1" value="' + Utils.esc(g.sugar1hHigh != null && g.sugar1hHigh !== '' ? g.sugar1hHigh : ref.bloodSugar.afterMeal1h.high) + '"></div>',
        '      <div class="field grow"><label class="label">低血糖预警值</label><input class="input" id="set-slow" type="number" inputmode="decimal" step="0.1" value="' + Utils.esc(g.sugarLowWarn != null ? g.sugarLowWarn : '3.9') + '"></div>',
        '    </div>',
        '    <div class="row">',
        '      <div class="field grow"><label class="label">随机血糖高限</label><input class="input" id="set-srhigh" type="number" inputmode="decimal" step="0.1" value="' + Utils.esc(g.sugarRandomHigh != null ? g.sugarRandomHigh : '11.1') + '"></div>',
        '      <div class="grow"></div>',
        '    </div>',
        '    <div class="small muted">餐后1h按当前模式标准为 &lt;' + ref.bloodSugar.afterMeal1h.high + '；餐后2h为 &lt;' + ref.bloodSugar.afterMeal2h.high + '，请分别按实际目标填写。</div>',
        '  </div>',
        // 热量目标
        '  <div class="goal-group mt16">',
        '    <div class="goal-group-title"><svg class="ico ico-sm"><use href="#i-salad"/></svg>饮食目标</div>',
        '    <div class="field"><label class="label">每日热量目标 (kcal)</label><input class="input" id="set-calorie" type="number" inputmode="numeric" step="50" value="' + Utils.esc(g.calorieTarget || 2000) + '"></div>',
        '  </div>',
        '  <button class="btn btn-primary btn-block mt12" id="set-goals-save">保存健康目标</button>',
        '  <button class="btn btn-ghost btn-block mt8" id="set-goals-reset">恢复默认标准</button>',
        '</div>',

        '<div class="section-title">显示与偏好</div>',
        '<div class="card">',
        '  <div class="row"><div class="field grow"><label class="label">体重单位</label><select class="select" id="set-unit">',
        '    <option value="kg"' + (s.unit === 'kg' ? ' selected' : '') + '>千克 (kg)</option>',
        '    <option value="lb"' + (s.unit === 'lb' ? ' selected' : '') + '>磅 (lb)</option>',
        '  </select></div>',
        '  <div class="field grow"><label class="label">血糖单位</label><select class="select" id="set-sugarunit">',
        '    <option value="mmol"' + (s.sugarUnit === 'mmol' ? ' selected' : '') + '>mmol/L</option>',
        '    <option value="mgdl"' + (s.sugarUnit === 'mgdl' ? ' selected' : '') + '>mg/dL</option>',
        '  </select></div></div>',
        '  <div class="row" style="gap:8px"><input type="checkbox" id="set-notify"> <span>启用任务提醒通知</span></div>',
        '  <div class="mt8 small muted">开启后会请求通知权限；到点推送任务/用餐提醒，App 在后台或被清理后仍会推送。</div>',
        '  <div class="grid-2 mt12">',
        '    <button class="btn btn-soft" id="set-notify-test"><svg class="ico ico-sm" style="vertical-align:-2px"><use href="#i-bell"/></svg> 发测试通知</button>',
        '    <button class="btn btn-soft" id="set-notify-check"><svg class="ico ico-sm" style="vertical-align:-2px"><use href="#i-check"/></svg> 提醒自检与修复</button>',
        '  </div>',
        '  <div id="notify-check-result" class="mt8"></div>',
        '</div>',

        '<div class="section-title">用餐时间（联动餐后任务）</div>',
        '<div class="card">',
        '  <div class="small muted mb12">设置三餐和加餐时间后，标记为「餐后/餐前」的任务会自动按此时间推算提醒，无需重复填写。</div>',
        MEAL_DEFS.map((md) =>
          '<div class="row mb8"><span class="li-ico" style="width:38px;height:38px"><svg class="ico ico-sm"><use href="#' + md.svg + '"/></svg></span>' +
          '<div class="grow small bold">' + md.label + '</div>' +
          '<input class="input" type="time" id="meal-' + md.key + '" value="' + (s.mealTimes ? s.mealTimes[md.key] : '') + '" style="width:110px"></div>'
        ).join(''),
        '</div>',

        '<div class="section-title">快捷操作排序</div>',
        '<div class="card">' + quickList + '</div>',

        '<div class="section-title">数据</div>',
        '<div class="card">',
        '  <div class="grid-2">',
        '    <button class="btn btn-soft" id="data-export">导出备份(JSON)</button>',
        '    <button class="btn btn-soft" id="data-import">导入备份</button>',
        '    <button class="btn btn-soft" id="data-demo">生成演示数据</button>',
        '    <button class="btn btn-danger" id="data-clear">清除所有数据</button>',
        '  </div>',
        '  <input type="file" id="data-file" accept="application/json" style="display:none">',
        '  <div class="mt8 small muted">数据仅保存在本机浏览器，请定期导出备份。</div>',
        '</div>',

        '<div class="section-title">帮助与常见问题</div>',
        '<div class="card">' + faqs + '</div>',

        '<div class="section-title">隐私说明</div>',
        '<div class="card"><ul style="padding-left:18px;margin:0;font-size:13px;color:var(--text-2);line-height:1.7">' + privacy + '</ul></div>',

        '<div class="center small muted" style="padding:16px 0 4px">暖语健康管理 v1.5 · 内容仅供参考，不替代医嘱</div>'
      ].join('');
    },

    mountSettings(container) {
      const modeRef = Data.getReference(Store.get('user').userMode);
      // 模式切换
      container.querySelectorAll('.mode-select .mode-card').forEach((card) => {
        card.addEventListener('click', () => {
          const mode = card.dataset.mode;
          const u = Store.get('user');
          if (u.userMode === mode) return;
          u.userMode = mode;
          Store.set('user', u);
          // 切换模式时，重置健康目标为对应模式的默认值
          const s = Store.get('settings');
          const ref = Data.getReference(mode);
          s.healthGoals = Object.assign({}, s.healthGoals, {
            sugarFastingLow: ref.bloodSugar.fasting.low,
            sugarFastingHigh: ref.bloodSugar.fasting.high,
            sugar1hHigh: ref.bloodSugar.afterMeal1h.high,
            sugarAfterMealLow: ref.bloodSugar.afterMeal2h.low,
            sugarAfterMealHigh: ref.bloodSugar.afterMeal2h.high,
            sugarRandomHigh: ref.bloodSugar.random.high,
            sugarLowWarn: ref.bloodSugar.fasting.low,
            calorieTarget: ref.calorie.target
          });
          Store.set('settings', s);
          Utils.toast(mode === 'pregnancy' ? '已切换至孕期模式' : '已切换至通用健康管理模式', 'success');
          this.updatePrenatalTab();
          this.renderFab();
          this.reload();
        });
      });

      // 外观：主题三选（带液态扩散动画）
      const themeSeg = container.querySelector('#set-theme-seg');
      if (themeSeg) {
        this.enhanceSegs(themeSeg.parentElement);
        themeSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => {
          if (themeSeg._activeLock) return;
          themeSeg._activeLock = true;
          setTimeout(() => { themeSeg._activeLock = false; }, 650);
          this.moveSegThumb(themeSeg, b);
          this.switchTheme(b.dataset.t, e.clientX || global.innerWidth / 2, e.clientY || 40);
        }));
      }
      // 外观：自定义背景
      const bgPick = container.querySelector('#set-bg-pick');
      if (bgPick) bgPick.addEventListener('click', () => container.querySelector('#set-bg-file').click());
      const bgFile = container.querySelector('#set-bg-file');
      if (bgFile) bgFile.addEventListener('change', (e) => { this.pickCustomBg(e.target.files[0]); e.target.value = ''; });
      const bgClear = container.querySelector('#set-bg-clear');
      if (bgClear) bgClear.addEventListener('click', () => {
        this.confirm('恢复默认渐变背景？', () => {
          this.setCustomBgOption('customBg', '', true);
          Utils.toast('已恢复默认背景', 'success');
        });
      });
      const bgBlur = container.querySelector('#set-bg-blur');
      if (bgBlur) bgBlur.addEventListener('change', () => this.setCustomBgOption('customBgBlur', bgBlur.checked, true));
      const bgBlurPx = container.querySelector('#set-bg-blurpx');
      if (bgBlurPx) bgBlurPx.addEventListener('input', () => this.setCustomBgOption('customBgBlurPx', parseInt(bgBlurPx.value, 10), false));
      const bgDim = container.querySelector('#set-bg-dim');
      if (bgDim) bgDim.addEventListener('input', () => this.setCustomBgOption('customBgDim', parseInt(bgDim.value, 10), false));

      container.querySelector('#set-unit').addEventListener('change', (e) => {
        const s = Store.get('settings'); s.unit = e.target.value; Store.set('settings', s);
      });
      container.querySelector('#set-sugarunit').addEventListener('change', (e) => {
        const s = Store.get('settings'); s.sugarUnit = e.target.value; Store.set('settings', s);
      });
      container.querySelector('#set-notify').addEventListener('change', (e) => {
        const s = Store.get('settings'); s.notifyEnabled = e.target.checked; Store.set('settings', s);
        if (e.target.checked) this.requestNotify();
        else if (this.isNative()) this.syncNativeReminders();
      });

      // 胎数切换：双胎时才显示宝宝B昵称
      const setTwin = container.querySelector('#set-twin');
      const setB2 = container.querySelector('#set-bname2-wrap');
      if (setTwin && setB2) {
        setB2.style.display = (setTwin.value === 'dichorionic' || setTwin.value === 'monochorionic') ? '' : 'none';
        setTwin.addEventListener('change', () => {
          setB2.style.display = (setTwin.value === 'dichorionic' || setTwin.value === 'monochorionic') ? '' : 'none';
        });
      }

      // 提醒自检与修复（原生App：检查通知权限/精确闹钟，引导修复）
      const checkBtn = container.querySelector('#set-notify-check');
      if (checkBtn) checkBtn.addEventListener('click', () => this.runNotifyCheck(container));
      const testBtn = container.querySelector('#set-notify-test');
      if (testBtn) testBtn.addEventListener('click', () => this.sendTestReminder());

      // 用餐时间：保存并重排任务提醒
      MEAL_DEFS.forEach((md) => {
        const inp = container.querySelector('#meal-' + md.key);
        if (!inp) return;
        inp.addEventListener('change', () => {
          const s = Store.get('settings');
          if (!s.mealTimes) s.mealTimes = {};
          s.mealTimes[md.key] = inp.value;
          Store.set('settings', s);
          Utils.toast(md.label + '时间已更新，餐后任务已联动', 'success');
          if (this.isNative()) this.syncNativeReminders();
          this.reload();
        });
      });

      container.querySelector('#set-profile-save').addEventListener('click', () => {
        const u = Store.get('user');
        u.name = container.querySelector('#set-name').value.trim();
        u.height = container.querySelector('#set-height').value;
        u.onInsulin = container.querySelector('#set-insulin').checked;
        if (u.userMode === 'pregnancy') {
          u.gestationalWeek = container.querySelector('#set-week').value;
          u.twinType = container.querySelector('#set-twin').value;
          u.preWeight = container.querySelector('#set-preweight').value;
          // 宝宝昵称
          const bn1 = container.querySelector('#set-bname1');
          const bn2 = container.querySelector('#set-bname2');
          if (bn1) u.babyNames = [bn1.value.trim(), bn2 ? bn2.value.trim() : ''];
        } else {
          const actEl = container.querySelector('#set-activity');
          if (actEl) u.activityLevel = actEl.value;
        }
        Store.set('user', u);
        Utils.toast('资料已保存', 'success');
      });

      // 健康目标保存
      const goalsSave = container.querySelector('#set-goals-save');
      if (goalsSave) {
        goalsSave.addEventListener('click', () => {
          const s = Store.get('settings');
          if (!s.healthGoals) s.healthGoals = {};
          const num = (id) => {
            const el = container.querySelector('#' + id);
            return el && el.value !== '' ? Number(el.value) : '';
          };
          s.healthGoals.weightLow = num('set-wlow');
          s.healthGoals.weightHigh = num('set-whigh');
          s.healthGoals.weightTarget = num('set-wtarget');
          s.healthGoals.weeklyGainMax = num('set-wgain') || 0.5;
          s.healthGoals.weeklyLossMax = num('set-wloss') || 0.5;
          s.healthGoals.sugarFastingLow = num('set-sflow') || 3.9;
          s.healthGoals.sugarFastingHigh = num('set-sfhigh') || 6.1;
          s.healthGoals.sugarAfterMealLow = num('set-salow') || 3.9;
          s.healthGoals.sugarAfterMealHigh = num('set-sahigh') || 7.8;
          s.healthGoals.sugar1hHigh = num('set-s1h') || modeRef.bloodSugar.afterMeal1h.high;
          s.healthGoals.sugarLowWarn = num('set-slow') || 3.9;
          s.healthGoals.sugarRandomHigh = num('set-srhigh') || 11.1;
          s.healthGoals.calorieTarget = num('set-calorie') || 2000;
          const goalModeEl = container.querySelector('#set-goalmode');
          if (goalModeEl) s.healthGoals.weightGoalMode = goalModeEl.value;
          Store.set('settings', s);
          Utils.toast('健康目标已保存', 'success');
          this.reload();
        });
      }

      // 恢复默认
      const goalsReset = container.querySelector('#set-goals-reset');
      if (goalsReset) {
        goalsReset.addEventListener('click', () => {
          this.confirm('确定恢复为所选模式的默认健康标准？', () => {
            const u = Store.get('user');
            const s = Store.get('settings');
            const ref = Data.getReference(u.userMode);
            s.healthGoals = {
              weightTarget: '',
              weightLow: '',
              weightHigh: '',
              weeklyGainMax: u.userMode === 'pregnancy' ? 0.75 : 0.5,
              weeklyLossMax: 0.5,
              sugarFastingLow: ref.bloodSugar.fasting.low,
              sugarFastingHigh: ref.bloodSugar.fasting.high,
              sugar1hHigh: ref.bloodSugar.afterMeal1h.high,
              sugarAfterMealLow: ref.bloodSugar.afterMeal2h.low,
              sugarAfterMealHigh: ref.bloodSugar.afterMeal2h.high,
              sugarRandomHigh: ref.bloodSugar.random.high,
              sugarLowWarn: ref.bloodSugar.fasting.low,
              calorieTarget: ref.calorie.target,
              weightGoalMode: 'maintain'
            };
            Store.set('settings', s);
            Utils.toast('已恢复默认标准', 'success');
            this.reload();
          });
        });
      }

      // 快捷操作排序
      container.querySelectorAll('[data-quick-up]').forEach((b) => b.addEventListener('click', () => {
        this.moveQuick(parseInt(b.dataset.quickUp, 10), -1);
      }));
      container.querySelectorAll('[data-quick-down]').forEach((b) => b.addEventListener('click', () => {
        this.moveQuick(parseInt(b.dataset.quickDown, 10), 1);
      }));

      // 数据操作
      container.querySelector('#data-export').addEventListener('click', () => this.exportAll());
      container.querySelector('#data-import').addEventListener('click', () => container.querySelector('#data-file').click());
      container.querySelector('#data-file').addEventListener('change', (e) => this.importAll(e.target.files[0]));
      container.querySelector('#data-demo').addEventListener('click', () => { this.genDemoData(); Utils.toast('已生成演示数据', 'success'); this.reload(); });
      container.querySelector('#data-clear').addEventListener('click', () => {
        this.confirm('确定清除所有本地数据？此操作不可恢复。', () => {
          Store.clearAll(); Store.init(); this.renderFab();
          if (this.isNative()) this.syncNativeReminders(); // 清空任务后撤掉全部已排提醒
          Utils.toast('已清除并重置', 'success'); this.reload();
        });
      });
    },

    moveQuick(idx, dir) {
      const s = Store.get('settings');
      const arr = s.quickActions || ['weight', 'sugar', 'diet', 'med'];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return;
      const t = arr[idx]; arr[idx] = arr[j]; arr[j] = t;
      s.quickActions = arr; Store.set('settings', s);
      this.renderFab(); this.reload();
    },

    exportAll() {
      const data = {};
      Object.values(Store.KEYS).forEach((k) => { data[k] = Store.get(k, null); });
      Utils.download('暖语健康备份_' + Utils.todayStr() + '.json', JSON.stringify(data, null, 2), 'application/json');
      Utils.toast('已导出备份', 'success');
    },

    importAll(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          Object.values(Store.KEYS).forEach((k) => { if (data[k] != null) Store.set(k, data[k]); });
          Store.init();
          if (this.isNative()) this.syncNativeReminders(); // 导入可能改变任务/用餐时间，需重排提醒
          Utils.toast('导入成功', 'success'); this.reload();
        } catch (e) { Utils.toast('导入失败：文件格式错误', 'error'); }
      };
      reader.readAsText(file);
    },

    genDemoData() {
      const now = new Date();
      const weights = [], sugars = [], diets = [];
      let base = 58;
      for (let i = 20; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const ds = Utils.dateStr(d);
        base += (Math.random() * 0.12 - 0.02);
        weights.push({ id: Utils.uid(), date: ds, time: '07:30', value: Utils.round(base, 1) });
        // 血糖：空腹 + 餐后2h
        sugars.push({ id: Utils.uid(), date: ds, time: '07:00', value: Utils.round(4.2 + Math.random() * 0.8, 1), scene: 'fasting' });
        sugars.push({ id: Utils.uid(), date: ds, time: '14:00', value: Utils.round(5.5 + Math.random() * 1.2, 1), scene: 'afterMeal2h' });
      }
      // 演示饮食（今天）
      const demoFoods = [
        { name: '全麦馒头', amount: 60, kcal: 223, protein: 7, carb: 47, fat: 1.1 },
        { name: '鸡蛋(水煮)', amount: 50, kcal: 144, protein: 13.3, carb: 2.8, fat: 8.8 },
        { name: '无糖豆浆', amount: 300, kcal: 30, protein: 3, carb: 1.2, fat: 1.6 },
        { name: '西兰花', amount: 150, kcal: 36, protein: 4.1, carb: 4.3, fat: 0.6 },
        { name: '鲈鱼', amount: 150, kcal: 105, protein: 18.6, carb: 0, fat: 3.4 },
        { name: '白米饭(熟)', amount: 150, kcal: 116, protein: 2.6, carb: 25.9, fat: 0.3 }
      ];
      const today = Utils.todayStr();
      [['breakfast', 0, 2], ['lunch', 3, 5], ['dinner', 1, 1], ['snack', 0, 1]].forEach((cfg) => {
        const meal = cfg[0];
        for (let k = cfg[1]; k <= cfg[2]; k++) {
          const f = demoFoods[k];
          diets.push({ id: Utils.uid(), date: today, meal: meal, name: f.name, amount: f.amount, kcal: f.kcal, protein: f.protein, carb: f.carb, fat: f.fat });
        }
      });
      Store.set('weights', weights);
      Store.set('sugars', sugars);
      Store.set('diets', diets);
    },

    /* ---------- 弹窗 / 确认 ---------- */
    modal(html, onMount) {
      const root = document.getElementById('modal-root');
      root.innerHTML = '<div class="modal-backdrop"><div class="modal">' + html + '</div></div>';
      const backdrop = root.querySelector('.modal-backdrop');
      const modalEl = root.querySelector('.modal');
      const close = () => { root.innerHTML = ''; };
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
      modalEl.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
      if (onMount) onMount(modalEl);
    },

    closeModal() {
      document.getElementById('modal-root').innerHTML = '';
    },

    confirm(msg, onYes) {
      this.modal(
        '<div class="center"><div style="width:56px;height:56px;border-radius:50%;background:var(--warn-bg);display:grid;place-items:center;margin:0 auto"><svg class="ico ico-xl" style="color:var(--warning)"><use href="#i-alert"/></svg></div><p class="mt12" style="font-size:15px">' + Utils.esc(msg) + '</p></div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" data-close>取消</button><button class="btn btn-danger" id="confirm-yes">确定</button></div>',
        (root) => {
          root.querySelector('#confirm-yes').addEventListener('click', () => { this.closeModal(); onYes(); });
        }
      );
    },

    /* ---------- 打印 / PDF ---------- */
    printHTML(title, body) {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0';
      iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title><style>' +
        'body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;padding:24px;color:#1f2333}' +
        'h1{font-size:22px}h2{font-size:17px;margin-top:24px}table{border-collapse:collapse;width:100%}' +
        'td,th{padding:6px;font-size:13px;text-align:left}@media print{body{padding:0}}' +
        '</style></head><body>' + body + '</body></html>');
      doc.close();
      setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 300);
      setTimeout(() => document.body.removeChild(iframe), 60000);
    },

    /* ---------- 桌面小组件（记体重/记血糖/记饮食） ---------- */
    widgetBridge() {
      const C = global.Capacitor;
      if (!this.isNative() || !C || !C.Plugins) return null;
      return C.Plugins.WidgetBridge || null;
    },

    /* 体重/血糖/饮食数据变化时自动刷新小组件（去抖，仅原生App） */
    installWidgetDataHook() {
      const keys = ['weights', 'sugars', 'diets'];
      const origSet = Store.set;
      const self = this;
      Store.set = function (k, v) {
        const r = origSet.call(Store, k, v);
        if (keys.indexOf(k) >= 0) self.syncWidgetsSoon();
        return r;
      };
    },

    /* 把最新数据摘要推给原生端（SharedPreferences），供小组件显示 */
    syncWidgets() {
      const WB = this.widgetBridge();
      if (!WB || !WB.update) return;
      const s = Store.get('settings');
      const today = Utils.todayStr();
      const w = Store.get('weights', []).slice().sort(Utils.byDateDesc)[0];
      const su = Store.get('sugars', []).slice().sort(Utils.byDateDesc)[0];
      const unit = s.unit || 'kg';
      const weightText = w ? ((unit === 'kg' ? Utils.round(w.value, 1) : Utils.kgToLb(w.value)) + ' ' + unit) : '';
      const suUnit = s.sugarUnit === 'mgdl' ? 'mg/dL' : 'mmol/L';
      const sugarText = su ? ((suUnit === 'mmol/L' ? Utils.round(su.value, 1) : Utils.mmolToMgdl(su.value)) + ' ' + suUnit) : '';
      const sugarStatus = su ? this.sugarStatusText(su).label : '';
      const totals = global.DietView.dayTotals(today);
      const meals = ['breakfast', 'lunch', 'dinner', 'snack'].filter((m) =>
        Store.get('diets', []).some((d) => d.date === today && d.meal === m)).length;
      Promise.resolve(WB.update({
        weightText: String(weightText),
        weightDate: w ? w.date : '',
        sugarText: String(sugarText),
        sugarStatus: String(sugarStatus),
        sugarDate: su ? su.date : '',
        dietKcal: String(totals.kcal || 0),
        dietMeals: String(meals),
        dietDate: today
      })).catch(() => {});
    },

    syncWidgetsSoon() {
      clearTimeout(this._widgetSyncT);
      this._widgetSyncT = setTimeout(() => this.syncWidgets(), 400);
    },

    /* 小组件点击进入：冷启动取回路由，热启动监听事件 */
    bindWidgetBridge() {
      const WB = this.widgetBridge();
      if (!WB) return;
      if (!this._widgetBound) {
        this._widgetBound = true;
        window.addEventListener('widgetOpen', (e) => {
          const d = e && e.detail;
          if (d && d.route && Store.get('onboarded')) this.openQuick(d.route);
        });
      }
      if (WB.consumePendingRoute) {
        WB.consumePendingRoute().then((r) => {
          if (r && r.route && Store.get('onboarded')) this.openQuick(r.route);
        }).catch(() => {});
      }
      this.syncWidgets();
    },

    /* ---------- 通知与调度 ---------- */
    isNative() {
      const C = global.Capacitor;
      return !!(C && C.isNativePlatform && C.isNativePlatform());
    },

    nativeLN() {
      const C = global.Capacitor;
      if (!C) return null;
      if (!C.Plugins.LocalNotifications && C.registerPlugin) {
        C.registerPlugin('LocalNotifications');
      }
      return C.Plugins && C.Plugins.LocalNotifications ? C.Plugins.LocalNotifications : null;
    },

    notifId(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
      return Math.abs(h);
    },

    initNativeNotifications() {
      // 回前台监听：所有平台都绑定（补发错过的提醒 + 原生重排日程）
      if (!this._resumeBound) {
        this._resumeBound = true;
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return;
          this.checkMissedOnResume();
          if (!this.isNative()) return;
          // 重排原生闹钟（App 被系统清理后闹钟可能丢失；节流1分钟）
          if (Date.now() - (this._lastSync || 0) < 60 * 1000) return;
          this._lastSync = Date.now();
          const st = Store.get('settings');
          if (st.notifyEnabled) this.syncNativeReminders();
        });
      }
      if (!this.isNative()) return;
      const LN = this.nativeLN();
      if (!LN) return;
      const s = Store.get('settings');
      if (!s.notifyEnabled) return;
      // 先检查权限状态：已授权直接排程；未授权先请求并等待结果（Android 13+ 必须授权后才调度）
      LN.checkPermissions().then((p) => {
        if (p && p.display === 'granted') {
          this.syncNativeReminders();
          return;
        }
        if (LN.requestPermissions) {
          LN.requestPermissions().then((pp) => {
            if (pp && pp.display === 'granted') {
              this.syncNativeReminders();
            } else {
              Utils.toast('通知权限未开启，提醒将无法送达', 'error');
            }
          }).catch(() => {});
        }
      }).catch(() => {});
    },

    /* 回到前台时补发提醒：App 在后台时 WebView 定时器会暂停，
     * 错过触发窗口（1分钟内）的用餐/任务提醒在回前台时补一次提示 */
    checkMissedOnResume() {
      if (Date.now() - (this._lastCatchUp || 0) < 60 * 1000) return;
      this._lastCatchUp = Date.now();
      const nowMin = Utils.timeToMin(Utils.timeStr());
      this.buildSchedule().forEach((s) => {
        const diff = nowMin - Utils.timeToMin(s.time);
        if (diff < 0 || diff > 15) return;
        if (s.type === 'meal') { this.triggerMealReminder(s); return; }
        if (s.status === 'taken' || s.status === 'skipped') return;
        const med = Store.get('meds', []).find((m) => m.id === s.medId);
        if (med) this.triggerReminder(med, s.time);
      });
    },

    syncNativeReminders() {
      if (!this.isNative()) return;
      const LN = this.nativeLN();
      if (!LN) return;
      const s = Store.get('settings');
      const enabled = s.notifyEnabled;
      // 收集要排的通知（每日重复，App被清理后仍由系统闹钟触发）
      const buildList = () => {
        const now = new Date();
        const list = [];
        const add = (id, title, body, t) => {
          const p = t.split(':').map(Number);
          const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), p[0], p[1], 0, 0);
          if (at <= now) at.setDate(at.getDate() + 1);
          list.push({ id: id, title: title, body: body, schedule: { at: at, repeats: true, every: 'day', allowWhileIdle: true } });
        };
        // 用餐提醒
        const mealTimes = s.mealTimes || Store.DEFAULT_MEAL_TIMES;
        MEAL_DEFS.forEach((md) => {
          const t = mealTimes[md.key];
          if (t) add(this.notifId('meal|' + md.key), '用餐提醒', '该吃' + md.label + '了（' + t + '），记得记录哦', t);
        });
        // 任务提醒（含餐后联动推算出的时间）
        Store.get('meds', []).forEach((m) => {
          if (!m.enabled) return;
          this.effectiveMedTimes(m).forEach((t) => {
            add(this.notifId(m.id + '|' + t), '任务提醒', '该完成「' + m.name + '」了（' + t + '）', t);
          });
        });
        return list;
      };
      // 先取消旧通知，取消完成后再排新通知（链式执行避免竞态把新排程清掉）
      const reschedule = () => {
        if (!enabled) return;
        const list = buildList();
        if (list.length) LN.schedule({ notifications: list }).catch(() => {});
      };
      LN.getPending().then((res) => {
        const ids = ((res && res.notifications) || []).map((n) => n.id);
        if (ids.length) {
          LN.cancel({ notifications: ids.map((id) => ({ id })) }).then(reschedule).catch(reschedule);
        } else {
          reschedule();
        }
      }).catch(reschedule);
    },

    /* 原生电池优化白名单助手（自定义 BatteryGuard 插件，仅原生App可用） */
    batteryGuard() {
      const C = global.Capacitor;
      if (!this.isNative() || !C || !C.Plugins) return null;
      return C.Plugins.BatteryGuard || null;
    },

    /* 发送测试通知：让用户当场验证提醒通道是否正常 */
    sendTestReminder() {
      if (this.isNative()) {
        const LN = this.nativeLN();
        if (!LN) return;
        LN.checkPermissions().then((p) => {
          if (!p || p.display !== 'granted') {
            Utils.toast('请先开启通知权限再测试', 'error');
            return;
          }
          return LN.schedule({
            notifications: [{
              id: this.notifId('test|reminder'),
              title: '暖语 · 测试提醒',
              body: '收到这条通知说明提醒通道正常 ✓',
              schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true }
            }]
          }).then(() => Utils.toast('3秒后请留意系统通知栏', 'info')).catch(() => Utils.toast('测试通知发送失败', 'error'));
        }).catch(() => {});
        return;
      }
      if ('Notification' in global && Notification.permission === 'granted') {
        try { new Notification('暖语 · 测试提醒', { body: '收到这条通知说明提醒通道正常 ✓', tag: 'test-reminder' }); } catch (e) {}
        Utils.toast('请留意系统通知', 'info');
      } else {
        Utils.toast('请先开启通知权限', 'error');
      }
    },

    /* 提醒自检：检查通知权限与精确闹钟，给出修复入口（原生App） */
    runNotifyCheck(container) {
      const box = container.querySelector('#notify-check-result');
      if (!box) return;
      if (!this.isNative()) {
        box.innerHTML = '<div class="small" style="padding:10px;border-radius:10px;background:var(--info-bg)">网页版提醒依赖浏览器保持页面打开。如需后台/锁屏提醒，请安装App（APK）。浏览器通知可在系统设置中允许本站点通知。</div>';
        return;
      }
      const LN = this.nativeLN();
      if (!LN) return;
      box.innerHTML = '<div class="small muted">检测中...</div>';
      const item = (ok, label, action) =>
        '<div class="row between mb8" style="gap:8px"><span class="small grow"><span class="badge ' + (ok ? 'badge-green' : 'badge-red') + '">' + (ok ? '正常' : '未开启') + '</span> ' + label + '</span>' +
        (ok ? '' : action) + '</div>';
      const BG = this.batteryGuard();
      Promise.all([
        LN.checkPermissions ? LN.checkPermissions().catch(() => null) : Promise.resolve(null),
        LN.checkExactNotificationSetting ? LN.checkExactNotificationSetting().catch(() => null) : Promise.resolve(null),
        BG && BG.isIgnoringOptimizations ? BG.isIgnoringOptimizations().catch(() => null) : Promise.resolve(null)
      ]).then(([perm, exact, batt]) => {
        const displayOK = perm && perm.display === 'granted';
        // exact_alarm 字段："unavailable"(Android<12) | "granted" | "denied"（不同版本返回结构可能是 permissions.exact_alarm）
        let exactVal = '';
        if (exact) {
          exactVal = exact.exact_alarm || (exact.permissions && exact.permissions.exact_alarm) || '';
        }
        const battOK = !BG || !batt || batt.value !== false;
        let html = '<div style="padding:12px;border-radius:12px;background:var(--surface-2);margin-top:4px">';
        html += item(displayOK, '通知权限（Android 13+ 必须）',
          '<button class="btn btn-sm btn-soft" id="fix-notify-perm">去开启</button>');
        if (exactVal === 'granted' || exactVal === 'unavailable') {
          html += item(true, exactVal === 'unavailable' ? '精确闹钟（本机无需）' : '精确闹钟（准点提醒）', '');
        } else {
          html += item(false, '精确闹钟（App被清理后仍准点提醒）',
            '<button class="btn btn-sm btn-soft" id="fix-exact-alarm">去开启</button>');
        }
        html += item(battOK, '电池优化白名单（防后台被杀）',
          battOK ? '' : '<button class="btn btn-sm btn-soft" id="fix-battery">去设置</button>');
        html += '<div class="small muted mt8">若以上均已开启仍收不到提醒，多为手机系统清理后台所致，请在系统设置中：允许暖语「自启动/后台运行」，不要从最近任务里「锁定清理」暖语。</div>';
        if (displayOK) {
          html += '<div class="row mt12" style="gap:8px"><button class="btn btn-soft grow" id="test-reminder">发测试通知</button>' +
            '<button class="btn btn-primary grow" id="resync-reminders">重新同步提醒</button></div>';
        }
        html += '</div>';
        box.innerHTML = html;

        const permBtn = box.querySelector('#fix-notify-perm');
        if (permBtn) permBtn.addEventListener('click', () => {
          if (LN.requestPermissions) LN.requestPermissions().then((p) => {
            const ok = p && p.display === 'granted';
            if (ok) { this.syncNativeReminders(); this.runNotifyCheck(container); }
            else if (BG && BG.openNotifSettings) {
              // 系统弹窗被永久拒绝时，跳到应用通知设置页手动开启
              BG.openNotifSettings().catch(() => {});
              Utils.toast('请在系统页面中允许「通知」', 'info');
            } else {
              Utils.toast('仍未授权，请到系统设置开启', 'error');
            }
          }).catch(() => {});
        });
        const exactBtn = box.querySelector('#fix-exact-alarm');
        if (exactBtn) exactBtn.addEventListener('click', () => {
          if (LN.changeExactNotificationSetting) LN.changeExactNotificationSetting().catch(() => {});
          Utils.toast('请在系统页面中允许「闹钟和提醒」', 'info');
        });
        const battBtn = box.querySelector('#fix-battery');
        if (battBtn) battBtn.addEventListener('click', () => {
          if (BG && BG.requestIgnoreOptimizations) {
            BG.requestIgnoreOptimizations().then(() => setTimeout(() => this.runNotifyCheck(container), 800)).catch(() => {});
          }
        });
        const testBtn = box.querySelector('#test-reminder');
        if (testBtn) testBtn.addEventListener('click', () => this.sendTestReminder());
        const resyncBtn = box.querySelector('#resync-reminders');
        if (resyncBtn) resyncBtn.addEventListener('click', () => {
          this.syncNativeReminders();
          Utils.toast('提醒已重新同步', 'success');
        });
      }).catch(() => {
        box.innerHTML = '<div class="small" style="color:var(--danger)">检测失败，请稍后重试</div>';
      });
    },

    requestNotify() {
      if (this.isNative()) {
        const LN = this.nativeLN();
        if (LN && LN.requestPermissions) {
          LN.requestPermissions().then((p) => {
            const ok = p && p.display === 'granted';
            Utils.toast(ok ? '通知已开启' : '通知未授权', ok ? 'success' : 'error');
            this.syncNativeReminders();
          }).catch(() => {});
        }
        return;
      }
      if (!('Notification' in global)) { Utils.toast('此浏览器不支持通知', 'error'); return; }
      if (Notification.permission === 'granted') { Utils.toast('通知已开启', 'success'); return; }
      Notification.requestPermission().then((p) => {
        Utils.toast(p === 'granted' ? '通知已开启' : '通知未授权', p === 'granted' ? 'success' : 'error');
      });
    },

    playSound(key) {
      try {
        const ctx = this._audioCtx || (this._audioCtx = new (global.AudioContext || global.webkitAudioContext)());
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        if (key === 'bell') { osc.type = 'triangle'; osc.frequency.value = 880; }
        else { osc.type = 'sine'; osc.frequency.value = 660; }
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
        osc.start(); osc.stop(ctx.currentTime + 0.9);
      } catch (e) { /* 忽略音频错误 */ }
    },

    /* 通用通知：原生本地通知 + Web 通知回退 */
    notifyNow(title, body, key) {
      const s = Store.get('settings');
      if (!s.notifyEnabled) return;
      if (this.isNative()) {
        const LN = this.nativeLN();
        if (LN && LN.schedule) {
          LN.schedule({ notifications: [{ id: this.notifId(key), title: title, body: body, schedule: { at: new Date(Date.now() + 1000) } }] }).catch(() => {});
        }
        return;
      }
      if ('Notification' in global && Notification.permission === 'granted') {
        try { new Notification(title, { body: body, tag: key }); } catch (e) { /* ignore */ }
      }
    },

    triggerReminder(med, time) {
      const key = med.id + '|' + time + '|' + Utils.todayStr();
      if (this.state.notified[key]) return;
      this.state.notified[key] = true;

      Utils.toast('该完成「' + med.name + '」了（' + time + '）', 'info');
      if (med.sound !== 'silent') this.playSound(med.sound);
      if (med.vibration && navigator.vibrate) navigator.vibrate([200, 100, 200]);
      this.notifyNow('任务提醒', '该完成「' + med.name + '」了（' + time + '）', key);
    },

    triggerMealReminder(meal) {
      const key = 'meal|' + meal.key + '|' + Utils.todayStr();
      if (this.state.notified[key]) return;
      this.state.notified[key] = true;

      const msg = '该吃' + meal.label + '了（' + meal.time + '）';
      Utils.toast(msg, 'info');
      this.playSound('chime');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      this.notifyNow('用餐提醒', msg, key);
    },

    startScheduler() {
      setInterval(() => {
        const now = Utils.timeStr();
        this.buildSchedule().forEach((s) => {
          if (s.time !== now) return;
          if (s.status === 'taken' || s.status === 'skipped') return;
          if (s.type === 'meal') { this.triggerMealReminder(s); return; }
          const med = Store.get('meds', []).find((m) => m.id === s.medId);
          if (med) this.triggerReminder(med, s.time);
        });
      }, 20000);
    }
  };

  global.App = App;

  document.addEventListener('DOMContentLoaded', () => App.init());
  // 若脚本在 DOM 已就绪后执行
  if (document.readyState !== 'loading') App.init();
})(window);
