package io.github.dionnedeh.butterflygarden;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.provider.CalendarContract;
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
import java.util.Map;
import java.util.TimeZone;

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
 *
 * It also hands the daily garden visit to the phone's calendar app, through
 * that app's own new-event screen (addDailyEvent).
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

    /**
     * Opens the calendar app's own new-event screen with the daily garden
     * visit filled in (DailyEvent): the next hour:minute on the phone's
     * clock, ten minutes, every day, with the title and notes the page sends.
     *
     * No calendar permission: this app never reads or writes a calendar. The
     * calendar app shows the event, and keeps it only if the gardener saves
     * it there. Android says nothing back about that, so the answer is only
     * whether the screen opened; `opened: false`, when no app on the phone
     * has one, tells the page to save the calendar file instead.
     */
    @PluginMethod
    public void addDailyEvent(PluginCall call) {
        String title = call.getString("title");
        String description = call.getString("description");
        Integer hour = call.getInt("hour");
        Integer minute = call.getInt("minute");
        if (title == null || description == null || hour == null || minute == null || !DailyEvent.isTimeOfDay(hour, minute)) {
            call.reject("title, description and a time of day (hour and minute) are required.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI);
        Map<String, Object> extras = DailyEvent.extras(
            title,
            description,
            hour,
            minute,
            System.currentTimeMillis(),
            TimeZone.getDefault()
        );
        for (Map.Entry<String, Object> extra : extras.entrySet()) {
            Object value = extra.getValue();
            if (value instanceof Long) intent.putExtra(extra.getKey(), (long) (Long) value);
            else if (value instanceof Integer) intent.putExtra(extra.getKey(), (int) (Integer) value);
            else intent.putExtra(extra.getKey(), (String) value);
        }
        boolean opened;
        try {
            getActivity().startActivity(intent);
            opened = true;
        } catch (ActivityNotFoundException | SecurityException error) {
            // No calendar app on the phone takes a new event this way.
            opened = false;
        }
        JSObject answer = new JSObject();
        answer.put("opened", opened);
        call.resolve(answer);
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
