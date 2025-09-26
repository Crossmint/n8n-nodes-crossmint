/**
 * Solana Public Key Derivation (TypeScript)
 * 
 * This file contains all the code necessary to derive Ed25519 public keys from private keys
 * for Solana, extracted from TweetNaCl.js without modifications to the core derivation logic.
 * 
 * The main functions for public key derivation are:
 * - derivePublicKeyFromSeed(seed) - derives key pair from 32-byte seed
 * - derivePublicKeyFromSecretKey(secretKey) - extracts public key from 64-byte secret key
 */

// ========== TYPE DEFINITIONS ==========

interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

interface U64 {
  hi: number;
  lo: number;
}

type GF = Float64Array;

interface SolanaKeyDerivation {
  derivePublicKeyFromSeed(seed: Uint8Array): KeyPair;
  derivePublicKeyFromSecretKey(secretKey: Uint8Array): KeyPair;
  generateRandomKeyPair(): KeyPair;
  generateRandomSeed(): Uint8Array;
  readonly PUBLIC_KEY_LENGTH: number;
  readonly SECRET_KEY_LENGTH: number;
  readonly SEED_LENGTH: number;
}

// ========== CORE CRYPTOGRAPHIC FUNCTIONS (COPIED FROM TWEETNACL.JS) ==========

const gf = (init?: number[]): GF => {
  const r = new Float64Array(16);
  if (init) {
    for (let i = 0; i < init.length; i++) {
      r[i] = init[i];
    }
  }
  return r;
};

// Pluggable, initialized in high-level API below.
let randombytes: (x: Uint8Array, n: number) => void = () => {
  throw new Error('no PRNG');
};

const gf0: GF = gf();
const gf1: GF = gf([1]);
// Unused tweetnacl constants - kept for cryptographic completeness
// @ts-ignore: TS6133 - Cryptographic constants preserved for completeness
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const __121665: GF = gf([0xdb41, 1]);
// @ts-ignore: TS6133 - Cryptographic constants preserved for completeness
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _D: GF = gf([0x78a3, 0x1359, 0x4dca, 0x75eb, 0xd8ab, 0x4141, 0x0a4d, 0x0070, 0xe898, 0x7779, 0x4079, 0x8cc7, 0xfe73, 0x2b6f, 0x6cee, 0x5203]);
const D2: GF = gf([0xf159, 0x26b2, 0x9b94, 0xebd6, 0xb156, 0x8283, 0x149a, 0x00e0, 0xd130, 0xeef3, 0x80f2, 0x198e, 0xfce7, 0x56df, 0xd9dc, 0x2406]);
const X: GF = gf([0xd51a, 0x8f25, 0x2d60, 0xc956, 0xa7b2, 0x9525, 0xc760, 0x692c, 0xdc5c, 0xfdd6, 0xe231, 0xc0a4, 0x53fe, 0xcd6e, 0x36d3, 0x2169]);
const Y: GF = gf([0x6658, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666]);
// @ts-ignore: TS6133 - Cryptographic constants preserved for completeness
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _I: GF = gf([0xa0b0, 0x4a0e, 0x1b27, 0xc4ee, 0xe478, 0xad2f, 0x1806, 0x2f43, 0xd7a7, 0x3dfb, 0x0099, 0x2b4d, 0xdf0b, 0x4fc1, 0x2480, 0x2b83]);

class u64 implements U64 {
  hi: number;
  lo: number;

  constructor(h: number, l: number) {
    this.hi = (h | 0) >>> 0;
    this.lo = (l | 0) >>> 0;
  }
}

function ts64(x: Uint8Array, i: number, u: U64): void {
  x[i] = (u.hi >> 24) & 0xff;
  x[i + 1] = (u.hi >> 16) & 0xff;
  x[i + 2] = (u.hi >> 8) & 0xff;
  x[i + 3] = u.hi & 0xff;
  x[i + 4] = (u.lo >> 24) & 0xff;
  x[i + 5] = (u.lo >> 16) & 0xff;
  x[i + 6] = (u.lo >> 8) & 0xff;
  x[i + 7] = u.lo & 0xff;
}

