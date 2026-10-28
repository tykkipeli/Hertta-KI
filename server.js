import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve(".");
const server = http
  .createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = resolve(root, "." + (path === "/" ? "/index.html" : path));
      if (
        !file.startsWith(root + "/") ||
        ![".html", ".css", ".js"].includes(extname(file)) ||
        file.includes("/.git/")
      ) {
        res.writeHead(404);
        res.end();
        return;
      }
      const data = await readFile(file);
      res.setHeader(
        "Content-Type",
        { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[
          extname(file)
        ] + "; charset=utf-8",
      );
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(
    process.env.PORT === undefined ? 3000 : Number(process.env.PORT),
    "0.0.0.0",
    () => console.log("Hertta läuft auf Port " + server.address().port),
  );
