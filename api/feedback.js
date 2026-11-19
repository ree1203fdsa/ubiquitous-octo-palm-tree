const { isAdmin, cors, fbGet, fbPush, fbDelete, toList } = require("./_admin");

const KEYS = ["gameplay", "graphics", "sound", "story", "uiux", "replayability"];

function clamp(v) {
  const n = Number(v);
  if (isNaN(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "POST") {
      const b = req.body || {};
      const name = String(b.name || "").trim().slice(0, 30);
      const comment = String(b.comment || "").trim().slice(0, 2000);
      const gameId = String(b.gameId || "");
      if (!name) return res.status(400).json({ error: "이름을 입력하세요." });
      if (!comment) return res.status(400).json({ error: "피드백 내용을 작성하세요." });
      if (!/^[\w-]+$/.test(gameId)) return res.status(400).json({ error: "게임을 선택하세요." });

      const game = await fbGet(`games/${gameId}`);
      if (!game) return res.status(404).json({ error: "존재하지 않는 게임입니다." });

      const scores = {};
      for (const k of KEYS) scores[k] = clamp(b[k]);
      const overall = Math.round(KEYS.reduce((s, k) => s + scores[k], 0) / KEYS.length);

      const feedback = {
        gameId,
        name,
        scores,
        overall,
        comment,
        createdAt: new Date().toISOString(),
      };
      const id = await fbPush("feedbacks", feedback);
      return res.status(200).json({ id, ...feedback });
    }

    if (!isAdmin(req))
      return res.status(401).json({ error: "관리자 비밀번호가 틀렸습니다." });

    if (req.method === "GET") {
      return res.status(200).json(toList(await fbGet("feedbacks")));
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || "");
      if (!/^[\w-]+$/.test(id)) return res.status(400).json({ error: "잘못된 ID입니다." });
      await fbDelete(`feedbacks/${id}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
};
