import path from "path";
import dotenv from "dotenv";
import { startServer } from "./server.js";

const repoRoot = path.resolve(import.meta.dir, "../../..");

dotenv.config({ path: path.join(repoRoot, ".env.local"), override: true });
dotenv.config({ path: path.join(repoRoot, ".env"), override: true });

const PORT = 18461;

const cpUrl = process.env.CP_URL || "http://localhost:7420";

startServer({ port: PORT, cpUrl }).catch((err) => {
	if (err && err.code === "EADDRINUSE") {
		console.error(`workboard api: port ${PORT} is already in use; refusing to start`);
	} else {
		console.error("Failed to start workboard api:", err);
	}
	process.exit(1);
});
