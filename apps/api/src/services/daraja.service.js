/**
 * ============================================================
 * FILE: apps/api/src/services/daraja.service.js
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   One shared place that asks M-Pesa (Daraja) to send an STK push
 *   (the "enter your PIN" prompt) to a customer's phone, using the
 *   CURRENT shop's own till and keys. A controller calls
 *   stkPush(req.db, {...}) and never touches a key itself.
 *
 * WHY IMPORTANT
 *   The keys decide WHICH shop gets the money. Using the wrong
 *   shop's keys would send a customer's payment to the wrong till.
 *   Logging a key would leak it into log files for good. A wrong
 *   amount would charge a customer the wrong money.
 *
 * DANGER
 *   - NEVER log the keys, the passkey, the access token, the
 *     Password, the request, the response or the phone number.
 *     This file has NO console calls on purpose. Keep it that way.
 *   - Never put a key, token or phone number in an error message.
 *   - The amount sent to Safaricom must equal the order total. It
 *     is refused (not rounded) if it is not whole shillings.
 *   - This file only STARTS a payment. It does NOT say a payment
 *     succeeded. Only the verified callback does that.
 *
 * WHAT IT SOLVES
 *   Day 3, Task 2: "Get an access token. Call STK push" for the
 *   tenant, with the keys read from daraja_configs and decrypted
 *   at the last moment.
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Least privilege + one shared sender. The shop comes from the
 *   database lock (set by withTenant), never from an argument the
 *   caller could get wrong. Secrets are decrypted only inside the
 *   call, in memory, and never stored or returned.
 *
 * RULES
 *   1. The shop = whatever app.current_tenant is set to on `db`.
 *      daraja_configs has RLS, and the query also filters by it.
 *   2. Decrypt with decryptSecret(stored, tenantId) at the last moment.
 *   3. No logging in this file. Errors carry no secrets.
 *   4. Phone is normalised to 2547XXXXXXXX or 2541XXXXXXXX, else refused.
 *   5. Amount is whole shillings (amountCents divisible by 100, at least
 *      KES 1). Anything else is refused, never silently changed.
 *   6. A request timeout, so a slow Safaricom cannot hang the server.
 *   7. Errors carry only a short code (see ERROR CODES), never Daraja's
 *      own text.
 *
 * ERROR CODES (err.code)
 *   daraja_not_configured     the shop has no daraja_configs row
 *   invalid_phone             the phone is not a Kenyan mobile number
 *   amount_not_whole_shillings  the order total is not whole KES
 *   daraja_auth_failed        Safaricom refused the shop's key/secret
 *   daraja_rejected           Safaricom refused the push
 *   daraja_unreachable        timeout or network failure
 *   daraja_query_unconfirmed  Safaricom could not (yet) confirm a payment's
 *                             state; the caller must NOT credit anything
 *
 * PRACTICAL EXAMPLE
 *   In the pay controller for Amina's order of KES 1,500:
 *     const r = await stkPush(req.db, {
 *       amountCents: 150000,
 *       phone: '0712345678',
 *       accountReference: 'ORDER-AB12CD34',
 *     });
 *   -> Amina's keys are used, the customer's phone shows the PIN prompt,
 *      and r = { merchantRequestId, checkoutRequestId }.
 *      checkoutRequestId is how the callback is matched later.
 *
 * DECISIONS (and WHY)
 *   - First argument is `db` (req.db), like sendWhatsApp. It is already
 *     locked to one shop.
 *   - tenant_id comes back from the same query and is the "shop lock"
 *     when decrypting (see kms.js).
 *   - Node's built-in fetch: no extra package.
 *   - DARAJA_API_BASE (optional) overrides the address, so tests can
 *     point at a fake server and never touch Safaricom. Without it,
 *     the address follows the shop's env: sandbox or production.
 *   - A new access token for every push (they last about an hour).
 *     Simple and safe; caching per shop is a later improvement.
 *   - AccountReference is for the customer's statement (Daraja allows
 *     12 characters, so the controller sends a short code). The real
 *     link between a callback and an order is checkoutRequestId, which
 *     the pay controller stores in payment_attempts. Daraja's callback
 *     does NOT send AccountReference back.
 *   - Timestamp uses East Africa Time (UTC+3), as Daraja expects.
 *
 * WHERE USED / FUTURE USES
 *   - controllers/payments.controller.js (POST /v1/orders/:id/pay)
 *   - controllers/mpesa.callback.controller.js: queryStkStatus() asks
 *     Safaricom "did this payment really happen?" BEFORE any money is
 *     credited (Week 29 Day 3, the second lock on the callback).
 *   - Later: refunds (reversal API) and the nightly reconciliation job,
 *     which will call queryStkStatus() for attempts stuck in 'pending'.
 *
 * TRADEOFFS
 *   + One small function, easy to fake in tests.
 *   - One config query and one token request per push. Fine for now.
 *   - Whole shillings only: a price like KES 350.50 is refused until
 *     the product rules decide how to round.
 *
 * HOW TO USE
 *   import { stkPush, queryStkStatus, normalizePhone } from '../services/daraja.service.js';
 *   const { checkoutRequestId } = await stkPush(req.db, {
 *     amountCents: 150000, phone: '0712345678', accountReference: 'ORDER-AB12CD34',
 *   });
 *
 * ============================================================
 */
