/**
 * Minimal Coinbase CDP JWT + x402 facilitator calls with NO external deps.
 * Works in Node 18+ (uses built-in crypto & fetch).
 *
 * Inputs (env or hardcode carefully):
 *   CDP_API_KEY_ID     -> your API Key "name"/ID
 *   CDP_API_KEY_SECRET -> your API Key private key:
 *       - Ed25519: base64-encoded PKCS#8 DER string (often ends with ==)
 *       - ES256: PEM string "-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----\n"
 */
const HOST = "api.cdp.coinbase.com"; // CDP host
const FACILITATOR_VERIFY_PATH = "/platform/v2/x402/verify";
const FACILITATOR_SETTLE_PATH = "/platform/v2/x402/settle";

const { createPrivateKey, sign: nodeSign } = require("crypto");

// --- helpers ---
const b64url = (buf) =>
  Buffer.from(buf).toString("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

function toKeyObjectFromSecret(secret) {
  // If it looks like PEM, pass through; else treat as base64 DER PKCS#8
  if (secret.startsWith("-----BEGIN")) {
    return createPrivateKey({ key: secret });
  }
  return createPrivateKey({
    key: Buffer.from(secret, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

function detectAlg(keyObj) {
  // Returns { algHeader, signFnParams }
  const asn1Type = keyObj.asymmetricKeyType; // 'ec' | 'ed25519' | ...
  if (asn1Type === "ed25519") {
    return { algHeader: "EdDSA", signAlg: null }; // crypto.sign(null, ...) for Ed25519
  }
  if (asn1Type === "ec") {
    return { algHeader: "ES256", signAlg: "sha256" }; // ECDSA P-256 with SHA-256
  }
  throw new Error(`Unsupported key type: ${asn1Type}. Use Ed25519 or EC P-256.`);
}

/**
 * Build a CDP JWT (Bearer) for a specific HTTP request.
 * Coinbase recommends binding method/host/path into the token.
 * Token is valid for ~120s by default.
 */
function buildCdpJwt({ apiKeyId, apiKeySecret, method, host, path, expiresInSec = 120, audience = ["cdp-api"] }) {
  const keyObj = toKeyObjectFromSecret(apiKeySecret);
  const { algHeader, signAlg } = detectAlg(keyObj);

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: algHeader,
    typ: "JWT",
    kid: apiKeyId,           // key id in header
  };
  // Payload claims per CDP guidance:
  // - iss/sub: key id
  // - nbf/iat/exp: bounded validity (<= 2 mins)
  // - aud: target service
  // - uris: bind this JWT to specific request tuple
  const payload = {
    iss: "coinbase-cloud",
    sub: apiKeyId,
    iat: now,
    nbf: now,
    exp: now + expiresInSec,
    aud: audience,
    uris: [`${method.toUpperCase()} ${host}${path}`],
  };

  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const signingInput = `${encHeader}.${encPayload}`;

  // For Ed25519, pass algorithm=null; for ES256, pass 'sha256'
  const signature = nodeSign(signAlg, Buffer.from(signingInput), keyObj);
  const encSig = b64url(signature);

  return `${encHeader}.${encPayload}.${encSig}`;
}

// ---- public functions you’ll call ----

async function verifyPayment({ paymentPayload, paymentRequirements }) {
  const token = buildCdpJwt({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    method: "POST",
    host: HOST,
    path: FACILITATOR_VERIFY_PATH,
  });

  const res = await fetch(`https://${HOST}${FACILITATOR_VERIFY_PATH}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements }),
  });
  if (!res.ok) throw new Error(`/verify ${res.status}: ${await res.text()}`);
  return res.json(); // { isValid, invalidReason?, payer }
}

async function settlePayment({ paymentPayload, paymentRequirements }) {
  const token = buildCdpJwt({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    method: "POST",
    host: HOST,
    path: FACILITATOR_SETTLE_PATH,
  });

  const res = await fetch(`https://${HOST}${FACILITATOR_SETTLE_PATH}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements }),
  });
  if (!res.ok) throw new Error(`/settle ${res.status}: ${await res.text()}`);
  return res.json(); // { success, errorReason?, payer, transaction, network }
}

// Example (drop into an n8n Code node):
// const v = await verifyPayment({ paymentPayload, paymentRequirements });
// if (!v.isValid) throw new Error(v.invalidReason);
// const s = await settlePayment({ paymentPayload, paymentRequirements });
// return s;
