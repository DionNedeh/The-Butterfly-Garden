package io.github.dionnedeh.butterflygarden;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
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
 * "Save to…" screen.
 *
 * Android's WebView ignores the web version's download link, so the backup
 * button would otherwise do nothing. The Storage Access Framework needs no
 * storage permission: the gardener picks the file, and this app can write to
 * that one file only. Unlike a browser download, Android reports whether the
 * file was written, so the app can honestly say it was saved.
 */
@CapacitorPlugin(name = "GardenFiles")
public class GardenFilesPlugin extends Plugin {

    @PluginMethod
    public void saveDocument(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType");
        String text = call.getString("text");
        if (fileName == null || mimeType == null || text == null) {
            call.reject("fileName, mimeType and text are required.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "documentChosen");
    }

    @ActivityCallback
    private void documentChosen(PluginCall call, ActivityResult result) {
        // Null if Android recreated the app while the picker was open: the
        // page that asked has gone, so there is no one to answer.
        if (call == null) return;
        Intent data = result.getData();
        Uri target = data == null ? null : data.getData();
        if (result.getResultCode() != Activity.RESULT_OK || target == null) {
            finish(call, false);
            return;
        }
        String text = call.getString("text", "");
        // Off the main thread: a backup with personal images is megabytes.
        getBridge().execute(() -> {
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(target, "w")) {
                if (stream == null) throw new IOException("The chosen location gave no stream to write to.");
                stream.write(text.getBytes(StandardCharsets.UTF_8));
                stream.flush();
                finish(call, true);
            } catch (IOException | SecurityException error) {
                call.reject("The backup could not be written to that location.", error);
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
