package com.example.pregnancy;

import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** 小组件：记体重（显示最新体重，点击进入体重记录） */
public class WeightWidgetProvider extends QuickWidgetProvider {

    @Override
    protected String route() {
        return "weight";
    }

    @Override
    protected void render(Context ctx, RemoteViews rv, SharedPreferences sp) {
        rv.setTextViewText(R.id.wg_title, "记体重");
        rv.setTextViewText(R.id.wg_sub, line(sp.getString("weightText", ""), sp.getString("weightDate", ""), "点击开始记录"));
        rv.setImageViewResource(R.id.wg_icon, R.drawable.wg_ic_scale);
        rv.setInt(R.id.wg_root, "setBackgroundResource", R.drawable.widget_bg_weight);
    }
}
