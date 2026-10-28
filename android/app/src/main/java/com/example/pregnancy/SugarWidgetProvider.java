package com.example.pregnancy;

import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** 小组件：记血糖（显示最近血糖与判定，点击进入血糖记录） */
public class SugarWidgetProvider extends QuickWidgetProvider {

    @Override
    protected String route() {
        return "sugar";
    }

    @Override
    protected void render(Context ctx, RemoteViews rv, SharedPreferences sp) {
        rv.setTextViewText(R.id.wg_title, "记血糖");
        String text = sp.getString("sugarText", "");
        String status = sp.getString("sugarStatus", "");
        String combined = (text + " " + status).trim();
        rv.setTextViewText(R.id.wg_sub, line(combined, sp.getString("sugarDate", ""), "点击开始记录"));
        rv.setImageViewResource(R.id.wg_icon, R.drawable.wg_ic_droplet);
        rv.setInt(R.id.wg_root, "setBackgroundResource", R.drawable.widget_bg_sugar);
    }
}
