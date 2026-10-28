package com.example.pregnancy;

import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** 小组件：记饮食（显示今日热量与餐次，隔日自动归零显示未记录） */
public class DietWidgetProvider extends QuickWidgetProvider {

    @Override
    protected String route() {
        return "diet";
    }

    @Override
    protected void render(Context ctx, RemoteViews rv, SharedPreferences sp) {
        rv.setTextViewText(R.id.wg_title, "记饮食");
        String sub;
        if (today().equals(sp.getString("dietDate", ""))) {
            sub = sp.getString("dietKcal", "0") + " 千卡 · 已记" + sp.getString("dietMeals", "0") + "/4餐";
        } else {
            sub = "今日未记录";
        }
        rv.setTextViewText(R.id.wg_sub, sub);
        rv.setImageViewResource(R.id.wg_icon, R.drawable.wg_ic_leaf);
        rv.setInt(R.id.wg_root, "setBackgroundResource", R.drawable.widget_bg_diet);
    }
}