function dl64(x: Uint8Array, i: number): U64 {
  const h = (x[i] << 24) | (x[i + 1] << 16) | (x[i + 2] << 8) | x[i + 3];
  const l = (x[i + 4] << 24) | (x[i + 5] << 16) | (x[i + 6] << 8) | x[i + 7];
  return new u64(h, l);
}

function set25519(r: GF, a: GF): void {
  for (let i = 0; i < 16; i++) {
    r[i] = a[i] | 0;
  }
}

function car25519(o: GF): void {
  let c: number;
  for (let i = 0; i < 16; i++) {
    o[i] += 65536;
    c = Math.floor(o[i] / 65536);
    o[(i + 1) * (i < 15 ? 1 : 0)] += c - 1 + 37 * (c - 1) * (i === 15 ? 1 : 0);
    o[i] -= c * 65536;
  }
}

function sel25519(p: GF, q: GF, b: number): void {
  let t: number;
  const c = ~(b - 1);
  for (let i = 0; i < 16; i++) {
    t = c & (p[i] ^ q[i]);
    p[i] ^= t;
    q[i] ^= t;
  }
}

function pack25519(o: Uint8Array, n: GF): void {
  let i: number, j: number, b: number;
  const m = gf();
  const t = gf();
  for (i = 0; i < 16; i++) t[i] = n[i];
  car25519(t);
  car25519(t);
  car25519(t);
  for (j = 0; j < 2; j++) {
    m[0] = t[0] - 0xffed;
    for (i = 1; i < 15; i++) {
      m[i] = t[i] - 0xffff - ((m[i - 1] >> 16) & 1);
      m[i - 1] &= 0xffff;
    }
    m[15] = t[15] - 0x7fff - ((m[14] >> 16) & 1);
    b = (m[15] >> 16) & 1;
    m[14] &= 0xffff;
    sel25519(t, m, 1 - b);
  }
  for (i = 0; i < 16; i++) {
    o[2 * i] = t[i] & 0xff;
    o[2 * i + 1] = t[i] >> 8;
  }
}

function par25519(a: GF): number {
  const d = new Uint8Array(32);
  pack25519(d, a);
  return d[0] & 1;
}

function A(o: GF, a: GF, b: GF): void {
  for (let i = 0; i < 16; i++) {
    o[i] = (a[i] + b[i]) | 0;
  }
}

function Z(o: GF, a: GF, b: GF): void {
  for (let i = 0; i < 16; i++) {
    o[i] = (a[i] - b[i]) | 0;
  }
}

function M(o: GF, a: GF, b: GF): void {
  let i: number, j: number;
  const t = new Float64Array(31);
  for (i = 0; i < 31; i++) t[i] = 0;
  for (i = 0; i < 16; i++) {
    for (j = 0; j < 16; j++) {
      t[i + j] += a[i] * b[j];
    }
  }
  for (i = 0; i < 15; i++) {
    t[i] += 38 * t[i + 16];
  }
  for (i = 0; i < 16; i++) o[i] = t[i];
  car25519(o);
  car25519(o);
}

function S(o: GF, a: GF): void {
  M(o, a, a);
}

function inv25519(o: GF, i: GF): void {
  const c = gf();
  let a: number;
  for (a = 0; a < 16; a++) c[a] = i[a];
  for (a = 253; a >= 0; a--) {
    S(c, c);
    if (a !== 2 && a !== 4) M(c, c, i);
  }
  for (a = 0; a < 16; a++) o[a] = c[a];
}

function add64(...args: U64[]): U64 {
  let a = 0, b = 0, c = 0, d = 0;
  const m16 = 65535;
  let l: number, h: number;
  
  for (let i = 0; i < args.length; i++) {
    l = args[i].lo;
    h = args[i].hi;
    a += l & m16;
    b += l >>> 16;
    c += h & m16;
    d += h >>> 16;
  }

  b += a >>> 16;
  c += b >>> 16;
  d += c >>> 16;

  return new u64((c & m16) | (d << 16), (a & m16) | (b << 16));
}

function shr64(x: U64, c: number): U64 {
  return new u64(x.hi >>> c, (x.lo >>> c) | (x.hi << (32 - c)));
}

function xor64(...args: U64[]): U64 {
  let l = 0, h = 0;
  for (let i = 0; i < args.length; i++) {
    l ^= args[i].lo;
    h ^= args[i].hi;
  }
  return new u64(h, l);
}

