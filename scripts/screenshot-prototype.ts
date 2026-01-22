import path from "path";
import { chromium } from "playwright";

const SCREENSHOTS_DIR = path.join(import.meta.dir, "..", "prototype-screenshots");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
	viewport: { width: 1920, height: 1080 },
});
const page = await context.newPage();

// Navigate to inbox hub
console.log("Navigating to inbox hub...");
await page.goto("http://localhost:5150/?view=inbox-hub");
await page.waitForTimeout(3000);

// Screenshot 1: Main kanban view
console.log("Taking screenshot of main view...");
await page.screenshot({ path: `${SCREENSHOTS_DIR}/inbox-hub-main.png`, fullPage: false });

// Find and click "Add task" button in first column
console.log("Opening quick-add card...");
const addTaskBtn = page.locator('button:has-text("Add task")').first();
if (await addTaskBtn.isVisible()) {
	await addTaskBtn.click();
	await page.waitForTimeout(500);

	// Screenshot 2: Quick add card
	console.log("Taking screenshot of quick-add card...");
	await page.screenshot({ path: `${SCREENSHOTS_DIR}/inbox-hub-quick-add.png`, fullPage: false });

	// Close the quick add by pressing Escape
	await page.keyboard.press("Escape");
	await page.waitForTimeout(300);
} else {
	console.log("No Add task button found");
}

// Click on a task card to open the modal
console.log("Looking for task cards...");
const taskCard = page.locator("div.group.relative.px-3.py-3.rounded-lg.cursor-pointer").first();
if (await taskCard.isVisible({ timeout: 2000 }).catch(() => false)) {
	console.log("Found task card, clicking...");
	await taskCard.click();
	await page.waitForTimeout(1000);

	// Screenshot 3: Task detail modal
	console.log("Taking screenshot of task detail modal...");
	await page.screenshot({ path: `${SCREENSHOTS_DIR}/inbox-hub-task-modal.png`, fullPage: false });
} else {
	console.log("No task cards found (inbox may be empty)");
}

await browser.close();
console.log("Done! Screenshots saved to", SCREENSHOTS_DIR);
