/*
 * A tiny static server for the screen tests: serves the site from the
 * repository root the way Azure Static Web Apps does, following
 * staticwebapp.config.json (global headers including the Content Security
 * Policy, redirects, routes that answer 404, the 404 page and MIME types).
 *
 *   node tests/e2e/server.mjs [port]
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "staticwebapp.config.json"), "utf8"));
const PORT = Number(process.argv[2] || process.env.PORT || 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
  ".ttf": "font/ttf", ".mp4": "video/mp4", ".webm": "video/webm", ".vtt": "text/vtt", ".pdf": "application/pdf",
  ".webmanifest": "application/manifest+json", ...Object.fromEntries(Object.entries(CONFIG.mimeTypes || {}))
};

/** A route of the config matches a path exactly, or by its trailing "/*". */
function matches(route, p) {
  if (route.endsWith("/*")) return p.startsWith(route.slice(0, -1));
  return route === p;
}

function routeFor(p) {
  return (CONFIG.routes || []).find((r) => matches(r.route, p));
}

/** The file for a path: directories serve their index.html. */
function fileFor(p) {
  let f = path.join(ROOT, decodeURIComponent(p));
  if (!f.startsWith(ROOT)) return null;
  try {
    if (fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    return fs.statSync(f).isFile() ? f : null;
  } catch {
    return null;
  }
}

function send(res, status, file, headers, range) {
  const body = fs.readFileSync(file);
  const type = { ...CONFIG.globalHeaders, ...headers, "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Accept-Ranges": "bytes" };
  // Byte ranges, as Azure Static Web Apps answers them: a video can then be sought.
  const m = status === 200 && range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (m) {
    const start = m[1] === "" ? Math.max(0, body.length - Number(m[2])) : Number(m[1]);
    const end = m[1] !== "" && m[2] !== "" ? Math.min(Number(m[2]), body.length - 1) : body.length - 1;
    if (start > end || start >= body.length) {
      res.writeHead(416, { ...type, "Content-Range": `bytes */${body.length}` });
      res.end();
      return;
    }
    res.writeHead(206, { ...type, "Content-Range": `bytes ${start}-${end}/${body.length}`, "Content-Length": end - start + 1 });
    res.end(body.subarray(start, end + 1));
    return;
  }
  res.writeHead(status, type);
  res.end(body);
}

function notFound(res) {
  const page = path.join(ROOT, (CONFIG.responseOverrides?.["404"]?.rewrite) || "/404.html");
  send(res, 404, page, {});
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  const route = routeFor(p);
  if (route?.redirect) {
    res.writeHead(route.statusCode || 302, { ...CONFIG.globalHeaders, Location: route.redirect });
    res.end();
    return;
  }
  if (route?.statusCode === 404) return notFound(res);
  if (route?.rewrite) {
    const f = fileFor(route.rewrite);
    return f ? send(res, 200, f, route.headers || {}, req.headers.range) : notFound(res);
  }
  // A directory without its trailing slash, as Azure: /de -> /de/
  const raw = path.join(ROOT, decodeURIComponent(p));
  if (!p.endsWith("/") && raw.startsWith(ROOT) && fs.existsSync(raw) && fs.statSync(raw).isDirectory()) {
    res.writeHead(301, { Location: p + "/" + url.search });
    res.end();
    return;
  }
  const f = fileFor(p);
  if (!f || path.basename(f).startsWith(".") && !p.startsWith("/.well-known/")) return notFound(res);
  send(res, 200, f, route?.headers || {}, req.headers.range);
});

server.listen(PORT, "127.0.0.1", () => console.log(`E1 website on http://127.0.0.1:${PORT}`));
