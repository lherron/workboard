const mockWorkspaces = {
	workspaces: [
		{
			workspace: { id: "rex", name: "rex", root: "", dbPath: "", enabled: true },
			containers: [
				{
					uuid: "c1",
					id: "P-00001",
					slug: "ideas",
					title: "Ideas",
					path: "ideas",
					parent_uuid: null,
					kind: "project",
					sort_index: 0,
					section_uuid: null,
					etag: 1,
					open_task_count: 2,
					total_task_count: 2,
					children: [],
				},
				{
					uuid: "c2",
					id: "P-00002",
					slug: "rex",
					title: "Rex",
					path: "rex",
					parent_uuid: null,
					kind: "project",
					sort_index: 1,
					section_uuid: null,
					etag: 1,
					open_task_count: 3,
					total_task_count: 3,
					children: [],
				},
				{
					uuid: "c3",
					id: "P-00003",
					slug: "control-plane",
					title: "Control Plane",
					path: "control-plane",
					parent_uuid: null,
					kind: "project",
					sort_index: 2,
					section_uuid: null,
					etag: 1,
					open_task_count: 1,
					total_task_count: 1,
					children: [],
				},
			],
		},
		{
			workspace: { id: "wrkq", name: "wrkq", root: "", dbPath: "", enabled: true },
			containers: [
				{
					uuid: "c4",
					id: "P-00004",
					slug: "web-ui",
					title: "Web UI",
					path: "web-ui",
					parent_uuid: null,
					kind: "project",
					sort_index: 0,
					section_uuid: null,
					etag: 1,
					open_task_count: 2,
					total_task_count: 2,
					children: [],
				},
				{
					uuid: "c5",
					id: "P-00005",
					slug: "cli",
					title: "CLI",
					path: "cli",
					parent_uuid: null,
					kind: "project",
					sort_index: 1,
					section_uuid: null,
					etag: 1,
					open_task_count: 3,
					total_task_count: 3,
					children: [],
				},
			],
		},
	],
};

const mockTasks: Record<string, unknown[]> = {
	rex: [
		{
			uuid: "t1",
			id: "T-00001",
			slug: "test-opus-gemini",
			title: "Test out opus vs gemini-flash for OOB",
			state: "open",
			priority: 1,
			kind: "task",
			parent_task_uuid: null,
			assignee: null,
			due_at: null,
			labels: [],
			updated_at: "2024-01-01",
			etag: 1,
			project: { uuid: "c1", id: "P-00001", slug: "ideas", title: "Ideas", path: "ideas" },
		},
		{
			uuid: "t2",
			id: "T-00002",
			slug: "pre-defined-commands",
			title: "Pre-defined commands (default press) with option to customize (edit button)",
			state: "open",
			priority: 2,
			kind: "task",
			parent_task_uuid: null,
			assignee: null,
			due_at: null,
			labels: [],
			updated_at: "2024-01-01",
			etag: 1,
			project: { uuid: "c1", id: "P-00001", slug: "ideas", title: "Ideas", path: "ideas" },
		},
		{
			uuid: "t3",
			id: "T-00003",
			slug: "define-rex-skills",
			title: "Define Rex skills and tools",
			state: "open",
			priority: 1,
			kind: "task",
			parent_task_uuid: null,
			assignee: null,
			due_at: null,
			labels: [],
			updated_at: "2024-01-01",
			etag: 1,
			project: { uuid: "c2", id: "P-00002", slug: "rex", title: "Rex", path: "rex" },
		},
		{
			uuid: "t4",
			id: "T-00004",
			slug: "define-rex-personality",
			title: "Define Rex personality and system prompt",
			state: "open",
			priority: 2,
			kind: "task",
			parent_task_uuid: null,
			assignee: null,
			due_at: null,
			labels: [],
			updated_at: "2024-01-01",
			etag: 1,
			project: { uuid: "c2", id: "P-00002", slug: "rex", title: "Rex", path: "rex" },
		},
		{
			uuid: "t5",
			id: "T-00005",
			slug: "decide-rex-master",
			title: "Decide on Rex vs Master identity",
			state: "open",
			priority: 3,
			kind: "task",
			parent_task_uuid: null,
			assignee: null,
			due_at: null,
			labels: [],
			updated_at: "2024-01-01",
			etag: 1,
			project: { uuid: "c2", id: "P-00002", slug: "rex", title: "Rex", path: "rex" },
		},
		{
			uuid: "t6",
			id: "T-00006",
			slug: "add-wrkq-custom-tool",
			title: "Add wrkq as a custom tool for pi",
			state: "open",
			priority: 2,
			kind: "task",
			parent_task_uuid: null,
			assignee: null,
			due_at: null,
			labels: [],
			updated_at: "2024-01-01",
			etag: 1,
			project: {
				uuid: "c3",
				id: "P-00003",
				slug: "control-plane",
				title: "Control Plane",
				path: "control-plane",
			},
		},
	],
	wrkq: [
		{
			uuid: "t7",
			id: "T-00007",
			slug: "webwrkq-discover",
			title: "Webwrkq should discover wrkq databases from control-panel",
			state: "open",
			priority: 1,
			kind: "task",
			parent_task_uuid: null,
			assignee: null,
			due_at: null,
			labels: ["web"],
			updated_at: "2024-01-01",
			etag: 1,
			project: { uuid: "c4", id: "P-00004", slug: "web-ui", title: "Web UI", path: "web-ui" },
		},
		{
			uuid: "t8",
			id: "T-00008",
			slug: "add-wrkq-task-view",
			title: "Add wrkq task view/create to admin-ui (deprecate webwrkq?)",
			state: "open",
			priority: 2,
			kind: "task",
			parent_task_uuid: null,
			assignee: null,
			due_at: null,
			labels: [],
			updated_at: "2024-01-01",
			etag: 1,
			project: { uuid: "c4", id: "P-00004", slug: "web-ui", title: "Web UI", path: "web-ui" },
		},
		{
			uuid: "t9",
			id: "T-00009",
			slug: "move-admin-ui",
			title: "Move to admin-ui?",
			state: "open",
			priority: 3,
			kind: "task",
			parent_task_uuid: null,
			assignee: null,
			due_at: null,
			labels: ["web"],
			updated_at: "2024-01-01",
			etag: 1,
			project: { uuid: "c5", id: "P-00005", slug: "cli", title: "CLI", path: "cli" },
		},
		{
			uuid: "t10",
			id: "T-00010",
			slug: "create-wide-angle",
			title: "Create wide-angle view",
			state: "open",
			priority: 2,
			kind: "task",
			parent_task_uuid: null,
			assignee: null,
			due_at: null,
			labels: [],
			updated_at: "2024-01-01",
			etag: 1,
			project: { uuid: "c5", id: "P-00005", slug: "cli", title: "CLI", path: "cli" },
		},
		{
			uuid: "t11",
			id: "T-00011",
			slug: "migrate-todoist",
			title: "Migrate out of todoist",
			state: "open",
			priority: 4,
			kind: "task",
			parent_task_uuid: null,
			assignee: null,
			due_at: null,
			labels: [],
			updated_at: "2024-01-01",
			etag: 1,
			project: { uuid: "c5", id: "P-00005", slug: "cli", title: "CLI", path: "cli" },
		},
	],
};