function R(x: U64, c: number): U64 {
  let h: number, l: number;
  const c1 = 32 - c;
  if (c < 32) {
    h = (x.hi >>> c) | (x.lo << c1);
    l = (x.lo >>> c) | (x.hi << c1);
  } else if (c < 64) {
    h = (x.lo >>> c) | (x.hi << c1);
    l = (x.hi >>> c) | (x.lo << c1);
  } else {
    h = 0;
    l = 0;
  }
  return new u64(h, l);
}

function Ch(x: U64, y: U64, z: U64): U64 {
  const h = (x.hi & y.hi) ^ (~x.hi & z.hi);
  const l = (x.lo & y.lo) ^ (~x.lo & z.lo);
  return new u64(h, l);
}

function Maj(x: U64, y: U64, z: U64): U64 {
  const h = (x.hi & y.hi) ^ (x.hi & z.hi) ^ (y.hi & z.hi);
  const l = (x.lo & y.lo) ^ (x.lo & z.lo) ^ (y.lo & z.lo);
  return new u64(h, l);
}

function Sigma0(x: U64): U64 {
  return xor64(R(x, 28), R(x, 34), R(x, 39));
}

function Sigma1(x: U64): U64 {
  return xor64(R(x, 14), R(x, 18), R(x, 41));
}

function sigma0(x: U64): U64 {
  return xor64(R(x, 1), R(x, 8), shr64(x, 7));
}

function sigma1(x: U64): U64 {
  return xor64(R(x, 19), R(x, 61), shr64(x, 6));
}

const K: U64[] = [
  new u64(0x428a2f98, 0xd728ae22), new u64(0x71374491, 0x23ef65cd),
  new u64(0xb5c0fbcf, 0xec4d3b2f), new u64(0xe9b5dba5, 0x8189dbbc),
  new u64(0x3956c25b, 0xf348b538), new u64(0x59f111f1, 0xb605d019),
  new u64(0x923f82a4, 0xaf194f9b), new u64(0xab1c5ed5, 0xda6d8118),
  new u64(0xd807aa98, 0xa3030242), new u64(0x12835b01, 0x45706fbe),
  new u64(0x243185be, 0x4ee4b28c), new u64(0x550c7dc3, 0xd5ffb4e2),
  new u64(0x72be5d74, 0xf27b896f), new u64(0x80deb1fe, 0x3b1696b1),
  new u64(0x9bdc06a7, 0x25c71235), new u64(0xc19bf174, 0xcf692694),
  new u64(0xe49b69c1, 0x9ef14ad2), new u64(0xefbe4786, 0x384f25e3),
  new u64(0x0fc19dc6, 0x8b8cd5b5), new u64(0x240ca1cc, 0x77ac9c65),
  new u64(0x2de92c6f, 0x592b0275), new u64(0x4a7484aa, 0x6ea6e483),
  new u64(0x5cb0a9dc, 0xbd41fbd4), new u64(0x76f988da, 0x831153b5),
  new u64(0x983e5152, 0xee66dfab), new u64(0xa831c66d, 0x2db43210),
  new u64(0xb00327c8, 0x98fb213f), new u64(0xbf597fc7, 0xbeef0ee4),
  new u64(0xc6e00bf3, 0x3da88fc2), new u64(0xd5a79147, 0x930aa725),
  new u64(0x06ca6351, 0xe003826f), new u64(0x14292967, 0x0a0e6e70),
  new u64(0x27b70a85, 0x46d22ffc), new u64(0x2e1b2138, 0x5c26c926),
  new u64(0x4d2c6dfc, 0x5ac42aed), new u64(0x53380d13, 0x9d95b3df),
  new u64(0x650a7354, 0x8baf63de), new u64(0x766a0abb, 0x3c77b2a8),
  new u64(0x81c2c92e, 0x47edaee6), new u64(0x92722c85, 0x1482353b),
  new u64(0xa2bfe8a1, 0x4cf10364), new u64(0xa81a664b, 0xbc423001),
  new u64(0xc24b8b70, 0xd0f89791), new u64(0xc76c51a3, 0x0654be30),
  new u64(0xd192e819, 0xd6ef5218), new u64(0xd6990624, 0x5565a910),
  new u64(0xf40e3585, 0x5771202a), new u64(0x106aa070, 0x32bbd1b8),
  new u64(0x19a4c116, 0xb8d2d0c8), new u64(0x1e376c08, 0x5141ab53),
  new u64(0x2748774c, 0xdf8eeb99), new u64(0x34b0bcb5, 0xe19b48a8),
  new u64(0x391c0cb3, 0xc5c95a63), new u64(0x4ed8aa4a, 0xe3418acb),
  new u64(0x5b9cca4f, 0x7763e373), new u64(0x682e6ff3, 0xd6b2b8a3),
  new u64(0x748f82ee, 0x5defb2fc), new u64(0x78a5636f, 0x43172f60),
  new u64(0x84c87814, 0xa1f0ab72), new u64(0x8cc70208, 0x1a6439ec),
  new u64(0x90befffa, 0x23631e28), new u64(0xa4506ceb, 0xde82bde9),
  new u64(0xbef9a3f7, 0xb2c67915), new u64(0xc67178f2, 0xe372532b),
  new u64(0xca273ece, 0xea26619c), new u64(0xd186b8c7, 0x21c0c207),
  new u64(0xeada7dd6, 0xcde0eb1e), new u64(0xf57d4f7f, 0xee6ed178),
  new u64(0x06f067aa, 0x72176fba), new u64(0x0a637dc5, 0xa2c898a6),
  new u64(0x113f9804, 0xbef90dae), new u64(0x1b710b35, 0x131c471b),
  new u64(0x28db77f5, 0x23047d84), new u64(0x32caab7b, 0x40c72493),
  new u64(0x3c9ebe0a, 0x15c9bebc), new u64(0x431d67c4, 0x9c100d4c),
  new u64(0x4cc5d4be, 0xcb3e42b6), new u64(0x597f299c, 0xfc657e2a),
  new u64(0x5fcb6fab, 0x3ad6faec), new u64(0x6c44198c, 0x4a475817)
];