// decryptSecret: the unscrambler for stored secrets (see utils/kms.js).
// It needs the shop's id as the "lock", so a key copied from another shop's
// row will not open. Real life: a safe-deposit box that opens only with the
// right customer's own key AND the bank's master key.
import { decryptSecret } from '../utils/kms.js';

// -------------------------------------------------------------
// PIECE 1: Safaricom's two addresses
// -------------------------------------------------------------
// Safaricom runs a practice server (sandbox) with fake money and a real
// server (production) with real money. The shop's `env` column says which
// one this shop uses. Real life: a driving-school practice track vs the
// public road. Where used: apiBase() below.
const BASES = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
};

// -------------------------------------------------------------
// PIECE 2: apiBase(env)
// -------------------------------------------------------------
// Picks the address. If DARAJA_API_BASE is set (only in tests), it wins, so
// a test can point us at a fake local server and never call Safaricom.
// It is a function, read at call time, so a test can change it between calls.
// Real life: a phone's "call forwarding": the number stays the same, but
// during training the calls go to the practice desk.
const apiBase = (env) => process.env.DARAJA_API_BASE || BASES[env];

// -------------------------------------------------------------
// PIECE 3: TIMEOUT_MS
// -------------------------------------------------------------
// 10 seconds. If Safaricom does not answer in time we give up, so one slow
// answer cannot freeze the server for every shop. Real life: you do not wait
// on hold forever; after 10 seconds you hang up and tell the customer.
const TIMEOUT_MS = 10000;

// -------------------------------------------------------------
// PIECE 4: fail(code, message)
// -------------------------------------------------------------
// Builds an Error with a short `code` (like 'invalid_phone') that the caller
// can switch on. The message is fixed text WE wrote, so it can never contain
// a key, a token or a phone number. Real life: a rejection slip with a
// printed reason code, never a copy of the customer's card.
function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// -------------------------------------------------------------
// PIECE 5: normalizePhone(input)   (exported, used by the pay controller)
// -------------------------------------------------------------
// People type phones many ways. Daraja wants ONE shape: 254 then the number,
// digits only (254712345678).
//   '0712345678'     -> '254712345678'   (leading 0 replaced by 254)
//   '712345678'      -> '254712345678'   (missing 0 or 254 added)
//   '+254 712-345678'-> '254712345678'   (spaces, dashes, brackets, + removed)
//   '0612345678'     -> refused          (Kenyan mobiles start 07 or 01)
// Step by step:
//   1. String(input ?? '') makes sure we always have text, even for null.
//   2. .replace(/[\s\-()]/g, '') removes spaces, dashes and brackets.
//   3. .replace(/^\+/, '') removes one leading plus sign.
//   4. The two `if` lines add 254 for the local styles.
//   5. The final regex insists on 254, then 7 or 1, then 8 more digits.
// The wrong input is NOT copied into the error (it may be someone's number).
export function normalizePhone(input) {
  const digits = String(input ?? '').replace(/[\s\-()]/g, '').replace(/^\+/, '');
  let msisdn = digits;
  if (/^0[17]\d{8}$/.test(digits)) msisdn = `254${digits.slice(1)}`;
  else if (/^[17]\d{8}$/.test(digits)) msisdn = `254${digits}`;
  if (!/^254[17]\d{8}$/.test(msisdn)) {
    throw fail('invalid_phone', 'Phone number is not a valid Kenyan mobile number');
  }
  return msisdn;
}

