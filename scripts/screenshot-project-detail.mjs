import { chromium } from "playwright";

(async () => {
	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport: { width: 1920, height: 1080 },
	});
	const page = await context.newPage();

	try {
		// Navigate to the workboard project detail page
		console.log("Navigating to project detail page...");
		await page.goto("http://127.0.0.1:18460/projects/workboard", {
			waitUntil: "networkidle",
			timeout: 10000,
		});

		// Wait a bit for any animations
		await page.waitForTimeout(1000);

		// Take screenshot
		await page.screenshot({
			path: "screenshots/project-detail-workboard.png",
			fullPage: true,
		});
		console.log("Screenshot saved to screenshots/project-detail-workboard.png");
	} catch (error) {
		console.error("Error taking screenshot:", error.message);
	} finally {
		await browser.close();
	}
})();
