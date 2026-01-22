import { chromium } from "playwright";

async function main() {
	const browser = await chromium.launch({ headless: false }); // headless: false to watch
	const context = await browser.newContext({
		viewport: { width: 1400, height: 900 },
	});
	const page = await context.newPage();

	// Log console messages for debugging
	page.on("console", (msg) => {
		console.log(`[Browser ${msg.type()}]:`, msg.text());
	});

	console.log("1. Navigating to project roster page...");
	await page.goto("http://127.0.0.1:18450/projects/wrkq/roster");
	await page.waitForSelector("text=PROJECT ROSTER", { timeout: 10000 });
	console.log("   Page loaded");

	// Wait for coordinator member
	console.log("2. Clicking on coordinator...");
	await page.waitForSelector("text=COORDINATOR", { timeout: 10000 });
	const coordinatorCard = page.locator("button:has-text('COORDINATOR')").first();
	await coordinatorCard.click();
	await page.waitForTimeout(500);
	console.log("   Coordinator selected");

	// Take screenshot of current state
	await page.screenshot({ path: "screenshot-1-coordinator-selected.png" });
	console.log("   Screenshot 1 saved");

	// Check if we're viewing historical or no session
	const pageContent = await page.content();
	console.log("   Page shows historical?", pageContent.includes("Viewing historical"));
	console.log("   Page shows no active?", pageContent.includes("No active session"));

	// Click New Chat button (MessageSquarePlus icon)
	console.log("3. Clicking New Chat button...");
	// The new chat button has title="New chat"
	const newChatButton = page.locator('button[title="New chat"]');
	await newChatButton.click();
	await page.waitForTimeout(500);

	await page.screenshot({ path: "screenshot-2-after-new-chat.png" });
	console.log("   Screenshot 2 saved");

	// Check state after new chat
	const afterNewChat = await page.content();
	console.log("   After New Chat - shows no active?", afterNewChat.includes("No active session"));

	// Find the textarea - should be visible now
	console.log("4. Looking for input...");
	const textarea = page.locator("textarea");
	const textareaVisible = await textarea.isVisible();
	console.log("   Textarea visible?", textareaVisible);

	if (!textareaVisible) {
		console.log("   ERROR: Textarea not visible after clicking New Chat!");
		await page.screenshot({ path: "screenshot-error-no-textarea.png" });
		await browser.close();
		return;
	}

	// Type a message
	console.log("5. Typing message...");
	await textarea.fill("What is 3+3?");
	console.log("   Message typed");

	await page.screenshot({ path: "screenshot-3-message-typed.png" });

	// Click send button
	console.log("6. Clicking send...");
	const sendButton = page.locator('button:has(svg[class*="lucide-send"])');
	if ((await sendButton.count()) === 0) {
		// Fallback - find the button after the textarea
		const buttons = page.locator("button");
		const count = await buttons.count();
		console.log("   Found", count, "buttons");
		// Click the last button in the input area
		await page.locator("button").last().click();
	} else {
		await sendButton.click();
	}
	console.log("   Send clicked");

	await page.waitForTimeout(1000);
	await page.screenshot({ path: "screenshot-4-after-send.png" });

	// Check what happened
	const afterSend = await page.content();
	console.log("   After Send - shows RUN?", afterSend.includes("RUN"));
	console.log("   After Send - shows historical?", afterSend.includes("Viewing historical"));
	console.log("   After Send - shows no active?", afterSend.includes("No active session"));
	console.log("   After Send - shows RUNNING?", afterSend.includes("RUNNING"));

	// Wait for response
	console.log("7. Waiting for response...");
	for (let i = 0; i < 30; i++) {
		const content = await page.content();
		if (content.includes("COMPLETED")) {
			console.log("   Run completed!");
			break;
		}
		if (content.includes("FAILED")) {
			console.log("   Run failed!");
			break;
		}
		await page.waitForTimeout(1000);
		if (i % 5 === 0) console.log(`   Waiting... ${i}s`);
	}

	await page.screenshot({ path: "screenshot-5-final.png" });
	console.log("   Final screenshot saved");

	await browser.close();
	console.log("Done!");
}

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
