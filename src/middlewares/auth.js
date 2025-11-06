const cfg = require("../config");

module.exports = function auth(req, res, next) {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
        console.log("AUTH FAIL: missing bearer, got:", auth);
        return res.status(401).json({ ok: false, error: "missing_bearer" });
    }
    const token = auth.slice(7);
    if (token !== cfg.token) {
        console.log("AUTH FAIL: bad token. got:", token, " expected:", cfg.token);
        return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    next();
};