// -------------------------------------------------------------
// PIECE 6: nairobiTimestamp()
// -------------------------------------------------------------
// Daraja wants the time as 14 digits: YYYYMMDDHHmmss, in Kenya time (UTC+3).
// Example: 15:04:09 on 14 Nov 2026 -> '20261114150409'.
// How: add 3 hours to "now", turn it into text like
// '2026-11-14T15:04:09.123Z', delete the - : T characters, keep 14 digits.
// The same timestamp goes into the Password AND the request, and Daraja
// re-computes the Password from it, so they must match exactly.
function nairobiTimestamp() {
  const eat = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return eat.toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

// -------------------------------------------------------------
// PIECE 7: fetchJson(url, options)
// -------------------------------------------------------------
// ONE careful way to call Safaricom, used for both the login and the push.
//   - AbortSignal.timeout(TIMEOUT_MS) cancels the call after 10 seconds.
//   - If the network fails or times out, we throw 'daraja_unreachable' with
//     NO details (the details could contain the address or headers).
//   - We try to read the answer as JSON. If it is not JSON we leave body as
//     null and NEVER copy the raw text anywhere.
//   - We return only { status, body }; the caller decides what they mean.
// Real life: a trusted courier who always brings back either the signed
// reply or "could not deliver", never the contents of your envelope.
async function fetchJson(url, options) {
  let res;
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw fail('daraja_unreachable', 'Could not reach M-Pesa');
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    // Not JSON: leave body null. We never copy the text anywhere.
  }
  return { status: res.status, body };
}

// -------------------------------------------------------------
// PIECE 8: loadConfig(db)
// -------------------------------------------------------------
// Reads THIS shop's payment settings row. Two locks on purpose:
//   1. RLS: the database already shows only the shop set by withTenant.
//   2. The WHERE: repeats it, so the query stays safe even if someone ever
//      weakens RLS. NULLIF(...,'') turns an empty setting into NULL, which
//      matches no row, instead of crashing on a bad UUID.
// If there is no row, this shop never set up M-Pesa, so we say so clearly
// ('daraja_not_configured'). Real life: the bank clerk checks the shop's own
// folder, then checks the folder label again before handing anything over.
async function loadConfig(db) {
  const { rows } = await db.query(
    `SELECT tenant_id, env, consumer_key_encrypted, consumer_secret_encrypted,
            shortcode, passkey_encrypted, callback_url
       FROM daraja_configs
      WHERE tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID`
  );
  if (!rows[0]) {
    throw fail('daraja_not_configured', 'This shop has no M-Pesa settings');
  }
  return rows[0];
}

// -------------------------------------------------------------
// PIECE 9: getAccessToken(cfg)
// -------------------------------------------------------------
// Daraja's "login". We prove we are this shop's app by sending
// base64("consumerKey:consumerSecret") in an Authorization: Basic header.
// Daraja replies with a short-lived access_token (about an hour).
//   - The key and secret are decrypted here, at the last moment, with the
//     shop's id as the lock, and only live in these two variables.
//   - The token goes back to stkPush() in memory. It is never stored, never
//     logged, never returned to the browser.
//   - Anything other than status 200 with a token means Safaricom refused the
//     shop's key/secret: 'daraja_auth_failed'. We include only the status
//     number, not Safaricom's text.
// Real life: showing your ID at the bank door to get a visitor badge that
// expires in an hour.
async function getAccessToken(cfg) {
  const key = decryptSecret(cfg.consumer_key_encrypted, cfg.tenant_id);
  const secret = decryptSecret(cfg.consumer_secret_encrypted, cfg.tenant_id);
  const basic = Buffer.from(`${key}:${secret}`).toString('base64');

  const { status, body } = await fetchJson(
    `${apiBase(cfg.env)}/oauth/v1/generate?grant_type=client_credentials`,
    { method: 'GET', headers: { Authorization: `Basic ${basic}` } }
  );
  if (status !== 200 || !body || typeof body.access_token !== 'string') {
    throw fail('daraja_auth_failed', `M-Pesa login failed (status ${status})`);
  }
  return body.access_token;
}

