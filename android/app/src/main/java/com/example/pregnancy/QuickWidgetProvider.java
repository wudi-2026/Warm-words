package com.example.pregnancy;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * QuickWidgetProvider — 三个快捷记录小组件（记体重/记血糖/记饮食）的公共基类。
 * 数据来源：App 内通过 WidgetBridge 插件镜像到 SharedPreferences 的最新数据；
 * 点击小组件：带 widgetRoute 启动 MainActivity，由前端路由到对应记录页。
 */
public abstract class QuickWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "nuanyu_widgets";
    static final Class<?>[] ALL_WIDGETS = {
            WeightWidgetProvider.class,
            SugarWidgetProvider.class,
            DietWidgetProvider.class
    };

    /** 小组件点击时携带的路由标识 */
    protected abstract String route();

    /** 各类型小组件把标题/数据/图标/背景渲染进 RemoteViews */
    protected abstract void render(Context ctx, RemoteViews rv, SharedPreferences sp);

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] appWidgetIds) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        for (int id : appWidgetIds) {
            RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_quick);
            render(ctx, rv, sp);
            rv.setOnClickPendingIntent(R.id.wg_root, tapIntent(ctx, route()));
            mgr.updateAppWidget(id, rv);
        }
    }

    static PendingIntent tapIntent(Context ctx, String route) {
        // 点击小组件弹出「快速记录」小窗（不打开主界面），可在窗内直接记录
        Intent intent = new Intent(ctx, QuickEntryActivity.class);
        intent.putExtra("kind", route);
        int req = ("nuanyu." + route).hashCode();
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(ctx, req, intent, flags);
    }

    /** App 数据变化后由 WidgetBridge 调用：刷新桌面上所有已添加的小组件 */
    static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        for (Class<?> type : ALL_WIDGETS) {
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, type));
            if (ids == null || ids.length == 0) continue;
            try {
                QuickWidgetProvider provider = (QuickWidgetProvider) type.getDeclaredConstructor().newInstance();
                provider.onUpdate(ctx, mgr, ids);
            } catch (Exception ignored) {
            }
        }
    }

    /* ---------- 数据行文案工具 ---------- */

    static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.CHINA).format(new Date());
    }

    /** 日期 → 展示：今天 / MM/DD；空返回空串 */
    static String when(String date) {
        if (date == null || date.isEmpty()) return "";
        if (date.equals(today())) return "今天";
        return date.length() >= 10 ? date.substring(5).replace('-', '/') : date;
    }

    /** 「数值 · 时间」组合；无数值时显示引导文案 */
    static String line(String text, String date, String fallback) {
        if (text == null || text.isEmpty()) return fallback;
        String w = when(date);
        return w.isEmpty() ? text : text + " · " + w;
    }
}
