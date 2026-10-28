# 暖语 · 健康管理

![License](https://img.shields.io/badge/License-MIT-green.svg)
![Platform](https://img.shields.io/badge/Platform-PWA%20%7C%20Android-blue.svg)
![Capacitor](https://img.shields.io/badge/Capacitor-7.x-119EFF.svg)
![No Framework](https://img.shields.io/badge/框架-零依赖原生JS-orange.svg)
![Tests](https://img.shields.io/badge/测试-25%20passed-brightgreen.svg)

> 一款**本地优先、零后端**的个人健康管理 App：体重血糖记录、饮食红绿灯、用药/用餐智能提醒。支持「通用健康」与「孕期管理」双模式，可安装为 PWA，也可打包为 Android App。

---

## ✨ 功能特性

### 📊 健康记录
- **血糖记录**：空腹 / 餐前 / 餐后 1h·2h·3h / 睡前 / 随机等多场景，按场景自动判定「正常 / 偏高 / 偏低」，低血糖预警
- **体重记录**：折线 / 柱状趋势图，孕期模式按双胎推荐增重区间评估，通用模式按 BMI 中国标准（WS/T 428-2013）评估
- **自定义健康目标**：每个血糖场景可单独设置上下限，覆盖内置参考标准
- **数据导出**：血糖 / 体重 CSV 导出、JSON 全量备份与恢复

### 🥗 饮食管理
- 内置常见食物营养库（数据来源：《中国食物成分表（第 6 版）》）
- **红绿灯分类**：按 GI 及含糖量将食物分为绿灯（推荐）/ 黄灯（适量）/ 红灯（避免）
- 每餐记录，自动汇总当日热量、碳水 / 蛋白 / 脂肪三大营养素，对照目标区间
- 支持自定义食物、按餐次（早 / 午 / 晚 / 加餐）查看

### ⏰ 用药 / 用餐智能提醒
- **餐药联动**：药品可设为「餐后 / 餐前 N 分钟」服用，只需设置三餐时间，提醒时间自动推算，用餐时间一改、用药提醒全部联动
- **原生本地通知**（Capacitor LocalNotifications）：到点推送、每日重复，无需后台常驻
- 今日提醒时间轴：用餐 + 用药统一排序展示，服用状态一目了然
- 用药依从率统计（7 天 / 自定义区间），支持导出依从性报告

### 🤰 孕期模式（可切换）
- 妊娠期糖尿病（GDM）控糖标准：空腹 < 5.3、餐后 2h < 6.7 mmol/L 等
- 双胎孕期推荐增重曲线、产检计划提醒
- 在「我的」中一键切换「通用 / 孕期」模式，参考标准全局联动

### 🤖 Android 原生增强
- **桌面小组件**：血糖 / 体重 / 饮食三款小组件，主屏直显最近数值与状态，点击直达对应记录页
- **快捷记录**：通过快捷方式 / 小组件免启动直达记录表单（`quick.html` 轻量入口）
- **提醒可靠性**：内置 BatteryGuard 原生插件，引导用户加入电池优化白名单、跳转通知设置，适配国产 ROM 的后台清理策略

### 🎨 体验
- PWA：浏览器直接使用，可安装到桌面 / 手机主屏，离线可用
- 深色 / 浅色 / 跟随系统主题，液态扩散切换动画
- 数据 100% 存储在本地（localStorage），无需注册、不上传任何数据

## 🏥 数据来源与医学参考

| 内容 | 来源 |
| --- | --- |
| 食物营养库 | 《中国食物成分表（第 6 版）》 |
| 血糖控制目标 | 《中国 2 型糖尿病防治指南（2024）》 / 妊娠期糖尿病诊疗指南 |
| 体重管理目标 | 国家卫健委《体重管理指导原则（2024 年版）》 |
| BMI 分层 | 中国标准 WS/T 428-2013 |

> ⚠️ **免责声明**：本应用内容仅供健康管理与参考，不构成医疗建议，不能替代专业医嘱。如有疾病或用药问题，请咨询医生。

## 📸 截图

| 首页 | 记录 | 饮食 | 提醒 |
| --- | --- | --- | --- |
| 待补充 | 待补充 | 待补充 | 待补充 |

## 🛠 技术栈

- **前端**：原生 HTML / CSS / JavaScript，无任何框架与运行时依赖
- **图表**：手写轻量 SVG 图表组件（折线 / 柱状 / 迷你趋势图）
- **PWA**：Service Worker 离线缓存 + Web App Manifest
- **跨端**：[Capacitor 7](https://capacitorjs.com/) 打包 Android
  - `@capacitor/local-notifications` 本地通知
  - `@capacitor/filesystem` + `@capacitor/share` 原生文件导出 / 分享
- **数据**：localStorage 本地存储，零后端、零账号

## 📁 项目结构

```
├── www/                        # 应用源码（PWA）
│   ├── index.html              # 入口页面
│   ├── quick.html              # 快捷记录轻量入口
│   ├── manifest.json           # PWA 清单
│   ├── sw.js                   # Service Worker
│   ├── css/styles.css          # 全局样式（含深色主题）
│   └── js/
│       ├── data.js             # 食物库 / 药品库 / 参考标准
│       ├── store.js            # 本地存储层 + 通用工具
│       ├── charts.js           # SVG 图表组件
│       ├── app.js              # 入口：路由 / 首页 / 设置 / 提醒调度
│       └── views/
│           ├── records.js      # 健康记录（体重 / 血糖）
│           ├── diet.js         # 饮食管理
│           ├── medication.js   # 用药 / 任务提醒
│           └── prenatal.js     # 产检模块
├── android/                    # Capacitor Android 工程
│   └── app/src/main/java/     # 原生代码：小组件 / 电池优化插件 / 快捷入口
├── test/logic.test.js          # 逻辑单元测试（血糖阈值判定）
├── capacitor.config.json       # Capacitor 配置
└── package.json
```

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18（仅 Web 体验与测试需要）
- Android 构建（可选）：JDK 21 + Android SDK（compileSdk 35，minSdk 23 / Android 6.0+）

### Web 预览 / 开发

```bash
npm install        # 安装 Capacitor 依赖
npm test           # 运行单元测试（25 个用例）
npm run serve      # 本地启动静态服务器，浏览器访问 http://localhost:3000
```

> PWA 的 Service Worker 需要 HTTP(S) 环境才能注册，请通过本地服务器访问，不要直接双击打开 index.html。

### 打包 Android APK

```bash
npm install
npm run cap:sync                # 同步 www 到 Android 工程
cd android
gradlew assembleDebug           # 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

> Windows 下首次构建请先设置 `JAVA_HOME` 指向 JDK 21。也可用 `npm run cap:open` 在 Android Studio 中打开工程。

## 🔒 隐私说明

- 所有健康数据仅保存在您的设备本地（浏览器 localStorage / App 沙箱内）
- 无用户系统、无云端同步、无埋点统计，不收集任何个人信息
- 清除浏览器数据 / 卸载 App 会删除全部数据，请定期使用「导出备份」功能保存 JSON

## 📄 许可证

[MIT License](LICENSE) — 可自由使用、修改与分发
