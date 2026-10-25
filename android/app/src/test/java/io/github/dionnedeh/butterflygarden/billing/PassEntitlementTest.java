package io.github.dionnedeh.butterflygarden.billing;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import io.github.dionnedeh.butterflygarden.billing.PassEntitlement.Decision;
import io.github.dionnedeh.butterflygarden.billing.PassEntitlement.Purchase;
import io.github.dionnedeh.butterflygarden.billing.PassEntitlement.State;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.Test;

public class PassEntitlementTest {

    private static final long NOW = 1_790_000_000_000L;
    private static final long DAY = 24L * 60 * 60 * 1000;
    private static final List<String> PASS = Collections.singletonList(PassEntitlement.PRODUCT_ID);

    private static Purchase active() {
        return new Purchase(PASS, true, false, false, true);
    }

    private static Purchase pending() {
        return new Purchase(PASS, false, true, false, true);
    }

    private static Purchase suspended() {
        return new Purchase(PASS, true, false, true, true);
    }

    private static Decision fromPlay(long previouslyVerifiedAt, Purchase... purchases) {
        return PassEntitlement.fromPlay(Arrays.asList(purchases), previouslyVerifiedAt, NOW);
    }

    @Test
    public void aVerifiedPurchaseOpensThePassAndIsRemembered() {
        Decision decision = fromPlay(0, active());
        assertEquals(State.ACTIVE, decision.state);
        assertFalse(decision.fromCache);
        assertEquals(NOW, decision.verifiedActiveAt);
    }

    @Test
    public void anUnverifiedPurchaseGrantsNothing() {
        Decision decision = fromPlay(0, new Purchase(PASS, true, false, false, false));
        assertEquals(State.INACTIVE, decision.state);
        assertEquals(0, decision.verifiedActiveAt);
    }

    @Test
    public void anotherProductGrantsNothing() {
        Purchase other = new Purchase(Collections.singletonList("something_else"), true, false, false, true);
        assertEquals(State.INACTIVE, fromPlay(0, other).state);
        assertEquals(State.INACTIVE, fromPlay(0, new Purchase(null, true, false, false, true)).state);
    }

    @Test
    public void aPendingPaymentWaitsWithoutAccess() {
        Decision decision = fromPlay(0, pending());
        assertEquals(State.PENDING, decision.state);
        assertEquals(0, decision.verifiedActiveAt);
    }

    @Test
    public void aSuspendedSubscriptionIsNotActive() {
        assertEquals(State.SUSPENDED, fromPlay(0, suspended()).state);
    }

    @Test
    public void activeWinsWhileAPlanChangeIsInFlight() {
        assertEquals(State.ACTIVE, fromPlay(0, pending(), active()).state);
        assertEquals(State.ACTIVE, fromPlay(0, suspended(), active()).state);
        assertEquals(State.PENDING, fromPlay(0, suspended(), pending()).state);
    }

    @Test
    public void nothingFromPlayIsInactiveAndForgetsTheConfirmation() {
        Decision decision = fromPlay(0);
        assertEquals(State.INACTIVE, decision.state);
        assertFalse(decision.lapsed);
        assertEquals(0, decision.verifiedActiveAt);
    }

    @Test
    public void aPassThisDeviceHadConfirmedIsReportedAsLapsed() {
        assertTrue(fromPlay(NOW - DAY).lapsed);
        assertTrue(fromPlay(NOW - DAY, suspended()).lapsed);
        assertFalse(fromPlay(NOW - DAY, active()).lapsed);
    }

    @Test
    public void unreachablePlayHonoursARecentConfirmation() {
        Decision decision = PassEntitlement.whenPlayUnreachable(NOW - 3 * DAY, NOW);
        assertEquals(State.ACTIVE, decision.state);
        assertTrue(decision.fromCache);
        assertEquals(NOW - 3 * DAY, decision.verifiedActiveAt);
    }

    @Test
    public void unreachablePlayHonoursItForSevenDaysAndNoLonger() {
        assertEquals(State.ACTIVE, PassEntitlement.whenPlayUnreachable(NOW - 7 * DAY, NOW).state);
        assertEquals(State.UNAVAILABLE, PassEntitlement.whenPlayUnreachable(NOW - 7 * DAY - 1, NOW).state);
    }

    @Test
    public void unreachablePlayGrantsNothingToSomeoneNeverConfirmed() {
        assertEquals(State.UNAVAILABLE, PassEntitlement.whenPlayUnreachable(0, NOW).state);
    }

    @Test
    public void aClockTurnedBackCannotStretchTheAllowance() {
        assertEquals(State.UNAVAILABLE, PassEntitlement.whenPlayUnreachable(NOW + DAY, NOW).state);
    }

    @Test
    public void withoutALicenceKeyNothingIsGranted() {
        Decision decision = PassEntitlement.unconfigured();
        assertEquals(State.UNCONFIGURED, decision.state);
        assertEquals(0, decision.verifiedActiveAt);
    }
}