// -------------------------------------------------------------
// PIECE 9b: makePassword(cfg)
// -------------------------------------------------------------
// Daraja wants base64(shortcode + passkey + timestamp) on BOTH the push and
// the status query, so it lives in one place. The passkey is decrypted only
// here, only for this line, and the result is never logged.
// Returns { timestamp, password }.
function makePassword(cfg) {
  const passkey = decryptSecret(cfg.passkey_encrypted, cfg.tenant_id);
  const timestamp = nairobiTimestamp();
  const password = Buffer.from(`${cfg.shortcode}${passkey}${timestamp}`).toString('base64');
  return { timestamp, password };
}

// -------------------------------------------------------------
// PIECE 10: stkPush(db, { amountCents, phone, accountReference })
// -------------------------------------------------------------
// The one function the rest of the app calls. In order:
//
//  a) Check the database connection was passed (a programming mistake
//     otherwise, so a plain Error, not a payment error).
//
//  b) MONEY RULE: the amount must be a whole number of cents, at least 100
//     (KES 1), and divisible by 100 (whole shillings). Daraja only takes
//     whole shillings, so KES 350.50 is REFUSED instead of silently becoming
//     KES 350 or KES 351. Real life: a till that says "I cannot take that
//     amount" instead of quietly charging a different one.
//
//  c) normalizePhone() cleans and checks the number.
//
//  d) loadConfig() gets the shop's settings; getAccessToken() logs in.
//
//  e) The Password. Daraja wants base64(shortcode + passkey + timestamp).
//     It re-computes it on its side to confirm we own this till. It is built
//     in memory and never logged. The passkey is decrypted only for this line.
//
//  f) The request body, field by field:
//       BusinessShortCode  the shop's till number
//       Password/Timestamp the proof above
//       TransactionType    'CustomerPayBillOnline' (a normal pay-bill push)
//       Amount             amountCents / 100 = shillings (150000 -> 1500)
//       PartyA, PhoneNumber the customer who pays and gets the prompt
//       PartyB             the shop's till, who receives the money
//       CallBackURL        where Safaricom reports the result later
//       AccountReference   short label on the customer's statement
//                          (cut to 12 characters, Daraja's limit)
//       TransactionDesc    short text shown to the customer
//
//  g) ResponseCode '0' means "the prompt was sent". It does NOT mean the
//     customer paid. Anything else is 'daraja_rejected'. Success returns the
//     two ids Safaricom made for this push. checkoutRequestId is the key the
//     pay controller saves in payment_attempts, and it is how the callback is
//     matched to the push we started.
// Real life: asking the till operator to hold out the card machine to the
// customer; "machine is out" is not the same as "customer paid".
export async function stkPush(db, { amountCents, phone, accountReference }) {
  if (!db || typeof db.query !== 'function') {
    throw new Error('stkPush needs a database connection');
  }

  // Money rule: whole shillings only, and at least KES 1. Refuse, never round.
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents % 100 !== 0) {
    throw fail('amount_not_whole_shillings', 'Amount must be whole shillings (at least 1)');
  }
  const msisdn = normalizePhone(phone);

  const cfg = await loadConfig(db);
  const token = await getAccessToken(cfg);

  // Password = base64(shortcode + passkey + timestamp). Daraja re-computes it
  // to check we really own this till. Built in memory, never logged.
  const { timestamp, password } = makePassword(cfg);

  const { status, body } = await fetchJson(
    `${apiBase(cfg.env)}/mpesa/stkpush/v1/processrequest`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: cfg.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amountCents / 100,          // Daraja wants shillings
        PartyA: msisdn,                     // who pays
        PartyB: cfg.shortcode,              // who gets paid
        PhoneNumber: msisdn,                // where the prompt appears
        CallBackURL: cfg.callback_url,      // where Safaricom reports the result
        AccountReference: String(accountReference ?? '').slice(0, 12),
        TransactionDesc: 'Order payment',
      }),
    }
  );

  // ResponseCode '0' means "prompt sent", NOT "paid". Paid comes by callback.
  if (status !== 200 || !body || body.ResponseCode !== '0' ||
      typeof body.CheckoutRequestID !== 'string') {
    throw fail('daraja_rejected', `M-Pesa refused the request (status ${status})`);
  }

  return {
    merchantRequestId: body.MerchantRequestID ?? null,
    checkoutRequestId: body.CheckoutRequestID,
  };
}

