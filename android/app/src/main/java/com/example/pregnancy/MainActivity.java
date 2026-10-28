package com.example.pregnancy;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** 小组件点击进入时携带的路由（weight/sugar/diet），由前端消费 */
    public static volatile String pendingWidgetRoute;
    public static volatile long pendingWidgetRouteAt;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(BatteryGuardPlugin.class);
        registerPlugin(WidgetBridgePlugin.class);
        captureWidgetRoute(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        captureWidgetRoute(intent);
    }

    /** 记录小组件跳转路由；热启动时直接通知前端 */
    private void captureWidgetRoute(Intent intent) {
        if (intent == null || !intent.hasExtra("widgetRoute")) return;
        String route = intent.getStringExtra("widgetRoute");
        if (route == null || route.isEmpty()) return;
        pendingWidgetRoute = route;
        pendingWidgetRouteAt = android.os.SystemClock.elapsedRealtime();
        Bridge bridge = this.bridge;
        if (bridge != null) {
            bridge.triggerJSEvent("widgetOpen", "window",
                    "{\"route\":\"" + route + "\"}");
        }
    }
}
