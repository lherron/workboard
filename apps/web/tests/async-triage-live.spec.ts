import { expect, test } from "@playwright/test";

const projectId = process.env.E2E_PROJECT_ID || "workboard";
const taskId = process.env.E2E_TASK_ID;
const cpToken = process.env.E2E_CP_TOKEN || "dev";

function shouldSkip(): string | null {
	if (!taskId) return "E2E_TASK_ID not set";
	return null;
}

test.describe("Async triage live e2e", () => {
	test("calls triage endpoint and updates task fields", async ({ page, request }) => {
		const skipReason = shouldSkip();
		test.skip(Boolean(skipReason), skipReason ?? undefined);

		await page.goto(`/prompt-shaping/${projectId}/${taskId}`);
		await page.waitForLoadState("networkidle");

		const asyncButton = page.getByRole("button", { name: /async triage/i });
		await expect(asyncButton).toBeVisible({ timeout: 10000 });
		await asyncButton.click();

		await expect(page.locator("text=Async triage started")).toBeVisible({ timeout: 10000 });

		const taskUrl = `/admin/tasks/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`;

		let taskFields: { cp_run_id?: string; cp_session_id?: string; run_status?: string } | null =
			null;
		const start = Date.now();
		while (Date.now() - start < 15000) {
			const res = await request.get(taskUrl, {
				headers: {
					"x-cp-token": cpToken,
					"x-wrkq-actor": "codex-agent",
				},
			});
			expect(res.ok()).toBeTruthy();
			const payload = (await res.json()) as {
				task?: { cp_run_id?: string; cp_session_id?: string; run_status?: string };
			};
			if (payload.task?.cp_run_id && payload.task?.cp_session_id && payload.task?.run_status) {
				taskFields = payload.task;
				break;
			}
			await page.waitForTimeout(500);
		}

		expect(taskFields?.cp_run_id).toBeTruthy();
		expect(taskFields?.cp_session_id).toBeTruthy();
		expect(taskFields?.run_status).toBeTruthy();
	});
});
