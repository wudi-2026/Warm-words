package com.example.pregnancy;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * BatteryGuardPlugin — 帮助提醒功能在后台/被清理后仍可靠触发的原生辅助：
 * 1. 查询应用是否已加入电池优化白名单（国产 ROM 杀后台的主要开关）
 * 2. 拉起系统「忽略电池优化」授权弹窗
 * 3. 跳转应用通知设置页（Android 13+ 弹窗被永久拒绝时的兜底入口）
 */
@CapacitorPlugin(name = "BatteryGuard")
public class BatteryGuardPlugin extends Plugin {

    private PowerManager powerManager() {
        return (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
    }

    @PluginMethod
    public void isIgnoringOptimizations(PluginCall call) {
        PowerManager pm = powerManager();
        boolean ignoring = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        JSObject ret = new JSObject();
        ret.put("value", ignoring);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreOptimizations(PluginCall call) {
        String pkg = getContext().getPackageName();
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + pkg));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            // 个别 ROM 不响应该 action 时，退回应用详情页
            openAppDetails();
            call.resolve();
        }
    }

    @PluginMethod
    public void openNotifSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            openAppDetails();
            call.resolve();
        }
    }

    private void openAppDetails() {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
        } catch (Exception ignored) {
        }
    }
}
