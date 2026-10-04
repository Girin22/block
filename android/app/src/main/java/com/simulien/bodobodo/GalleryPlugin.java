package com.simulien.bodobodo;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.media.MediaScannerConnection;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens a photo the app just saved in the phone's gallery, so the player sees where the export went
 * (2026-10-04). The saved file is looked up through the media scanner, which hands back the gallery's
 * own content address for it; the gallery is then asked to show that one picture.
 */
@CapacitorPlugin(name = "Gallery")
public class GalleryPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String path = call.getString("path");
        if (path == null) { call.reject("path required"); return; }
        MediaScannerConnection.scanFile(getContext(), new String[] { path }, new String[] { "image/png" }, (scanned, uri) -> {
            if (uri == null) { call.reject("not in the gallery"); return; }
            // Started from the game's own screen (no new task), so back closes the gallery and returns here.
            Intent view = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "image/png")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            try { getActivity().startActivity(view); call.resolve(); }
            catch (ActivityNotFoundException error) { call.reject("no gallery app"); }
        });
    }
}