const mockTaskDetail = {
	uuid: "t3",
	id: "T-00003",
	slug: "define-rex-skills",
	title: "Define Rex skills and tools",
	state: "open",
	priority: 1,
	kind: "task",
	parent_task: null,
	subtasks: [],
	assignee: null,
	start_at: null,
	due_at: null,
	labels: [],
	description:
		"Rex is the bootstrap agent that lets you create other agents and controls the projects in the root.",
	etag: 1,
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-01-01T00:00:00Z",
	completed_at: null,
	archived_at: null,
	path: "rex",
	project: { uuid: "c2", id: "P-00002", slug: "rex", title: "Rex", path: "rex" },
	created_by: { slug: "user", role: "human" },
	updated_by: { slug: "user", role: "human" },
};

const allTasks = [...mockTasks.rex, ...mockTasks.wrkq] as Array<{ id: string; uuid: string }>;

const server = Bun.serve({
	port: 7420,
	fetch(req) {
		const url = new URL(req.url);
		const headers = {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Headers": "*",
		};

		if (req.method === "OPTIONS") {
			return new Response(null, { status: 200, headers });
		}

		console.log(`${req.method} ${url.pathname}`);

		if (url.pathname === "/admin/wrkq/containers/tree") {
			const cpFormat = {
				projects: mockWorkspaces.workspaces.map((ws) => ({
					projectId: ws.workspace.id,
					projectName: ws.workspace.name,
					containers: ws.containers,
				})),
			};
			return new Response(JSON.stringify(cpFormat), { headers });
		}

		if (url.pathname.startsWith("/admin/wrkq/") && url.pathname.includes("/tasks")) {
			const parts = url.pathname.split("/");
			const workspaceId = parts[3];
			const tasks = mockTasks[workspaceId] || [];

			if (url.pathname.includes("/tasks/")) {
				const taskId = url.pathname.split("/tasks/")[1].split("?")[0];
				const task = allTasks.find((t) => t.id === taskId || t.uuid === taskId);
				return new Response(
					JSON.stringify({
						task: task
							? { ...mockTaskDetail, ...task, description: mockTaskDetail.description }
							: mockTaskDetail,
					}),
					{ headers },
				);
			}

			return new Response(JSON.stringify({ tasks }), { headers });
		}

		if (url.pathname.includes("/comments")) {
			return new Response(JSON.stringify({ task: { id: "T-00001", uuid: "t1" }, comments: [] }), {
				headers,
			});
		}

		return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
	},
});

console.log(`Mock API running on http://localhost:${server.port}`);
