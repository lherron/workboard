import { createReadStream, existsSync, statSync } from "fs";
import { extname } from "path";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import morgan from "morgan";

// MIME types for common image formats
const IMAGE_MIME_TYPES = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".bmp": "image/bmp",
	".ico": "image/x-icon",
};

export function createServer({ cpUrl }) {
	const app = express();
	const clients = new Set();

	app.use(morgan("dev"));
	// Only parse JSON for webhook endpoints so proxied requests keep their body.
	app.use("/api/webhooks", express.json({ limit: "1mb" }));

	app.get("/api/health", (_req, res) => {
		res.json({ ok: true });
	});

	// Serve files from filesystem (for displaying images from Read tool results)
	app.get("/api/files", (req, res) => {
		const filePath = req.query.path;
		if (typeof filePath !== "string" || !filePath) {
			res.status(400).json({ error: "Missing path parameter" });
			return;
		}

		// Security: only allow absolute paths and check file exists
		if (!filePath.startsWith("/")) {
			res.status(400).json({ error: "Path must be absolute" });
			return;
		}

		if (!existsSync(filePath)) {
			res.status(404).json({ error: "File not found" });
			return;
		}

		const ext = extname(filePath).toLowerCase();
		const mimeType = IMAGE_MIME_TYPES[ext];

		if (!mimeType) {
			res.status(400).json({ error: "Unsupported file type" });
			return;
		}

		try {
			const stat = statSync(filePath);
			res.setHeader("Content-Type", mimeType);
			res.setHeader("Content-Length", stat.size);
			res.setHeader("Cache-Control", "public, max-age=3600");
			createReadStream(filePath).pipe(res);
		} catch (_err) {
			res.status(500).json({ error: "Failed to read file" });
		}
	});

	app.post("/api/webhooks/wrkq", (req, res) => {
		const payload = req.body ?? {};
		const ticketId = payload.ticket_id;
		const projectId = payload.project_id;
		if (typeof ticketId !== "string" || typeof projectId !== "string") {
			res.status(400).json({ message: "Invalid webhook payload" });
			return;
		}
		console.log("wrkq webhook payload:", payload);

		const data = `data: ${JSON.stringify(payload)}\n\n`;
		for (const client of clients) {
			client.write(data);
		}

		res.status(204).end();
	});

	app.get("/api/webhooks/stream", (req, res) => {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		});
		res.write("retry: 3000\n\n");

		clients.add(res);

		req.on("close", () => {
			clients.delete(res);
		});
	});

	const keepAlive = setInterval(() => {
		for (const client of clients) {
			client.write(": ping\n\n");
		}
	}, 30000);
	keepAlive.unref();

	app.use(
		"/admin",
		createProxyMiddleware({
			target: cpUrl,
			changeOrigin: true,
		}),
	);

	app.use(
		"/api/terminal",
		createProxyMiddleware({
			target: cpUrl,
			changeOrigin: true,
		}),
	);

	return app;
}

export function startServer({ port, cpUrl }) {
	const app = createServer({ cpUrl });

	return new Promise((resolve, reject) => {
		const server = app.listen(port, () => {
			console.log(`webwrkq api listening on http://localhost:${port}`);
			console.log(`proxy target: ${cpUrl}`);
			resolve({ app, server, port });
		});

		server.on("error", reject);
	});
}
