module.exports = function handler(req, res) {
  const pw = process.env.ADMIN_PASSWORD;
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    adminPasswordSet: Boolean(pw && pw.trim()),
    adminPasswordLength: pw ? pw.trim().length : 0,
    similarVariableNames: Object.keys(process.env).filter(k => /admin|pass/i.test(k)),
    vercelEnv: process.env.VERCEL_ENV || null,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
  });
};
