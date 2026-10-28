package com.example.pregnancy;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * WidgetBridgePlugin — 前端与桌面小组件之间的数据桥。
 * update()：把最新体重/血糖/饮食摘要镜像到 SharedPreferences，并刷新全部小组件；
 * consumePendingRoute()：取回小组件冷启动携带的跳转路由（60秒内有效）。
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences sp = ctx.getSharedPreferences(QuickWidgetProvider.PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor ed = sp.edit();
        put(ed, "weightText", call.getString("weightText"));
        put(ed, "weightDate", call.getString("weightDate"));
        put(ed, "sugarText", call.getString("sugarText"));
        put(ed, "sugarStatus", call.getString("sugarStatus"));
        put(ed, "sugarDate", call.getString("sugarDate"));
        put(ed, "dietKcal", call.getString("dietKcal"));
        put(ed, "dietMeals", call.getString("dietMeals"));
        put(ed, "dietDate", call.getString("dietDate"));
        ed.apply();
        QuickWidgetProvider.updateAll(ctx);
        call.resolve();
    }

    @PluginMethod
    public void consumePendingRoute(PluginCall call) {
        String route = MainActivity.pendingWidgetRoute;
        long at = MainActivity.pendingWidgetRouteAt;
        MainActivity.pendingWidgetRoute = null;
        // 仅消费 60 秒内的路由，避免 Activity 重建时误跳转
        boolean fresh = route != null && !route.isEmpty()
                && (android.os.SystemClock.elapsedRealtime() - at) < 60_000;
        JSObject ret = new JSObject();
        ret.put("route", fresh ? route : "");
        call.resolve(ret);
    }

    private static void put(SharedPreferences.Editor ed, String key, String value) {
        ed.putString(key, value == null ? "" : value);
    }
}
