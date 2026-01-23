import { chromium } from "playwright";

(async () => {
	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport: { width: 1920, height: 1080 },
	});
	const page = await context.newPage();

	try {
		// Navigate to the workboard project's work-items page
		console.log("Navigating to work-items page...");
		await page.goto("http://127.0.0.1:18460/projects/workboard/work-items", {
			waitUntil: "networkidle",
			timeout: 10000,
		});

		// Wait a bit for any animations
		await page.waitForTimeout(1000);

		// Take screenshot
		await page.screenshot({
			path: "screenshots/work-items-workboard.png",
			fullPage: false,
		});
		console.log("Screenshot saved to screenshots/work-items-workboard.png");

		// Also try the control-plane project
		console.log("Navigating to control-plane work-items...");
		await page.goto("http://127.0.0.1:18460/projects/control-plane/work-items", {
			waitUntil: "networkidle",
			timeout: 10000,
		});

		await page.waitForTimeout(1000);

		await page.screenshot({
			path: "screenshots/work-items-control-plane.png",
			fullPage: false,
		});
		console.log("Screenshot saved to screenshots/work-items-control-plane.png");
	} catch (error) {
		console.error("Error taking screenshot:", error.message);
	} finally {
		await browser.close();
	}
})();
