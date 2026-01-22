import { chromium } from "playwright";

async function main() {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 1400, height: 900 },
	});
	const page = await context.newPage();

	// Log console messages for debugging
	page.on("console", (msg) => {
		if (msg.type() === "error") console.log("Browser error:", msg.text());
	});

	console.log("1. Navigating to project roster page...");
	await page.goto("http://127.0.0.1:18450/projects/wrkq/roster");
	await page.waitForSelector("text=PROJECT ROSTER", { timeout: 10000 });
	console.log("   Page loaded");

	// Wait for oracle member
	console.log("2. Waiting for oracle member...");
	await page.waitForSelector("text=ORACLE", { timeout: 10000 });

	// Click oracle card
	const oracleCard = page.locator("button:has-text('ORACLE')").first();
	await oracleCard.click();
	await page.waitForTimeout(500);
	console.log("   Oracle selected");

	// Find and fill the textarea
	console.log("3. Typing message...");
	const textarea = page.locator("textarea");
	await textarea.waitFor({ timeout: 5000 });
	await textarea.fill("What is 2+2? Reply with just the number.");
	console.log("   Message typed");

	// Click send button (the button with Send icon at the end)
	console.log("4. Sending message...");
	const sendButton = page.locator("button").last();
	await sendButton.click();
	console.log("   Send clicked");

	// Wait for run to appear
	console.log("5. Waiting for response...");

	// Wait for "RUN" text to appear indicating a run started
	try {
		await page.waitForSelector("text=RUN", { timeout: 10000 });
		console.log("   Run started");
	} catch {
		console.log("   No RUN indicator found, continuing...");
	}

	// Wait for completion - look for COMPLETED or RESPONSE text
	let completed = false;
	for (let i = 0; i < 60; i++) {
		const content = await page.content();
		if (content.includes("COMPLETED") || content.includes("RESPONSE")) {
			completed = true;
			console.log("   Response received!");
			break;
		}
		if (content.includes("FAILED")) {
			console.log("   Run FAILED, checking why...");
			break;
		}
		await page.waitForTimeout(1000);
		if (i % 10 === 0) console.log(`   Waiting... ${i}s`);
	}

	if (!completed) {
		console.log("   Timeout waiting for completion");
	}

	// Take final screenshot
	console.log("6. Taking screenshot...");
	await page.screenshot({ path: "screenshot-project-roster.png" });
	console.log("   Screenshot saved");

	await browser.close();
	console.log("Done!");
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
