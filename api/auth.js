const crypto = require("crypto");

const FIREBASE_DB_URL =
  "https://gaim-vlem-default-rtdb.asia-southeast1.firebasedatabase.app";

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function fbGet(path) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`);
  if (!res.ok) throw new Error("Firebase read failed");
  return res.json();
}

async function fbSet(path, data) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Firebase write failed");
  return res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { action, username, password, nickname } = req.body || {};

  if (action === "register") {
    if (!username || !password || !nickname)
      return res.status(400).json({ error: "아이디, 비밀번호, 닉네임을 모두 입력하세요." });
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
      return res.status(400).json({ error: "아이디는 영문, 숫자, _만 가능하며 3~20자여야 합니다." });
    if (password.length < 4)
      return res.status(400).json({ error: "비밀번호는 4자 이상이어야 합니다." });

    const existing = await fbGet(`users/${username}`);
    if (existing)
      return res.status(409).json({ error: "이미 사용 중인 아이디입니다." });

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(password, salt);
    const token = generateToken();

    const allUsers = await fbGet("users");
    const isFirstUser = !allUsers || Object.keys(allUsers).length === 0;

    const user = {
      username,
      nickname,
      salt,
      hash,
      role: isFirstUser ? "admin" : "user",
      createdAt: new Date().toISOString(),
    };

    await fbSet(`users/${username}`, user);
    await fbSet(`sessions/${token}`, {
      username,
      role: user.role,
      nickname,
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({
      token,
      username,
      nickname,
      role: user.role,
    });
  }

  if (action === "login") {
    if (!username || !password)
      return res.status(400).json({ error: "아이디와 비밀번호를 입력하세요." });

    const user = await fbGet(`users/${username}`);
    if (!user)
      return res.status(401).json({ error: "아이디 또는 비밀번호가 틀렸습니다." });

    const hash = hashPassword(password, user.salt);
    if (hash !== user.hash)
      return res.status(401).json({ error: "아이디 또는 비밀번호가 틀렸습니다." });

    const token = generateToken();
    await fbSet(`sessions/${token}`, {
      username,
      role: user.role,
      nickname: user.nickname,
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({
      token,
      username,
      nickname: user.nickname,
      role: user.role,
    });
  }

  if (action === "me") {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "로그인이 필요합니다." });

    const session = await fbGet(`sessions/${token}`);
    if (!session) return res.status(401).json({ error: "세션이 만료되었습니다." });

    return res.status(200).json({
      username: session.username,
      nickname: session.nickname,
      role: session.role,
    });
  }

  if (action === "logout") {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (token) {
      await fetch(`${FIREBASE_DB_URL}/sessions/${token}.json`, {
        method: "DELETE",
      });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "올바르지 않은 action입니다." });
};
