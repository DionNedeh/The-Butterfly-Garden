package io.github.dionnedeh.butterflygarden.billing;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;

/**
 * Checks that a purchase record really came from Google Play.
 *
 * Play signs each purchase's JSON with the app's own RSA key, whose public half
 * is the "licence key" in Play Console (Monetize with Play → Monetization
 * setup). It is public by design and lives in res/values/garden_pass.xml. A
 * record that fails this check -- forged by a tool that fakes Play's
 * responses, or simply corrupted -- grants nothing.
 *
 * This stops casual tampering, not a determined one: anyone who can modify the
 * APK can remove the check. That trade-off was chosen in exchange for having
 * no server (docs/android-play-plan.md).
 *
 * Pure Java on purpose, so it runs in plain JVM unit tests.
 */
public final class PurchaseSignature {

    private PurchaseSignature() {}

    /**
     * @param publicKeyDer the licence key, base64-decoded (X.509 SubjectPublicKeyInfo)
     * @param signedData   Purchase.getOriginalJson()
     * @param signature    Purchase.getSignature(), base64-decoded
     * @return true only for a valid signature by that key; false for anything
     *     else, including an empty or malformed key
     */
    public static boolean isValid(byte[] publicKeyDer, String signedData, byte[] signature) {
        if (publicKeyDer == null || publicKeyDer.length == 0) return false;
        if (signedData == null || signature == null || signature.length == 0) return false;
        try {
            PublicKey key = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(publicKeyDer));
            // The algorithm Google Play uses to sign purchase data.
            Signature verifier = Signature.getInstance("SHA1withRSA");
            verifier.initVerify(key);
            verifier.update(signedData.getBytes(StandardCharsets.UTF_8));
            return verifier.verify(signature);
        } catch (GeneralSecurityException | IllegalArgumentException error) {
            return false;
        }
    }
}
