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
      const gameId = req.query.gameId;
      let data;
      if (gameId) {
        data = await fbGet("feedbacks");
        if (data) {
          const filtered = {};
          for (const [k, v] of Object.entries(data)) {
            if (v.gameId === gameId) filtered[k] = v;
          }
          data = filtered;
        }
      } else {
        data = await fbGet("feedbacks");
      }

      if (!data) return res.status(200).json([]);
      const list = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json(list);
    } catch {
      return res.status(500).json({ error: "피드백 조회 실패" });
    }
  }

  if (req.method === "POST") {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: "로그인이 필요합니다." });

    const { gameId, gameplay, graphics, sound, story, uiux, replayability, comment } =
      req.body || {};

    if (!gameId) return res.status(400).json({ error: "게임을 선택하세요." });
    if (!comment) return res.status(400).json({ error: "피드백 내용을 작성하세요." });

    const scores = {
      gameplay: clamp(gameplay || 50),
      graphics: clamp(graphics || 50),
      sound: clamp(sound || 50),
      story: clamp(story || 50),
      uiux: clamp(uiux || 50),
      replayability: clamp(replayability || 50),
    };
    const overall = Math.round(
      Object.values(scores).reduce((s, v) => s + v, 0) / 6
    );

    const feedback = {
      gameId,
      scores,
      overall,
      comment,
      author: session.nickname,
      authorEmail: session.email,
      createdAt: new Date().toISOString(),
    };

    const fbRes = await fetch(`${FIREBASE_DB_URL}/feedbacks.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feedback),
    });
    if (!fbRes.ok) throw new Error("Firebase write failed");
    const { name: id } = await fbRes.json();

    return res.status(200).json({ id, ...feedback });
  }

  if (req.method === "DELETE") {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: "로그인이 필요합니다." });
    if (session.role !== "admin")
      return res.status(403).json({ error: "관리자만 삭제할 수 있습니다." });

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "피드백 ID가 필요합니다." });

    await fetch(`${FIREBASE_DB_URL}/feedbacks/${id}.json`, { method: "DELETE" });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};

function clamp(v) {
  const n = Number(v);
  if (isNaN(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}
