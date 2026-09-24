import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

  // Reverse proxy API requests to FastAPI backend
  app.use("/api", async (req, res) => {
    try {
      const targetUrl = `${BACKEND_URL}${req.originalUrl}`;
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value && key.toLowerCase() !== "host") {
          headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (req.method !== "GET" && req.method !== "HEAD") {
        const bodyChunks: Buffer[] = [];
        req.on("data", (chunk) => bodyChunks.push(chunk));
        await new Promise((resolve) => req.on("end", resolve));
        if (bodyChunks.length > 0) {
          fetchOptions.body = Buffer.concat(bodyChunks);
        }
      }

      const backendRes = await fetch(targetUrl, fetchOptions);
      res.status(backendRes.status);
      backendRes.headers.forEach((val, key) => {
        if (key.toLowerCase() !== "content-encoding") {
          res.setHeader(key, val);
        }
      });
      const arrayBuffer = await backendRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error(`API Proxy Error [${req.method} ${req.originalUrl}]:`, err.message);
      res.status(502).json({ error: "Backend service unreachable", details: err.message });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Forwarding /api requests to ${BACKEND_URL}`);
  });
}

startServer().catch(console.error);

