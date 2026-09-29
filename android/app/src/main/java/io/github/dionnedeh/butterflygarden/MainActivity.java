package io.github.dionnedeh.butterflygarden;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Null only when the device has no usable WebView, in which case
        // Capacitor has already shown its own explanation instead.
        if (getBridge() == null) return;
        // Capacitor switches these on for plugins this app does not use. The
        // garden never asks where anyone is, never opens a window, and loads
        // nothing from file:// -- so they go back off.
        WebSettings settings = getBridge().getWebView().getSettings();
        settings.setGeolocationEnabled(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setAllowFileAccess(false);
    }
}
