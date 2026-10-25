package io.github.dionnedeh.butterflygarden.billing;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Base64;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClient.BillingResponseCode;
import com.android.billingclient.api.BillingClient.ProductType;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import io.github.dionnedeh.butterflygarden.R;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * The Garden Pass, sold and checked through Google Play on this device.
 *
 * There is no server: the app asks the Play Store app on the phone which
 * purchases this Google account holds, verifies each against the licence key,
 * and decides with PassEntitlement. This code sends nothing anywhere.
 *
 * Google's Billing Library itself, though, reports to Google as it works (it
 * bundles Google's datatransport logger), so it is only ever woken when it is
 * needed: the Billing client is created on first use, the gardener's own
 * request (opening the Garden Pass, subscribing, going to Play's subscription
 * page) is what first uses it, and the check on each return to the app runs
 * only for someone with a subscription to follow, or just back from that
 * page. A gardener who never looks at the Pass never runs Google's billing
 * code at all.
 *
 * All billing work happens on the main thread, which is where Play delivers
 * its callbacks too, so the fields below are never touched concurrently.
 */
@CapacitorPlugin(name = "GardenBilling")
public class GardenBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    /** App-private; excluded from cloud backup and device transfer. */
    private static final String PREFS = "garden_pass";
    private static final String VERIFIED_ACTIVE_AT = "verified_active_at";
    private static final String LAPSE_UNSEEN = "lapse_unseen";
    /** Set while there is a subscription to follow: active, pending or on hold. */
    private static final String FOLLOWING = "following";
    /**
     * Set when the gardener goes to Play's subscription page, where they can
     * subscribe again; the next return asks Play, so a purchase made there is
     * acknowledged in time rather than refunded.
     */
    private static final String CHECK_REQUESTED = "check_requested";
    /** The trusted time, running time and boot at the last check; see PassEntitlement.trustedNow. */
    private static final String SEEN_AT = "seen_at";
    private static final String SEEN_ELAPSED = "seen_elapsed";
    private static final String SEEN_BOOT = "seen_boot";

    private BillingClient client;
    private byte[] licenceKey = new byte[0];
    private boolean connecting = false;
    private final List<Runnable> onConnected = new ArrayList<>();
    private final List<Runnable> onConnectionFailed = new ArrayList<>();
    /** The Pass's offers as last loaded; needed to launch a purchase. */
    private ProductDetails productDetails;
    /** A subscribe() call waiting for Play's answer. */
    private PluginCall purchaseCall;
    /** Purchase tokens with an acknowledgement on its way, so none is sent twice. */
    private final Set<String> acknowledging = new HashSet<>();
    /** False until the first resume, which is the app starting. */
    private boolean resumedBefore = false;

    @Override
    public void load() {
        String key = getContext().getString(R.string.garden_pass_licence_key).trim();
        try {
            licenceKey = key.isEmpty() ? new byte[0] : Base64.decode(key, Base64.DEFAULT);
        } catch (IllegalArgumentException malformed) {
            licenceKey = new byte[0];
        }
    }

    /** Created on first use, never at start-up; see the class comment. */
    private BillingClient client() {
        if (client == null) {
            client = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        }
        return client;
    }

    @Override
    protected void handleOnDestroy() {
        if (client != null) client.endConnection();
        super.handleOnDestroy();
    }

    /**
     * A return to the app re-checks a subscription this device is following,
     * so a renewal, lapse or fixed payment shows promptly. Nobody else's
     * return wakes the Billing Library.
     */
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // The page asks for itself as the app starts (getStatus), so only a
        // later return needs a check of its own.
        if (!resumedBefore) {
            resumedBefore = true;
            return;
        }
        getBridge().executeOnMainThread(() -> {
            if (following()) checkStatus(this::announce);
        });
    }

    // ---------------------------------------------------------------- methods

    /**
     * The Pass's state. With ask=false (the app starting up) Play is only
     * asked for a subscription this device is following; otherwise the answer
     * is "unasked", and the Garden Pass page asks when it is opened.
     */
    @PluginMethod
    public void getStatus(PluginCall call) {
        boolean ask = Boolean.TRUE.equals(call.getBoolean("ask", true));
        getBridge().executeOnMainThread(() -> {
            if (!ask && licenceKey.length > 0 && !following()) {
                JSObject unasked = new JSObject();
                unasked.put("state", "unasked");
                unasked.put("fromCache", false);
                unasked.put("lapsed", prefs().getBoolean(LAPSE_UNSEEN, false));
                call.resolve(unasked);
                return;
            }
            checkStatus((decision) -> call.resolve(status(decision)));
        });
    }

    @PluginMethod
    public void getOffers(PluginCall call) {
        getBridge().executeOnMainThread(() -> whenConnected(() -> {
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(
                    Collections.singletonList(
                        QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(PassEntitlement.PRODUCT_ID)
                            .setProductType(ProductType.SUBS)
                            .build()
                    )
                )
                .build();
            client().queryProductDetailsAsync(params, (result, details) -> getBridge().executeOnMainThread(() -> {
                JSObject answer = new JSObject();
                JSArray offers = new JSArray();
                if (result.getResponseCode() == BillingResponseCode.OK && !details.getProductDetailsList().isEmpty()) {
                    productDetails = details.getProductDetailsList().get(0);
                    List<ProductDetails.SubscriptionOfferDetails> offerList = productDetails.getSubscriptionOfferDetails();
                    if (offerList != null) {
                        for (ProductDetails.SubscriptionOfferDetails offer : offerList) offers.put(offer(offer));
                    }
                }
                answer.put("offers", offers);
                answer.put("reachable", result.getResponseCode() == BillingResponseCode.OK);
                call.resolve(answer);
            }));
        }, () -> {
            JSObject answer = new JSObject();
            answer.put("offers", new JSArray());
            answer.put("reachable", false);
            call.resolve(answer);
        }));
    }

    @PluginMethod
    public void subscribe(PluginCall call) {
        String offerToken = call.getString("offerToken");
        getBridge().executeOnMainThread(() -> {
            if (offerToken == null || productDetails == null) {
                call.reject("The Garden Pass offers have not been loaded yet.");
                return;
            }
            if (purchaseCall != null) {
                call.reject("A purchase is already under way.");
                return;
            }
            whenConnected(() -> {
                BillingFlowParams params = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(
                        Collections.singletonList(
                            BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(productDetails)
                                .setOfferToken(offerToken)
                                .build()
                        )
                    )
                    .build();
                purchaseCall = call;
                getBridge().saveCall(call);
                BillingResult launched = client().launchBillingFlow(getActivity(), params);
                // Anything but OK means Play never showed its purchase sheet,
                // so onPurchasesUpdated will not follow.
                if (launched.getResponseCode() != BillingResponseCode.OK) {
                    finishPurchase(outcomeFor(launched.getResponseCode()), null);
                }
            }, () -> {
                JSObject answer = new JSObject();
                answer.put("outcome", "unavailable");
                call.resolve(answer);
            });
        });
    }

    /** Play's own page for this subscription: change plan, fix payment, cancel. */
    @PluginMethod
    public void manage(PluginCall call) {
        Uri page = Uri.parse(
            "https://play.google.com/store/account/subscriptions?sku=" +
            PassEntitlement.PRODUCT_ID +
            "&package=" +
            getContext().getPackageName()
        );
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, page));
            prefs().edit().putBoolean(CHECK_REQUESTED, true).apply();
            call.resolve();
        } catch (ActivityNotFoundException missing) {
            call.reject("Google Play could not be opened on this device.");
        }
    }

    /** The "your Pass has ended" notice has been shown; do not show it again. */
    @PluginMethod
    public void dismissLapseNotice(PluginCall call) {
        prefs().edit().remove(LAPSE_UNSEEN).apply();
        call.resolve();
    }

    // ------------------------------------------------------------ Play events

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        getBridge().executeOnMainThread(() -> {
            int code = result.getResponseCode();
            if (code == BillingResponseCode.OK || code == BillingResponseCode.ITEM_ALREADY_OWNED) {
                // Follow and acknowledge what Play delivered straight away,
                // so a purchase is never refunded just because the check
                // below could not reach Play. A purchase made outside the app
                // while it is open (in Play's subscription page, say) arrives
                // here too.
                if (purchases != null) follow(purchases);
                // Then ask Play for the whole picture rather than deciding
                // from this partial list.
                checkStatus((decision) -> {
                    announce(decision);
                    finishPurchase(outcomeFor(decision), decision);
                });
            } else {
                finishPurchase(outcomeFor(code), null);
            }
        });
    }

    // --------------------------------------------------------------- internals

    private interface DecisionHandler {
        void handle(PassEntitlement.Decision decision);
    }

    private void checkStatus(DecisionHandler handler) {
        if (licenceKey.length == 0) {
            handler.handle(PassEntitlement.unconfigured());
            return;
        }
        whenConnected(() -> {
            // Include subscriptions in account hold: otherwise Play leaves them
            // out, and a subscriber whose payment failed would be told their
            // Pass had ended instead of how to fix the payment.
            QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(ProductType.SUBS)
                .includeSuspendedSubscriptions(true)
                .build();
            client().queryPurchasesAsync(params, (result, purchases) -> getBridge().executeOnMainThread(() -> {
                if (result.getResponseCode() != BillingResponseCode.OK) {
                    handler.handle(unreachable());
                    return;
                }
                List<PassEntitlement.Purchase> checked = new ArrayList<>();
                for (Purchase purchase : purchases) {
                    boolean verified = verified(purchase);
                    boolean purchased = purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED;
                    if (verified && purchased && !purchase.isAcknowledged()) acknowledge(purchase);
                    checked.add(
                        new PassEntitlement.Purchase(
                            purchase.getProducts(),
                            purchased,
                            purchase.getPurchaseState() == Purchase.PurchaseState.PENDING,
                            purchase.isSuspended(),
                            verified
                        )
                    );
                }
                PassEntitlement.Decision decision = PassEntitlement.fromPlay(checked, verifiedActiveAt(), trustedNow());
                remember(decision);
                handler.handle(decision);
            }));
        }, () -> handler.handle(unreachable()));
    }

    private PassEntitlement.Decision unreachable() {
        return PassEntitlement.whenPlayUnreachable(verifiedActiveAt(), trustedNow());
    }

    /** Follows any verified Garden Pass in a list Play delivered, and acknowledges it. */
    private void follow(List<Purchase> purchases) {
        for (Purchase purchase : purchases) {
            if (!purchase.getProducts().contains(PassEntitlement.PRODUCT_ID) || !verified(purchase)) continue;
            int state = purchase.getPurchaseState();
            if (state != Purchase.PurchaseState.PURCHASED && state != Purchase.PurchaseState.PENDING) continue;
            prefs().edit().putBoolean(FOLLOWING, true).apply();
            if (state == Purchase.PurchaseState.PURCHASED && !purchase.isAcknowledged()) acknowledge(purchase);
        }
    }

    /**
     * The time to decide by (see PassEntitlement.trustedNow), which is then
     * kept as the time seen at this check.
     */
    private long trustedNow() {
        SharedPreferences prefs = prefs();
        long elapsed = SystemClock.elapsedRealtime();
        int boot = bootCount();
        long now = PassEntitlement.trustedNow(
            System.currentTimeMillis(),
            elapsed,
            boot,
            prefs.getLong(SEEN_AT, 0),
            prefs.getLong(SEEN_ELAPSED, 0),
            prefs.getInt(SEEN_BOOT, -1)
        );
        prefs.edit().putLong(SEEN_AT, now).putLong(SEEN_ELAPSED, elapsed).putInt(SEEN_BOOT, boot).apply();
        return now;
    }

    /** Which boot of the phone this is, or -1 if Android will not say. */
    private int bootCount() {
        try {
            return Settings.Global.getInt(getContext().getContentResolver(), Settings.Global.BOOT_COUNT, -1);
        } catch (SecurityException refused) {
            return -1;
        }
    }

    private boolean verified(Purchase purchase) {
        byte[] signature;
        try {
            signature = Base64.decode(purchase.getSignature(), Base64.DEFAULT);
        } catch (IllegalArgumentException malformed) {
            return false;
        }
        return PurchaseSignature.isValid(licenceKey, purchase.getOriginalJson(), signature);
    }

    /**
     * Play refunds a purchase that is not acknowledged within three days. A
     * failure here is retried on the next check, which comes at the latest
     * the next time the app is opened.
     */
    private void acknowledge(Purchase purchase) {
        String token = purchase.getPurchaseToken();
        if (!acknowledging.add(token)) return;
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build();
        client().acknowledgePurchase(params, (result) -> getBridge().executeOnMainThread(() -> acknowledging.remove(token)));
    }

    private void whenConnected(Runnable ready, Runnable failed) {
        if (client().isReady()) {
            ready.run();
            return;
        }
        onConnected.add(ready);
        onConnectionFailed.add(failed);
        if (connecting) return;
        connecting = true;
        client().startConnection(
            new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(BillingResult result) {
                    getBridge().executeOnMainThread(() -> settleConnection(result.getResponseCode() == BillingResponseCode.OK));
                }

                @Override
                public void onBillingServiceDisconnected() {
                    // Later calls reconnect by themselves; only a connection
                    // still being set up has anyone waiting on it.
                    getBridge().executeOnMainThread(() -> {
                        if (connecting) settleConnection(false);
                    });
                }
            }
        );
    }

    private void settleConnection(boolean ok) {
        connecting = false;
        List<Runnable> run = new ArrayList<>(ok ? onConnected : onConnectionFailed);
        onConnected.clear();
        onConnectionFailed.clear();
        for (Runnable next : run) next.run();
    }

    private void finishPurchase(String outcome, PassEntitlement.Decision decision) {
        PluginCall call = purchaseCall;
        purchaseCall = null;
        if (call == null) return;
        JSObject answer = new JSObject();
        answer.put("outcome", outcome);
        if (decision != null) answer.put("status", status(decision));
        call.resolve(answer);
        getBridge().releaseCall(call);
    }

    private void announce(PassEntitlement.Decision decision) {
        notifyListeners("statusChanged", status(decision));
    }

    private JSObject status(PassEntitlement.Decision decision) {
        JSObject status = new JSObject();
        status.put("state", decision.state.name().toLowerCase(Locale.ROOT));
        status.put("fromCache", decision.fromCache);
        status.put("lapsed", prefs().getBoolean(LAPSE_UNSEEN, false));
        return status;
    }

    private static String outcomeFor(PassEntitlement.Decision decision) {
        switch (decision.state) {
            case ACTIVE:
                return "purchased";
            case PENDING:
                return "pending";
            default:
                return "unconfirmed";
        }
    }

    private static String outcomeFor(int responseCode) {
        switch (responseCode) {
            case BillingResponseCode.USER_CANCELED:
                return "cancelled";
            case BillingResponseCode.SERVICE_UNAVAILABLE:
            case BillingResponseCode.SERVICE_DISCONNECTED:
            case BillingResponseCode.BILLING_UNAVAILABLE:
            case BillingResponseCode.NETWORK_ERROR:
                return "unavailable";
            default:
                return "failed";
        }
    }

    private static JSObject offer(ProductDetails.SubscriptionOfferDetails offer) {
        JSObject json = new JSObject();
        json.put("basePlanId", offer.getBasePlanId());
        json.put("offerId", offer.getOfferId());
        json.put("offerToken", offer.getOfferToken());
        JSArray phases = new JSArray();
        for (ProductDetails.PricingPhase phase : offer.getPricingPhases().getPricingPhaseList()) {
            JSObject p = new JSObject();
            p.put("formattedPrice", phase.getFormattedPrice());
            p.put("priceMicros", phase.getPriceAmountMicros());
            p.put("currency", phase.getPriceCurrencyCode());
            p.put("billingPeriod", phase.getBillingPeriod());
            p.put("cycles", phase.getBillingCycleCount());
            p.put("recurrence", recurrence(phase.getRecurrenceMode()));
            phases.put(p);
        }
        json.put("phases", phases);
        return json;
    }

    private static String recurrence(int mode) {
        switch (mode) {
            case ProductDetails.RecurrenceMode.INFINITE_RECURRING:
                return "infinite";
            case ProductDetails.RecurrenceMode.FINITE_RECURRING:
                return "finite";
            default:
                return "once";
        }
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private boolean following() {
        SharedPreferences prefs = prefs();
        return verifiedActiveAt() > 0 || prefs.getBoolean(FOLLOWING, false) || prefs.getBoolean(CHECK_REQUESTED, false);
    }

    private long verifiedActiveAt() {
        return prefs().getLong(VERIFIED_ACTIVE_AT, 0);
    }

    private void remember(PassEntitlement.Decision decision) {
        SharedPreferences.Editor edit = prefs().edit();
        if (decision.verifiedActiveAt > 0) edit.putLong(VERIFIED_ACTIVE_AT, decision.verifiedActiveAt);
        else edit.remove(VERIFIED_ACTIVE_AT);
        if (decision.state == PassEntitlement.State.ACTIVE) edit.remove(LAPSE_UNSEEN);
        else if (decision.lapsed) edit.putBoolean(LAPSE_UNSEEN, true);
        boolean ongoing =
            decision.state == PassEntitlement.State.ACTIVE ||
            decision.state == PassEntitlement.State.PENDING ||
            decision.state == PassEntitlement.State.SUSPENDED;
        if (ongoing) edit.putBoolean(FOLLOWING, true);
        else edit.remove(FOLLOWING);
        // Play has answered, so a check the gardener asked for has happened.
        edit.remove(CHECK_REQUESTED);
        edit.apply();
    }
}