// -------------------------------------------------------------
// PIECE 11: queryStkStatus(db, checkoutRequestId)   (Week 29 Day 3)
// -------------------------------------------------------------
// Asks Safaricom directly: "what happened to THIS payment prompt?"
// This is the SECOND LOCK on the callback. Safaricom's callback is not signed,
// so anyone who learned a CheckoutRequestID could post a fake "paid". Before
// we credit any money we ask Safaricom ourselves, with the shop's own keys,
// and believe THAT answer, not the callback's.
// Real life: a courier says "parcel delivered"; before you pay him you phone
// the shop and ask "did you really send it?".
//
// It returns only a plain word:
//   'paid'   Safaricom says the customer completed the payment
//   'failed' Safaricom says it did not (cancelled, wrong PIN, no money, ...)
// and THROWS daraja_query_unconfirmed for everything else: the customer is
// still typing their PIN ("being processed"), Safaricom is down, the answer
// is odd, or the answer is about a different CheckoutRequestID. Callers treat
// a throw as "do not credit, leave it pending, try again later".
// It never returns amounts, receipts or phones (the query does not carry
// them), and nothing in it is logged.
//
// Step by step:
//   a) The id is only letters, digits, _ and - (and at most 100 long). Anything
//      else is refused BEFORE any network call, so an attacker cannot push odd
//      text into our request to Safaricom.
//   b) Load THIS shop's config (RLS + WHERE), log in, build the Password, call
//      /mpesa/stkpushquery/v1/query.
//   c) Safaricom answers ResponseCode '0' (request understood) plus a
//      ResultCode: '0' = paid, anything else = failed. If it is still being
//      processed it answers with an error status instead: unconfirmed.
//   d) If Safaricom's answer names a different CheckoutRequestID than we asked
//      about, we do not trust it: unconfirmed.
export async function queryStkStatus(db, checkoutRequestId) {
  if (!db || typeof db.query !== 'function') {
    throw new Error('queryStkStatus needs a database connection');
  }
  if (typeof checkoutRequestId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(checkoutRequestId)) {
    throw fail('daraja_query_unconfirmed', 'Payment status could not be confirmed');
  }

  const cfg = await loadConfig(db);
  const token = await getAccessToken(cfg);
  const { timestamp, password } = makePassword(cfg);

  const { status, body } = await fetchJson(
    `${apiBase(cfg.env)}/mpesa/stkpushquery/v1/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: cfg.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    }
  );

  // Anything that is not a clean, matching answer is "unconfirmed".
  const clean = status === 200 && body && body.ResponseCode === '0' &&
    body.ResultCode !== undefined && body.ResultCode !== null &&
    (body.CheckoutRequestID === undefined || body.CheckoutRequestID === checkoutRequestId);
  if (!clean) {
    throw fail('daraja_query_unconfirmed', 'Payment status could not be confirmed');
  }
  return String(body.ResultCode) === '0' ? 'paid' : 'failed';
}