package com.simulien.bodobodo;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin (opens a saved export in the gallery) must be known before the bridge starts.
        registerPlugin(GalleryPlugin.class);
        super.onCreate(savedInstanceState);
    }

    /**
     * Full-screen play: the status bar, the navigation bar and a tablet's taskbar (Samsung's row of
     * frequent apps) are all hidden. A swipe from an edge shows them for a moment, then they hide again.
     * Applied whenever the window regains focus, because dialogs, the share sheet or app switching bring
     * the bars back.
     */
    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }

    @Override
    public void onResume() {
        super.onResume();
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }
}
