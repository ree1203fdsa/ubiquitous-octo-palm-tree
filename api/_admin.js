const crypto = require("crypto");

const FIREBASE_DB_URL =
  "https://gaim-vlem-default-rtdb.asia-southeast1.firebasedatabase.app";

// Used only when ADMIN_PASSWORD is not set; the repo is public, so only a salted scrypt hash is stored.
const FALLBACK_SALT = "8225ac8d7ca40556e26aab120bffff3c";
const FALLBACK_HASH = Buffer.from(
  "b7be28d2938a7955b9e661b14a54db5cb9bb4dec5d2df168b2534840043854fb",
  "hex"
);

function passwordMatches(given) {
  const envPw = (process.env.ADMIN_PASSWORD || "").trim();
  if (envPw) {
    const a = Buffer.from(given), b = Buffer.from(envPw);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  if (!given) return false;
  const h = crypto.scryptSync(given, FALLBACK_SALT, 32, {
    N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024,
  });
  return crypto.timingSafeEqual(h, FALLBACK_HASH);
}

function requireAdmin(req, res) {
  let raw = String(req.headers["x-admin-password"] || "");
  try { raw = decodeURIComponent(raw); } catch {}
  if (!passwordMatches(raw.trim())) {
    res.status(401).json({ error: "관리자 비밀번호가 틀렸습니다." });
    return false;
  }
  return true;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");
}

async function fbGet(path) {
  const r = await fetch(`${FIREBASE_DB_URL}/${path}.json`);
  if (!r.ok) throw new Error("Firebase read failed");
  return r.json();
}

async function fbPush(path, data) {
  const r = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Firebase write failed");
  return (await r.json()).name;
}

async function fbDelete(path) {
  const r = await fetch(`${FIREBASE_DB_URL}/${path}.json`, { method: "DELETE" });
  if (!r.ok) throw new Error("Firebase delete failed");
}

function toList(data) {
  if (!data) return [];
  return Object.entries(data)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { requireAdmin, cors, fbGet, fbPush, fbDelete, toList };