function crypto_hashblocks(x: Uint8Array, m: Uint8Array, n: number): number {
  const z: U64[] = [];
  const b: U64[] = [];
  const a: U64[] = [];
  const w: U64[] = [];
  let t: U64;
  let i: number, j: number;

  for (i = 0; i < 8; i++) z[i] = a[i] = dl64(x, 8 * i);

  let pos = 0;
  while (n >= 128) {
    for (i = 0; i < 16; i++) w[i] = dl64(m, 8 * i + pos);
    for (i = 0; i < 80; i++) {
      for (j = 0; j < 8; j++) b[j] = a[j];
      t = add64(a[7], Sigma1(a[4]), Ch(a[4], a[5], a[6]), K[i], w[i % 16]);
      b[7] = add64(t, Sigma0(a[0]), Maj(a[0], a[1], a[2]));
      b[3] = add64(b[3], t);
      for (j = 0; j < 8; j++) a[(j + 1) % 8] = b[j];
      if (i % 16 === 15) {
        for (j = 0; j < 16; j++) {
          w[j] = add64(w[j], w[(j + 9) % 16], sigma0(w[(j + 1) % 16]), sigma1(w[(j + 14) % 16]));
        }
      }
    }

    for (i = 0; i < 8; i++) {
      a[i] = add64(a[i], z[i]);
      z[i] = a[i];
    }

    pos += 128;
    n -= 128;
  }

  for (i = 0; i < 8; i++) ts64(x, 8 * i, z[i]);
  return n;
}

const iv = new Uint8Array([
  0x6a, 0x09, 0xe6, 0x67, 0xf3, 0xbc, 0xc9, 0x08,
  0xbb, 0x67, 0xae, 0x85, 0x84, 0xca, 0xa7, 0x3b,
  0x3c, 0x6e, 0xf3, 0x72, 0xfe, 0x94, 0xf8, 0x2b,
  0xa5, 0x4f, 0xf5, 0x3a, 0x5f, 0x1d, 0x36, 0xf1,
  0x51, 0x0e, 0x52, 0x7f, 0xad, 0xe6, 0x82, 0xd1,
  0x9b, 0x05, 0x68, 0x8c, 0x2b, 0x3e, 0x6c, 0x1f,
  0x1f, 0x83, 0xd9, 0xab, 0xfb, 0x41, 0xbd, 0x6b,
  0x5b, 0xe0, 0xcd, 0x19, 0x13, 0x7e, 0x21, 0x79
]);

