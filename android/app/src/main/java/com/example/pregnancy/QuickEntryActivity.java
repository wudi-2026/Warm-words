package com.example.pregnancy;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

/**
 * QuickEntryActivity — 桌面小组件「快速记录」弹窗。
 * 不打开主界面：以对话框样式加载 quick.html（与主应用同源 https://localhost，
 * 共享 WebView localStorage，因此读写的是同一份健康数据）。
 * 保存后由 JS 通过 QuickNative 回传小组件镜像数据并关闭弹窗。
 */
public class QuickEntryActivity extends Activity {

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.TRANSPARENT);
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        webView.addJavascriptInterface(new NativeBridge(), "QuickNative");

        // 与 Capacitor 主应用相同的域（https://localhost），保证 localStorage 共享
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain("localhost")
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });

        String kind = getIntent() != null ? getIntent().getStringExtra("kind") : null;
        if (kind == null || kind.isEmpty()) kind = "weight";
        webView.loadUrl("https://localhost/assets/public/quick.html?kind=" + kind);

        setContentView(webView);
    }

    @Override
    public void onBackPressed() {
        finish();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    /** 提供给 quick.html 的原生桥 */
    private class NativeBridge {

        /** 保存成功后刷新桌面小组件数据（与 WidgetBridgePlugin 同一口径） */
        @JavascriptInterface
        public void updateWidget(String json) {
            try {
                JSONObject o = new JSONObject(json);
                SharedPreferences sp = getSharedPreferences(QuickWidgetProvider.PREFS, MODE_PRIVATE);
                SharedPreferences.Editor ed = sp.edit();
                ed.putString("weightText", o.optString("weightText", ""));
                ed.putString("weightDate", o.optString("weightDate", ""));
                ed.putString("sugarText", o.optString("sugarText", ""));
                ed.putString("sugarStatus", o.optString("sugarStatus", ""));
                ed.putString("sugarDate", o.optString("sugarDate", ""));
                ed.putString("dietKcal", o.optString("dietKcal", ""));
                ed.putString("dietMeals", o.optString("dietMeals", ""));
                ed.putString("dietDate", o.optString("dietDate", ""));
                ed.apply();
                QuickWidgetProvider.updateAll(QuickEntryActivity.this);
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void close() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    finish();
                }
            });
        }

        @JavascriptInterface
        public void openApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent intent = new Intent(QuickEntryActivity.this, MainActivity.class);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(intent);
                    finish();
                }
            });
        }
    }
}
