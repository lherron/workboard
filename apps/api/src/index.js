import { startServer } from "./server.js";

const cpUrl = process.env.CP_URL || "http://localhost:7420";
const port = Number(process.env.EXPRESS_PORT || process.env.API_PORT || 5151);

startServer({ port, cpUrl }).catch((err) => {
	console.error("Failed to start webwrkq api:", err);
	process.exit(1);
});