function crypto_hash(out: Uint8Array, m: Uint8Array, n: number): number {
  const h = new Uint8Array(64);
  const x = new Uint8Array(256);
  let i: number;
  const b = n;

  for (i = 0; i < 64; i++) h[i] = iv[i];

  crypto_hashblocks(h, m, n);
  n %= 128;

  for (i = 0; i < 256; i++) x[i] = 0;
  for (i = 0; i < n; i++) x[i] = m[b - n + i];
  x[n] = 128;

  n = 256 - 128 * (n < 112 ? 1 : 0);
  x[n - 9] = 0;
  ts64(x, n - 8, new u64((b / 0x20000000) | 0, b << 3));
  crypto_hashblocks(h, x, n);

  for (i = 0; i < 64; i++) out[i] = h[i];

  return 0;
}

function add(p: GF[], q: GF[]): void {
  const a = gf(), b = gf(), c = gf(),
    d = gf(), e = gf(), f = gf(),
    g = gf(), h = gf(), t = gf();

  Z(a, p[1], p[0]);
  Z(t, q[1], q[0]);
  M(a, a, t);
  A(b, p[0], p[1]);
  A(t, q[0], q[1]);
  M(b, b, t);
  M(c, p[3], q[3]);
  M(c, c, D2);
  M(d, p[2], q[2]);
  A(d, d, d);
  Z(e, b, a);
  Z(f, d, c);
  A(g, d, c);
  A(h, b, a);

  M(p[0], e, f);
  M(p[1], h, g);
  M(p[2], g, f);
  M(p[3], e, h);
}

function cswap(p: GF[], q: GF[], b: number): void {
  for (let i = 0; i < 4; i++) {
    sel25519(p[i], q[i], b);
  }
}

function pack(r: Uint8Array, p: GF[]): void {
  const tx = gf(), ty = gf(), zi = gf();
  inv25519(zi, p[2]);
  M(tx, p[0], zi);
  M(ty, p[1], zi);
  pack25519(r, ty);
  r[31] ^= par25519(tx) << 7;
}

function scalarmult(p: GF[], q: GF[], s: Uint8Array): void {
  let b: number;
  set25519(p[0], gf0);
  set25519(p[1], gf1);
  set25519(p[2], gf1);
  set25519(p[3], gf0);
  for (let i = 255; i >= 0; --i) {
    b = (s[(i / 8) | 0] >> (i & 7)) & 1;
    cswap(p, q, b);
    add(q, p);
    add(p, p);
    cswap(p, q, b);
  }
}

function scalarbase(p: GF[], s: Uint8Array): void {
  const q = [gf(), gf(), gf(), gf()];
  set25519(q[0], X);
  set25519(q[1], Y);
  set25519(q[2], gf1);
  M(q[3], X, Y);
  scalarmult(p, q, s);
}

function crypto_sign_keypair(pk: Uint8Array, sk: Uint8Array, seeded?: boolean): number {
  const d = new Uint8Array(64);
  const p = [gf(), gf(), gf(), gf()];

  if (!seeded) randombytes(sk, 32);
  crypto_hash(d, sk, 32);
  d[0] &= 248;
  d[31] &= 127;
  d[31] |= 64;

  scalarbase(p, d);
  pack(pk, p);

  for (let i = 0; i < 32; i++) sk[i + 32] = pk[i];
  return 0;
}

// Constants
const crypto_sign_PUBLICKEYBYTES = 32;
const crypto_sign_SECRETKEYBYTES = 64;
const crypto_sign_SEEDBYTES = 32;

// ========== SOLANA PUBLIC KEY DERIVATION API ==========

/**
 * Initialize the random number generator for the library.
 * This is required for generating random seeds.
 */
