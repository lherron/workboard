import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import morgan from "morgan";

export function createServer({ cpUrl }) {
	const app = express();
	const clients = new Set();

	app.use(morgan("dev"));
	// Only parse JSON for webhook endpoints so proxied requests keep their body.
	app.use("/api/webhooks", express.json({ limit: "1mb" }));

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

export function startServer({ port, cpUrl, allowFallback }) {
	const app = createServer({ cpUrl });

	return new Promise((resolve, reject) => {
		const server = app.listen(port, () => {
			console.log(`webwrkq api listening on http://localhost:${port}`);
			console.log(`proxy target: ${cpUrl}`);
			resolve({ app, server, port });
		});

		server.on("error", (err) => {
			if (allowFallback && err.code === "EADDRINUSE") {
				const nextPort = port + 1;
				console.warn(`port ${port} in use, retrying on ${nextPort}`);
				startServer({ port: nextPort, cpUrl, allowFallback: false }).then(resolve).catch(reject);
				return;
			}
			reject(err);
		});
	});
}
