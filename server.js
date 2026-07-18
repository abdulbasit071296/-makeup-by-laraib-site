/* Minimal static file + admin API server, built-in Node modules only
   (no npm dependencies). Serves the site, and gives the admin panel
   somewhere to log in and persist edits to content.json / images/. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const CONTENT_PATH = path.join(ROOT, "content.json");
const CONFIG_PATH = path.join(ROOT, "admin-config.json");
const IMAGES_DIR = path.join(ROOT, "images");
const PORT = process.env.PORT || 4000;

const SESSIONS = new Map(); // token -> expiry timestamp
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
};

function loadConfig() {
  if (process.env.ADMIN_PASSWORD) {
    const salt = crypto.randomBytes(16).toString("hex");
    console.log("Using admin password from the ADMIN_PASSWORD environment variable.");
    return { salt, passwordHash: hashPassword(process.env.ADMIN_PASSWORD, salt) };
  }
  if (!fs.existsSync(CONFIG_PATH)) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword("laraib123", salt);
    const cfg = { salt, passwordHash: hash };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    console.log('No admin-config.json found — created one with the default password "laraib123". Change it with: node set-admin-password.js <newpassword>');
    return cfg;
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 25 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function getCookie(req, name) {
  const header = req.headers.cookie || "";
  const match = header.split(";").map((s) => s.trim()).find((c) => c.startsWith(name + "="));
  return match ? match.slice(name.length + 1) : null;
}

function isAuthed(req) {
  const token = getCookie(req, "admin_session");
  if (!token || !SESSIONS.has(token)) return false;
  if (SESSIONS.get(token) < Date.now()) {
    SESSIONS.delete(token);
    return false;
  }
  return true;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function serveStatic(req, res, urlPath) {
  let filePath = urlPath === "/" ? "/index.html" : urlPath;
  filePath = decodeURIComponent(filePath.split("?")[0]);
  const resolved = path.normalize(path.join(ROOT, filePath));
  if (!resolved.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const config = loadConfig();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  try {
    if (url.pathname === "/api/login" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const password = body.password || "";
      const hash = hashPassword(password, config.salt);
      if (hash === config.passwordHash) {
        const token = crypto.randomBytes(32).toString("hex");
        SESSIONS.set(token, Date.now() + SESSION_TTL_MS);
        res.setHeader(
          "Set-Cookie",
          `admin_session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Strict`
        );
        sendJson(res, 200, { ok: true });
      } else {
        sendJson(res, 401, { ok: false, error: "Incorrect password" });
      }
      return;
    }

    if (url.pathname === "/api/logout" && req.method === "POST") {
      const token = getCookie(req, "admin_session");
      if (token) SESSIONS.delete(token);
      res.setHeader("Set-Cookie", "admin_session=; HttpOnly; Path=/; Max-Age=0");
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/session" && req.method === "GET") {
      sendJson(res, 200, { authed: isAuthed(req) });
      return;
    }

    if (url.pathname === "/api/content" && req.method === "GET") {
      const data = fs.readFileSync(CONTENT_PATH, "utf8");
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(data);
      return;
    }

    if (url.pathname === "/api/content" && req.method === "POST") {
      if (!isAuthed(req)) return sendJson(res, 401, { ok: false, error: "Not logged in" });
      const body = (await readBody(req)).toString("utf8");
      const parsed = JSON.parse(body); // throws if invalid JSON, caught below
      fs.writeFileSync(CONTENT_PATH, JSON.stringify(parsed, null, 2));
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/upload" && req.method === "POST") {
      if (!isAuthed(req)) return sendJson(res, 401, { ok: false, error: "Not logged in" });
      const body = JSON.parse((await readBody(req)).toString("utf8"));
      const { filename, dataBase64 } = body;
      if (!filename || !dataBase64) return sendJson(res, 400, { ok: false, error: "Missing filename or data" });
      const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      const unique = Date.now() + "-" + safeName;
      const destPath = path.join(IMAGES_DIR, unique);
      const base64Data = dataBase64.split(",").pop();
      fs.writeFileSync(destPath, Buffer.from(base64Data, "base64"));
      sendJson(res, 200, { ok: true, path: "images/" + unique });
      return;
    }

    if (url.pathname === "/admin-panel.html" && !isAuthed(req)) {
      res.writeHead(302, { Location: "/admin.html" });
      res.end();
      return;
    }

    serveStatic(req, res, url.pathname);
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Makeup by Laraib site + admin server running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
});
