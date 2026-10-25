package io.github.dionnedeh.butterflygarden.billing;

import java.util.List;

/**
 * Whether the Garden Pass is open, decided from what Google Play reports.
 *
 * Every rule lives here, free of Android and Play classes, so plain JVM tests
 * can pin each one down. GardenBillingPlugin only gathers the inputs.
 */
public final class PassEntitlement {

    /** The one subscription the app sells, as created in Play Console. */
    public static final String PRODUCT_ID = "garden_pass";

    /**
     * How long a Pass Play last confirmed stays open while Play cannot be
     * asked at all (no Play Store service, say). Play's own purchase cache
     * usually answers offline, so this is a fallback, not the normal path.
     */
    public static final long OFFLINE_TRUST_MS = 7L * 24 * 60 * 60 * 1000;

    public enum State {
        /** Paid for and confirmed. The only state that opens the Pass. */
        ACTIVE,
        /** Bought with a slow payment method that has not completed yet. */
        PENDING,
        /** On hold because of a payment problem; fixed in Play's subscription centre. */
        SUSPENDED,
        /** No current subscription. */
        INACTIVE,
        /** Play could not be asked, and nothing recent enough to trust. */
        UNAVAILABLE,
        /** This build has no licence key, so no purchase can be verified. */
        UNCONFIGURED,
    }

    /** One purchase record, reduced to what the rules need. */
    public static final class Purchase {

        final List<String> products;
        final boolean purchased;
        final boolean pending;
        final boolean suspended;
        final boolean signatureValid;

        public Purchase(List<String> products, boolean purchased, boolean pending, boolean suspended, boolean signatureValid) {
            this.products = products;
            this.purchased = purchased;
            this.pending = pending;
            this.suspended = suspended;
            this.signatureValid = signatureValid;
        }

        boolean isGardenPass() {
            return products != null && products.contains(PRODUCT_ID);
        }
    }

    /** The outcome, and what to remember for next time. */
    public static final class Decision {

        public final State state;
        /** True when the answer comes from the offline allowance, not from Play just now. */
        public final boolean fromCache;
        /** True once, when a Pass this device had confirmed is found to have ended. */
        public final boolean lapsed;
        /** When Play last confirmed an active Pass; 0 to forget it. */
        public final long verifiedActiveAt;

        Decision(State state, boolean fromCache, boolean lapsed, long verifiedActiveAt) {
            this.state = state;
            this.fromCache = fromCache;
            this.lapsed = lapsed;
            this.verifiedActiveAt = verifiedActiveAt;
        }
    }

    private PassEntitlement() {}

    /**
     * Play answered: decide from its purchase list alone.
     *
     * Only a verified record counts. Active beats pending beats suspended, so
     * a gardener switching plans is never locked out mid-change. The cached
     * confirmation is refreshed while active and dropped otherwise.
     */
    public static Decision fromPlay(List<Purchase> purchases, long previouslyVerifiedAt, long now) {
        boolean active = false;
        boolean pending = false;
        boolean suspended = false;
        for (Purchase purchase : purchases) {
            if (!purchase.isGardenPass() || !purchase.signatureValid) continue;
            if (purchase.purchased && purchase.suspended) suspended = true;
            else if (purchase.purchased) active = true;
            else if (purchase.pending) pending = true;
        }
        if (active) return new Decision(State.ACTIVE, false, false, now);
        boolean lapsed = previouslyVerifiedAt > 0;
        if (pending) return new Decision(State.PENDING, false, false, 0);
        if (suspended) return new Decision(State.SUSPENDED, false, lapsed, 0);
        return new Decision(State.INACTIVE, false, lapsed, 0);
    }

    /**
     * Play could not be asked. Honour a recent confirmation from this device
     * for up to OFFLINE_TRUST_MS; never for someone Play never confirmed, and
     * never when the clock reads earlier than the confirmation (a clock turned
     * back cannot stretch the allowance).
     */
    public static Decision whenPlayUnreachable(long verifiedActiveAt, long now) {
        long age = now - verifiedActiveAt;
        if (verifiedActiveAt > 0 && age >= 0 && age <= OFFLINE_TRUST_MS) {
            return new Decision(State.ACTIVE, true, false, verifiedActiveAt);
        }
        return new Decision(State.UNAVAILABLE, false, false, verifiedActiveAt);
    }

    /** Without a licence key nothing can be verified, so nothing is granted. */
    public static Decision unconfigured() {
        return new Decision(State.UNCONFIGURED, false, false, 0);
    }
}
