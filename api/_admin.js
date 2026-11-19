const crypto = require("crypto");

const FIREBASE_DB_URL =
  "https://gaim-vlem-default-rtdb.asia-southeast1.firebasedatabase.app";

function requireAdmin(req, res) {
  const expected = Buffer.from((process.env.ADMIN_PASSWORD || "").trim());
  if (!expected.length) {
    res.status(500).json({
      error: "서버에 관리자 비밀번호(ADMIN_PASSWORD)가 설정되지 않았습니다. Vercel 환경변수를 넣고 다시 배포하세요.",
    });
    return false;
  }
  let raw = String(req.headers["x-admin-password"] || "");
  try { raw = decodeURIComponent(raw); } catch {}
  const given = Buffer.from(raw.trim());
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
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
