package io.github.dionnedeh.butterflygarden;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Saves a garden backup where the gardener chooses, through Android's own
 * "Save to…" screen; and, the same way, an image the gardener made, such as
 * the year's postcard.
 *
 * Android's WebView ignores the web version's download link, so the backup
 * button would otherwise do nothing. The Storage Access Framework needs no
 * storage permission: the gardener picks the file, and this app can write to
 * that one file only. Unlike a browser download, Android reports whether the
 * file was written, so the app can honestly say it was saved.
 */
@CapacitorPlugin(name = "GardenFiles")
public class GardenFilesPlugin extends Plugin {

    /**
     * The backup waiting for the gardener to choose where it goes. It is held
     * here rather than in the call because Capacitor copies a call that opens
     * another screen into the activity's saved state, twice; a backup of a
     * few hundred kilobytes would then overflow Android's limit for that
     * state and crash the app as the "Save to…" screen opened.
     */
    private String pendingText;

    /** An image waiting the same way, as the bytes to write. */
    private byte[] pendingBytes;

    @PluginMethod
    public void saveDocument(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType");
        String text = call.getString("text");
        if (fileName == null || mimeType == null || text == null) {
            call.reject("fileName, mimeType and text are required.");
            return;
        }
        pendingText = text;
        pendingBytes = null;
        call.getData().remove("text");
        chooseDocument(call, fileName, mimeType);
    }

    /**
     * Saves bytes the page sends as base64 (the one way bytes cross the
     * bridge), such as the year's postcard, through the same screen.
     */
    @PluginMethod
    public void saveBinaryDocument(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType");
        String base64 = call.getString("base64");
        if (fileName == null || mimeType == null || base64 == null) {
            call.reject("fileName, mimeType and base64 are required.");
            return;
        }
        byte[] bytes;
        try {
            bytes = Base64.decode(base64, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("The file's contents could not be read.", error);
            return;
        }
        pendingBytes = bytes;
        pendingText = null;
        call.getData().remove("base64");
        chooseDocument(call, fileName, mimeType);
    }

    private void chooseDocument(PluginCall call, String fileName, String mimeType) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "documentChosen");
    }

    @ActivityCallback
    private void documentChosen(PluginCall call, ActivityResult result) {
        String text = pendingText;
        byte[] bytes = pendingBytes;
        pendingText = null;
        pendingBytes = null;
        // Null if Android recreated the app while the picker was open: the
        // page that asked has gone, and the file with it, so there is no one
        // to answer.
        if (call == null) return;
        Intent data = result.getData();
        Uri target = data == null ? null : data.getData();
        if ((text == null && bytes == null) || result.getResultCode() != Activity.RESULT_OK || target == null) {
            finish(call, false);
            return;
        }
        // Off the main thread: a backup with personal images is megabytes.
        getBridge().execute(() -> {
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(target, "w")) {
                if (stream == null) throw new IOException("The chosen location gave no stream to write to.");
                stream.write(text != null ? text.getBytes(StandardCharsets.UTF_8) : bytes);
                stream.flush();
                finish(call, true);
            } catch (IOException | SecurityException error) {
                call.reject("The file could not be written to that location.", error);
                getBridge().releaseCall(call);
            }
        });
    }

    private void finish(PluginCall call, boolean saved) {
        JSObject answer = new JSObject();
        answer.put("saved", saved);
        call.resolve(answer);
        getBridge().releaseCall(call);
    }
}
