const FIREBASE_DB_URL =
  "https://gaim-vlem-default-rtdb.asia-southeast1.firebasedatabase.app";

async function fbGet(path) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`);
  if (!res.ok) throw new Error("Firebase read failed");
  return res.json();
}

async function getSession(req) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return null;
  return fbGet(`sessions/${token}`);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    try {
      const data = await fbGet("games");
      if (!data) return res.status(200).json([]);
      const list = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json(list);
    } catch {
      return res.status(500).json({ error: "게임 목록 조회 실패" });
    }
  }

  if (req.method === "POST") {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: "로그인이 필요합니다." });
    if (session.role !== "admin")
      return res.status(403).json({ error: "관리자만 게임을 등록할 수 있습니다." });

    const { name, description, imageUrl } = req.body || {};
    if (!name) return res.status(400).json({ error: "게임 이름을 입력하세요." });

    const game = {
      name,
      description: description || "",
      imageUrl: imageUrl || "",
      createdBy: session.email,
      createdAt: new Date().toISOString(),
    };

    const fbRes = await fetch(`${FIREBASE_DB_URL}/games.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(game),
    });
    if (!fbRes.ok) throw new Error("Firebase write failed");
    const { name: id } = await fbRes.json();

    return res.status(200).json({ id, ...game });
  }

  if (req.method === "DELETE") {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: "로그인이 필요합니다." });
    if (session.role !== "admin")
      return res.status(403).json({ error: "관리자만 삭제할 수 있습니다." });

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "게임 ID가 필요합니다." });

    await fetch(`${FIREBASE_DB_URL}/games/${id}.json`, { method: "DELETE" });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
