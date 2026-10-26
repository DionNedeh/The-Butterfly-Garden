package io.github.dionnedeh.butterflygarden.billing;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import org.junit.BeforeClass;
import org.junit.Test;

public class PurchaseSignatureTest {

    private static final String PURCHASE =
        "{\"orderId\":\"GPA.0000-0000-0000-00000\",\"packageName\":\"io.github.dionnedeh.butterflygarden\"," +
        "\"productId\":\"garden_pass\",\"purchaseState\":0,\"purchaseToken\":\"token\"}";

    private static KeyPair play;
    private static KeyPair stranger;

    @BeforeClass
    public static void makeKeys() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        play = generator.generateKeyPair();
        stranger = generator.generateKeyPair();
    }

    private static byte[] sign(KeyPair keys, String data) throws Exception {
        Signature signer = Signature.getInstance("SHA1withRSA");
        signer.initSign(keys.getPrivate());
        signer.update(data.getBytes(StandardCharsets.UTF_8));
        return signer.sign();
    }

    @Test
    public void acceptsAPurchaseSignedWithTheAppsKey() throws Exception {
        assertTrue(PurchaseSignature.isValid(play.getPublic().getEncoded(), PURCHASE, sign(play, PURCHASE)));
    }

    @Test
    public void rejectsAPurchaseWhoseDataWasAltered() throws Exception {
        byte[] signature = sign(play, PURCHASE);
        String altered = PURCHASE.replace("\"purchaseState\":0", "\"purchaseState\":1");
        assertFalse(PurchaseSignature.isValid(play.getPublic().getEncoded(), altered, signature));
    }

    @Test
    public void rejectsAPurchaseSignedWithAnotherKey() throws Exception {
        assertFalse(PurchaseSignature.isValid(play.getPublic().getEncoded(), PURCHASE, sign(stranger, PURCHASE)));
    }

    @Test
    public void grantsNothingWithoutAUsableKey() throws Exception {
        byte[] signature = sign(play, PURCHASE);
        assertFalse(PurchaseSignature.isValid(new byte[0], PURCHASE, signature));
        assertFalse(PurchaseSignature.isValid(null, PURCHASE, signature));
        assertFalse(PurchaseSignature.isValid(new byte[] { 1, 2, 3 }, PURCHASE, signature));
    }

    @Test
    public void rejectsMissingOrEmptySignatures() {
        byte[] key = play.getPublic().getEncoded();
        assertFalse(PurchaseSignature.isValid(key, PURCHASE, null));
        assertFalse(PurchaseSignature.isValid(key, PURCHASE, new byte[0]));
        assertFalse(PurchaseSignature.isValid(key, null, new byte[] { 1 }));
        assertFalse(PurchaseSignature.isValid(key, PURCHASE, new byte[] { 1, 2, 3 }));
    }
}
