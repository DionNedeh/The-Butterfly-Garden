package io.github.dionnedeh.butterflygarden;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.TimeZone;
import org.junit.Test;

/**
 * The daily garden visit handed to the calendar's own new-event screen: the
 * extras that screen reads, under the names Android's CalendarContract gives
 * them, and the first visit's time on the phone's own clock.
 */
public class DailyEventTest {

    private static final TimeZone NEW_YORK = TimeZone.getTimeZone("America/New_York");
    private static final String TITLE = "Garden time \uD83E\uDD8B";
    private static final String DESCRIPTION =
        "Open The Butterfly Garden.\nTo stop these reminders, delete the event from your calendar.";

    /** 27 October 2026, 07:15 in New York (EDT, UTC-4). */
    private static final long MORNING = 1_793_099_700_000L;

    @Test
    public void theExtrasAreTheVisitAndNothingElse() {
        Map<String, Object> extras = DailyEvent.extras(TITLE, DESCRIPTION, 8, 0, MORNING, NEW_YORK);
        // CalendarContract's own names: EXTRA_EVENT_BEGIN_TIME, EXTRA_EVENT_END_TIME,
        // Events.TITLE, DESCRIPTION, RRULE and AVAILABILITY.
        assertEquals(
            new HashSet<>(Arrays.asList("beginTime", "endTime", "title", "description", "rrule", "availability")),
            extras.keySet()
        );
        // 08:00 the same morning, EDT: 12:00 UTC.
        assertEquals(1_793_102_400_000L, extras.get("beginTime"));
        assertEquals(1_793_102_400_000L + 10 * 60 * 1000L, extras.get("endTime"));
        assertEquals(TITLE, extras.get("title"));
        assertEquals(DESCRIPTION, extras.get("description"));
        assertEquals("FREQ=DAILY", extras.get("rrule"));
        // Events.AVAILABILITY_FREE: ten minutes in the garden never shows anyone as busy.
        assertEquals(1, extras.get("availability"));
    }

    @Test
    public void aTimeAlreadyPastTodayStartsTomorrow() {
        // 07:15 has passed 07:00, so the first visit is the next morning.
        assertEquals(1_793_185_200_000L, DailyEvent.nextBegin(MORNING, NEW_YORK, 7, 0));
        // This very minute has begun, so it is tomorrow's too.
        assertEquals(MORNING + 24 * 60 * 60 * 1000L, DailyEvent.nextBegin(MORNING, NEW_YORK, 7, 15));
        // Later today is today.
        assertEquals(MORNING + 60 * 1000L, DailyEvent.nextBegin(MORNING, NEW_YORK, 7, 16));
    }

    @Test
    public void theFirstVisitKeepsItsTimeOfDayAcrossTheClocksGoingBack() {
        // 31 October 2026, 21:00 EDT; the clocks go back on 1 November. 08:00
        // on the 1st is EST (UTC-5): 13:00 UTC, not 12:00.
        long evening = 1_793_494_800_000L;
        assertEquals(1_793_538_000_000L, DailyEvent.nextBegin(evening, NEW_YORK, 8, 0));
    }

    @Test
    public void onlyATimeOfDayIsOne() {
        assertTrue(DailyEvent.isTimeOfDay(0, 0));
        assertTrue(DailyEvent.isTimeOfDay(23, 59));
        assertFalse(DailyEvent.isTimeOfDay(24, 0));
        assertFalse(DailyEvent.isTimeOfDay(-1, 30));
        assertFalse(DailyEvent.isTimeOfDay(8, 60));
        assertFalse(DailyEvent.isTimeOfDay(8, -1));
    }
}