function initializeRandom(): void {
  // Initialize PRNG if environment provides CSPRNG.
  // @ts-expect-error - browser/node compatibility for global object access
  let crypto: any = typeof self !== 'undefined' ? (self as any).crypto || (self as any).msCrypto : null;
  
  if (crypto && crypto.getRandomValues) {
    // Browsers.
    const QUOTA = 65536;
    randombytes = (x: Uint8Array, n: number): void => {
      const v = new Uint8Array(n);
      for (let i = 0; i < n; i += QUOTA) {
        crypto.getRandomValues(v.subarray(i, i + Math.min(n - i, QUOTA)));
      }
      for (let i = 0; i < n; i++) x[i] = v[i];
    };
  } else if (typeof require !== 'undefined') {
    // Node.js.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      crypto = require('crypto');
      if (crypto && crypto.randomBytes) {
        randombytes = (x: Uint8Array, n: number): void => {
          const v = crypto.randomBytes(n);
          for (let i = 0; i < n; i++) x[i] = v[i];
        };
      }
    } catch {
      // Fallback if crypto module is not available
    }
  }
}

function checkArrayTypes(...args: any[]): void {
  for (let i = 0; i < args.length; i++) {
    if (!(args[i] instanceof Uint8Array)) {
      throw new TypeError('unexpected type, use Uint8Array');
    }
  }
}

/**
 * Derives an Ed25519 key pair from a 32-byte seed.
 * This is the standard way to generate deterministic Solana keys.
 * 
 * @param seed - 32-byte seed
 * @returns Object with publicKey and secretKey properties
 */
function derivePublicKeyFromSeed(seed: Uint8Array): KeyPair {
  checkArrayTypes(seed);
  if (seed.length !== crypto_sign_SEEDBYTES) {
    throw new Error('bad seed size');
  }

  const pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
  const sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);

  for (let i = 0; i < 32; i++) sk[i] = seed[i];
  crypto_sign_keypair(pk, sk, true);

  return { publicKey: pk, secretKey: sk };
}

/**
 * Extracts the public key from a 64-byte Ed25519 secret key.
 * In Ed25519, the secret key contains both the private and public key data.
 * 
 * @param secretKey - 64-byte secret key
 * @returns Object with publicKey and secretKey properties
 */
function derivePublicKeyFromSecretKey(secretKey: Uint8Array): KeyPair {
  checkArrayTypes(secretKey);
  if (secretKey.length !== crypto_sign_SECRETKEYBYTES) {
    throw new Error('bad secret key size');
  }

  const pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
  for (let i = 0; i < pk.length; i++) pk[i] = secretKey[32 + i];

  return { publicKey: pk, secretKey: new Uint8Array(secretKey) };
}

/**
 * Generates a random Ed25519 key pair.
 * 
 * @returns Object with publicKey and secretKey properties
 */
function generateRandomKeyPair(): KeyPair {
  const pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
  const sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);
  crypto_sign_keypair(pk, sk);
  return { publicKey: pk, secretKey: sk };
}

/**
 * Generates a random 32-byte seed that can be used with derivePublicKeyFromSeed.
 * 
 * @returns 32-byte random seed
 */
function generateRandomSeed(): Uint8Array {
  const seed = new Uint8Array(32);
  randombytes(seed, 32);
  return seed;
}

// Initialize the random number generator
initializeRandom();

// Create the API object
const solanaKeyDerivation: SolanaKeyDerivation = {
  derivePublicKeyFromSeed,
  derivePublicKeyFromSecretKey,
  generateRandomKeyPair,
  generateRandomSeed,
  
  // Constants
  PUBLIC_KEY_LENGTH: crypto_sign_PUBLICKEYBYTES,
  SECRET_KEY_LENGTH: crypto_sign_SECRETKEYBYTES,
  SEED_LENGTH: crypto_sign_SEEDBYTES
};

// Export for CommonJS and ES modules
export default solanaKeyDerivation;
export {
  derivePublicKeyFromSeed,
  derivePublicKeyFromSecretKey,
  generateRandomKeyPair,
  generateRandomSeed,
  KeyPair,
  SolanaKeyDerivation
};

// For CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = solanaKeyDerivation;
  module.exports.default = solanaKeyDerivation;
  module.exports.derivePublicKeyFromSeed = derivePublicKeyFromSeed;
  module.exports.derivePublicKeyFromSecretKey = derivePublicKeyFromSecretKey;
  module.exports.generateRandomKeyPair = generateRandomKeyPair;
  module.exports.generateRandomSeed = generateRandomSeed;
}
