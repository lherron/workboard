import path from "path";
import dotenv from "dotenv";
import { startServer } from "./server.js";

const repoRoot = path.resolve(import.meta.dir, "../../..");

dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const cpUrl = process.env.CP_URL || "http://localhost:7420";
const port = Number(process.env.EXPRESS_PORT || process.env.API_PORT || 5151);
const allowFallback = !process.env.EXPRESS_PORT && !process.env.API_PORT;

startServer({ port, cpUrl, allowFallback }).catch((err) => {
	console.error("Failed to start webwrkq api:", err);
	process.exit(1);
});
