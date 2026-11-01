package io.github.dionnedeh.butterflygarden;

import android.provider.CalendarContract;
import java.util.Calendar;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TimeZone;

/**
 * The daily garden visit as the calendar's own new-event screen takes it:
 * the extras of an ACTION_INSERT on CalendarContract.Events.CONTENT_URI.
 *
 * Kept apart from GardenFilesPlugin, and free of anything Android does at
 * run time (the CalendarContract names are constants the compiler copies
 * in), so a plain JVM test can check every extra.
 *
 * The same event as the calendar file the web app makes
 * (src/lib/calendarReminder.ts): ten minutes, every day, marked free so it
 * never shows anyone as busy, with only the title and the notes the page
 * sends, which say nothing from the journal.
 */
final class DailyEvent {

    /** How long the visit fills in the calendar, as the file's DURATION:PT10M. */
    static final long LENGTH_MILLIS = 10 * 60 * 1000L;

    /** Every day, from the first visit on. */
    static final String RECURRENCE = "FREQ=DAILY";

    private DailyEvent() {}

    /** Whether hour and minute make a time of day on a 24-hour clock. */
    static boolean isTimeOfDay(int hour, int minute) {
        return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
    }

    /**
     * The first visit: today at hour:minute on the phone's own clock, or
     * tomorrow if that moment has already begun. The day is moved on the
     * calendar, not by 24 hours, so a visit stays at its time of day across a
     * change of the clocks.
     */
    static long nextBegin(long now, TimeZone zone, int hour, int minute) {
        Calendar at = Calendar.getInstance(zone);
        at.setTimeInMillis(now);
        at.set(Calendar.HOUR_OF_DAY, hour);
        at.set(Calendar.MINUTE, minute);
        at.set(Calendar.SECOND, 0);
        at.set(Calendar.MILLISECOND, 0);
        if (at.getTimeInMillis() <= now) {
            at.add(Calendar.DAY_OF_MONTH, 1);
            at.set(Calendar.HOUR_OF_DAY, hour);
            at.set(Calendar.MINUTE, minute);
        }
        return at.getTimeInMillis();
    }

    /** The insert screen's extras, by CalendarContract's names, in the order they are put. */
    static Map<String, Object> extras(
        String title,
        String description,
        int hour,
        int minute,
        long now,
        TimeZone zone
    ) {
        long begin = nextBegin(now, zone, hour, minute);
        Map<String, Object> extras = new LinkedHashMap<>();
        extras.put(CalendarContract.EXTRA_EVENT_BEGIN_TIME, begin);
        extras.put(CalendarContract.EXTRA_EVENT_END_TIME, begin + LENGTH_MILLIS);
        extras.put(CalendarContract.Events.TITLE, title);
        extras.put(CalendarContract.Events.DESCRIPTION, description);
        extras.put(CalendarContract.Events.RRULE, RECURRENCE);
        extras.put(CalendarContract.Events.AVAILABILITY, CalendarContract.Events.AVAILABILITY_FREE);
        return extras;
    }
}
