const { isAdmin, cors, fbGet, fbPush, fbDelete, toList } = require("./_admin");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      return res.status(200).json(toList(await fbGet("games")));
    }

    if (!isAdmin(req))
      return res.status(401).json({ error: "관리자 비밀번호가 틀렸습니다." });

    if (req.method === "POST") {
      const name = String(req.body?.name || "").trim();
      const description = String(req.body?.description || "").trim();
      if (!name) return res.status(400).json({ error: "게임 이름을 입력하세요." });
      const game = { name, description, createdAt: new Date().toISOString() };
      const id = await fbPush("games", game);
      return res.status(200).json({ id, ...game });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || "");
      if (!/^[\w-]+$/.test(id)) return res.status(400).json({ error: "잘못된 ID입니다." });
      await fbDelete(`games/${id}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
};
