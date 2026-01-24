import {
	type ProjectRosterMember,
	type RunSummary,
	fetchProjectRoster,
	fetchProjectRuns,
	fetchWorkspaceSpecs,
	fetchWorkspaceTasks,
} from "@/api/client";
import { cn } from "@/lib/utils";
import type { SpecManifest, TaskListItem } from "@workboard/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";

// Role accent colors - matching roster detail
const ROLE_COLORS: Record<string, string> = {
	oracle: "#ff6b9d",
	reviewer: "#a78bfa",
	implementer: "#00d9ff",
	coordinator: "#7dd3c0",
	triager: "#ffa94d",
};

function getRoleColor(roleName: string): string {
	return ROLE_COLORS[roleName.toLowerCase()] ?? "#67e8f9";
}

type ProjectData = {
	roster: ProjectRosterMember[];
	runs: RunSummary[];
	tasks: TaskListItem[];
	specs: SpecManifest[];
	loading: boolean;
	error: string | null;
};

export function ProjectDetailRoute() {
	const params = useParams<{ projectId: string }>();
	const { projectId } = params;
	const [, _setLocation] = useLocation();

	const [data, setData] = useState<ProjectData>({
		roster: [],
		runs: [],
		tasks: [],
		specs: [],
		loading: true,
		error: null,
	});

	const fetchData = useCallback(
		async (signal?: AbortSignal) => {
			if (!projectId) return;

			try {
				// Fetch all data in parallel
				const [rosterRes, runsRes, tasksRes, specsRes] = await Promise.allSettled([
					fetchProjectRoster(projectId, signal).catch((err) => {
						if ((err as { status?: number }).status === 404) return { roster: null };
						throw err;
					}),
					fetchProjectRuns(projectId, undefined, signal).catch(() => ({ runs: [] })),
					fetchWorkspaceTasks(
						projectId,
						{ filter: "open", sort: "priority", limit: 10 },
						signal,
					).catch(() => ({ tasks: [] })),
					fetchWorkspaceSpecs(projectId, signal).catch(() => ({ specs: [] })),
				]);

				const roster =
					rosterRes.status === "fulfilled" ? (rosterRes.value.roster?.members ?? []) : [];
				const runs = runsRes.status === "fulfilled" ? runsRes.value.runs : [];
				const tasks = tasksRes.status === "fulfilled" ? tasksRes.value.tasks : [];
				const specs = specsRes.status === "fulfilled" ? specsRes.value.specs : [];

				setData({
					roster,
					runs,
					tasks,
					specs,
					loading: false,
					error: null,
				});
			} catch (err) {
				if ((err as Error).name === "AbortError") return;
				setData((prev) => ({
					...prev,
					loading: false,
					error: (err as Error).message || "Failed to load project",
				}));
			}
		},
		[projectId],
	);

	useEffect(() => {
		if (projectId) {
			document.title = `workboard | ${projectId}`;
		}
	}, [projectId]);

	useEffect(() => {
		const controller = new AbortController();
		fetchData(controller.signal);
		return () => controller.abort();
	}, [fetchData]);

	// Stats
	const activeAgents = data.roster.filter((m) => m.state === "active").length;
	const runningRuns = data.runs.filter((r) => r.status === "running").length;
	const openTasks = data.tasks.length;
	const totalSpecs = data.specs.length;

	if (!projectId) {
		return (
			<div className="flex items-center justify-center h-full bg-[#0a0e27]">
				<p className="text-[13px] text-cyan-300/60">No project specified</p>
			</div>
		);
	}

	if (data.loading) {
		return (
			<div className="flex items-center justify-center h-full bg-[#0a0e27]">
				<div className="flex flex-col items-center gap-4">
					<div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
					<p className="text-[11px] text-cyan-300/60 uppercase tracking-wider">
						Loading project...
					</p>
				</div>
			</div>
		);
	}

	if (data.error) {
		return (
			<div className="flex items-center justify-center h-full bg-[#0a0e27]">
				<div className="flex flex-col items-center gap-4 max-w-md text-center">
					<div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							className="text-red-400"
						>
							<circle cx="12" cy="12" r="10" />
							<path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
						</svg>
					</div>
					<p className="text-[13px] text-cyan-100">{data.error}</p>
					<button
						onClick={() => {
							setData((prev) => ({ ...prev, loading: true, error: null }));
							fetchData();
						}}
						className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider border border-indigo-700/50 hover:bg-indigo-900/30 transition-colors text-cyan-200"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen overflow-hidden bg-[#0a0e27] relative">
			{/* Cyberpunk gradient background */}
			<div
				className="absolute inset-0 opacity-40 pointer-events-none"
				style={{
					backgroundImage: `radial-gradient(circle at 20% 30%, rgba(0, 217, 255, 0.08) 0%, transparent 50%),
                                      radial-gradient(circle at 80% 70%, rgba(167, 139, 250, 0.06) 0%, transparent 40%),
                                      radial-gradient(circle at 50% 50%, rgba(255, 107, 157, 0.04) 0%, transparent 60%)`,
				}}
			/>
			{/* Noise texture overlay */}
			<div
				className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
				}}
			/>

			{/* Header */}
			<header className="relative shrink-0 border-b border-indigo-900/30 bg-[#0d1133]/60 backdrop-blur-sm">
				<div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

				<div className="px-8 py-4">
					<div className="flex items-center justify-between">
						{/* Left: Back + Project name */}
						<div className="flex items-center gap-4">
							<Link
								href="/projects"
								className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border border-indigo-700/50 hover:bg-indigo-900/30 transition-colors text-cyan-200 rounded"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									className="text-cyan-400/70"
								>
									<path d="M19 12H5M12 19l-7-7 7-7" />
								</svg>
								Back
							</Link>

							<div className="h-8 w-px bg-indigo-700/50" />

							{/* Project icon */}
							<div className="w-12 h-12 rounded-xl border border-cyan-400/30 flex items-center justify-center bg-gradient-to-br from-cyan-400/10 to-indigo-900/50">
								<svg
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									className="text-cyan-400"
								>
									<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
									<polyline points="9 22 9 12 15 12 15 22" />
								</svg>
							</div>
							<div>
								<h1 className="text-[18px] font-bold tracking-wide uppercase text-cyan-100">
									{projectId}
								</h1>
								<p className="text-[11px] text-cyan-400/70 font-mono tracking-wider">Project Hub</p>
							</div>
						</div>

						{/* Right: Stats */}
						<div className="flex items-center gap-6">
							<StatBadge
								value={activeAgents}
								label="Active Agents"
								color="cyan"
								pulse={activeAgents > 0}
							/>
							<div className="h-8 w-px bg-indigo-700/50" />
							<StatBadge value={runningRuns} label="Running" color="pink" pulse={runningRuns > 0} />
							<div className="h-8 w-px bg-indigo-700/50" />
							<StatBadge value={openTasks} label="Open Tasks" color="violet" />
							<div className="h-8 w-px bg-indigo-700/50" />
							<StatBadge value={totalSpecs} label="Specs" color="indigo" />
						</div>
					</div>
				</div>
			</header>

			{/* Main content */}
			<div className="flex-1 overflow-auto p-8 relative">
				<div className="max-w-7xl mx-auto space-y-8">
					{/* Feature navigation grid */}
					<section>
						<h2 className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/80 mb-4">
							Navigate
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
							<FeatureCard
								title="Agent Roster"
								description="View and interact with project agents"
								icon={<RosterIcon />}
								href={`/projects/${projectId}/roster`}
								accent="pink"
								stat={`${data.roster.length} agents`}
								active={activeAgents > 0}
							/>
							<FeatureCard
								title="Task Board"
								description="Browse and manage wrkq tasks"
								icon={<TasksIcon />}
								href={`/workspace/${projectId}`}
								accent="cyan"
								stat={`${openTasks} open`}
							/>
							<FeatureCard
								title="Spec Writer"
								description="Create and edit specifications"
								icon={<SpecsIcon />}
								href={`/workspace/${projectId}/spec-writer`}
								accent="violet"
								stat={`${totalSpecs} specs`}
							/>
							<FeatureCard
								title="Run History"
								description="View agent execution logs"
								icon={<RunsIcon />}
								href={`/projects/${projectId}/work-items`}
								accent="orange"
								stat={`${data.runs.length} runs`}
							/>
							<FeatureCard
								title="Ralph"
								description="Spec loop runner (plan/build iterations)"
								icon={<RalphIcon />}
								href={`/projects/${projectId}/ralph`}
								accent="cyan"
								stat="runs + config"
							/>
						</div>
					</section>

					{/* Content panels */}
					<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
						{/* Roster preview */}
						<ContentPanel
							title="Agent Roster"
							href={`/projects/${projectId}/roster`}
							empty={data.roster.length === 0}
							emptyText="No roster configured. Ask a question to create the oracle."
						>
							<div className="space-y-2">
								{data.roster.slice(0, 4).map((member) => (
									<RosterMemberRow key={member.memberId} member={member} projectId={projectId} />
								))}
								{data.roster.length > 4 && (
									<Link
										href={`/projects/${projectId}/roster`}
										className="block text-center py-2 text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
									>
										+{data.roster.length - 4} more agents
									</Link>
								)}
							</div>
						</ContentPanel>

						{/* Recent tasks */}
						<ContentPanel
							title="Recent Tasks"
							href={`/workspace/${projectId}`}
							empty={data.tasks.length === 0}
							emptyText="No open tasks. Create one to get started."
						>
							<div className="space-y-2">
								{data.tasks.slice(0, 4).map((task) => (
									<TaskRow key={task.uuid} task={task} projectId={projectId} />
								))}
								{data.tasks.length > 4 && (
									<Link
										href={`/workspace/${projectId}`}
										className="block text-center py-2 text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
									>
										+{data.tasks.length - 4} more tasks
									</Link>
								)}
							</div>
						</ContentPanel>

						{/* Recent runs */}
						<ContentPanel
							title="Recent Runs"
							href={`/projects/${projectId}/work-items`}
							empty={data.runs.length === 0}
							emptyText="No runs yet. Runs will appear here when agents execute."
						>
							<div className="space-y-2">
								{data.runs.slice(0, 4).map((run) => (
									<RunRow key={run.runId} run={run} />
								))}
								{data.runs.length > 4 && (
									<Link
										href={`/projects/${projectId}/work-items`}
										className="block text-center py-2 text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
									>
										+{data.runs.length - 4} more runs
									</Link>
								)}
							</div>
						</ContentPanel>

						{/* Specs preview */}
						<ContentPanel
							title="Specifications"
							href={`/workspace/${projectId}/spec-writer`}
							empty={data.specs.length === 0}
							emptyText="No specs yet. Create a spec to document your project."
						>
							<div className="space-y-2">
								{data.specs.slice(0, 4).map((spec) => (
									<SpecRow key={spec.slug} spec={spec} projectId={projectId} />
								))}
								{data.specs.length > 4 && (
									<Link
										href={`/workspace/${projectId}/spec-writer`}
										className="block text-center py-2 text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
									>
										+{data.specs.length - 4} more specs
									</Link>
								)}
							</div>
						</ContentPanel>
					</div>
				</div>
			</div>

			{/* Footer */}
			<div className="shrink-0 px-8 py-3 border-t border-indigo-900/30 bg-[#0d1133]/60 backdrop-blur-sm relative">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-6 text-[9px] text-indigo-400/60">
						<span>
							<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
								⏎
							</kbd>{" "}
							open section
						</span>
						<span>
							<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
								r
							</kbd>{" "}
							refresh
						</span>
						<span>
							<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
								esc
							</kbd>{" "}
							back to projects
						</span>
					</div>
					<div className="text-[9px] text-indigo-400/50 font-mono">
						{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} UTC
					</div>
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// Stat Badge
// =============================================================================

type StatBadgeProps = {
	value: number;
	label: string;
	color: "cyan" | "pink" | "violet" | "indigo" | "orange";
	pulse?: boolean;
};

function StatBadge({ value, label, color, pulse }: StatBadgeProps) {
	const colorClasses = {
		cyan: "text-cyan-400",
		pink: "text-pink-400",
		violet: "text-violet-400",
		indigo: "text-indigo-300",
		orange: "text-orange-400",
	};

	return (
		<div className="flex flex-col items-end">
			<div className="flex items-center gap-2">
				{pulse && (
					<span className="relative flex h-2 w-2">
						<span
							className={cn(
								"animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
								color === "cyan" && "bg-cyan-400",
								color === "pink" && "bg-pink-400",
								color === "violet" && "bg-violet-400",
								color === "orange" && "bg-orange-400",
							)}
						/>
						<span
							className={cn(
								"relative inline-flex rounded-full h-2 w-2",
								color === "cyan" && "bg-cyan-400",
								color === "pink" && "bg-pink-400",
								color === "violet" && "bg-violet-400",
								color === "orange" && "bg-orange-400",
							)}
						/>
					</span>
				)}
				<span className={cn("text-[20px] font-bold font-mono tabular-nums", colorClasses[color])}>
					{value}
				</span>
			</div>
			<span className="text-[9px] uppercase tracking-widest text-indigo-400/60">{label}</span>
		</div>
	);
}

// =============================================================================
// Feature Card
// =============================================================================

type FeatureCardProps = {
	title: string;
	description: string;
	icon: React.ReactNode;
	href: string;
	accent: "cyan" | "pink" | "violet" | "orange";
	stat: string;
	active?: boolean;
};

function FeatureCard({ title, description, icon, href, accent, stat, active }: FeatureCardProps) {
	const accentClasses = {
		cyan: {
			bar: "bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-600",
			shadow: "hover:shadow-cyan-500/10",
			icon: "text-cyan-400",
			stat: "text-cyan-400",
		},
		pink: {
			bar: "bg-gradient-to-r from-pink-600 via-pink-400 to-pink-600",
			shadow: "hover:shadow-pink-500/10",
			icon: "text-pink-400",
			stat: "text-pink-400",
		},
		violet: {
			bar: "bg-gradient-to-r from-violet-600 via-violet-400 to-violet-600",
			shadow: "hover:shadow-violet-500/10",
			icon: "text-violet-400",
			stat: "text-violet-400",
		},
		orange: {
			bar: "bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600",
			shadow: "hover:shadow-orange-500/10",
			icon: "text-orange-400",
			stat: "text-orange-400",
		},
	};

	const classes = accentClasses[accent];

	return (
		<Link
			href={href}
			className={cn(
				"group relative block rounded-xl border transition-all duration-300",
				"bg-[#0d1133]/60 backdrop-blur-sm",
				"border-indigo-800/40 hover:border-indigo-700/60",
				"hover:shadow-lg",
				classes.shadow,
			)}
		>
			{/* Top accent bar */}
			<div
				className={cn("h-[3px] rounded-t-xl", classes.bar, active ? "opacity-100" : "opacity-40")}
			/>

			<div className="p-5">
				<div className="flex items-start justify-between mb-3">
					<div
						className={cn(
							"w-10 h-10 rounded-lg border border-indigo-700/50 flex items-center justify-center bg-indigo-950/40",
							classes.icon,
						)}
					>
						{icon}
					</div>
					{active && (
						<span className="relative flex h-2 w-2">
							<span
								className={cn(
									"animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
									accent === "cyan" && "bg-cyan-400",
									accent === "pink" && "bg-pink-400",
								)}
							/>
							<span
								className={cn(
									"relative inline-flex rounded-full h-2 w-2",
									accent === "cyan" && "bg-cyan-400",
									accent === "pink" && "bg-pink-400",
								)}
							/>
						</span>
					)}
				</div>

				<h3 className="text-[14px] font-bold text-cyan-100 mb-1 group-hover:text-cyan-50 transition-colors">
					{title}
				</h3>
				<p className="text-[10px] text-indigo-400/60 mb-3">{description}</p>

				<div className="flex items-center justify-between">
					<span className={cn("text-[11px] font-mono", classes.stat)}>{stat}</span>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						className="text-cyan-400/40 group-hover:text-cyan-400/80 transition-colors"
					>
						<path d="M5 12h14M12 5l7 7-7 7" />
					</svg>
				</div>
			</div>
		</Link>
	);
}

// =============================================================================
// Content Panel
// =============================================================================

type ContentPanelProps = {
	title: string;
	href: string;
	children: React.ReactNode;
	empty?: boolean;
	emptyText?: string;
};

function ContentPanel({ title, href, children, empty, emptyText }: ContentPanelProps) {
	return (
		<div className="rounded-xl border border-indigo-800/40 bg-[#0d1133]/60 backdrop-blur-sm overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-indigo-900/30 bg-indigo-950/20">
				<h3 className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/80">
					{title}
				</h3>
				<Link
					href={href}
					className="text-[9px] uppercase tracking-wider text-indigo-400/60 hover:text-cyan-400 transition-colors flex items-center gap-1"
				>
					View all
					<svg
						width="10"
						height="10"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					>
						<path d="M5 12h14M12 5l7 7-7 7" />
					</svg>
				</Link>
			</div>

			{/* Content */}
			<div className="p-4">
				{empty ? (
					<div className="py-8 text-center">
						<div className="w-12 h-12 mx-auto mb-3 rounded-lg border border-indigo-800/30 flex items-center justify-center bg-indigo-950/20">
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								className="text-indigo-600/50"
							>
								<circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
								<path d="M12 8v4M12 16h.01" />
							</svg>
						</div>
						<p className="text-[10px] text-indigo-400/50">{emptyText}</p>
					</div>
				) : (
					children
				)}
			</div>
		</div>
	);
}

// =============================================================================
// Row Components
// =============================================================================

function RosterMemberRow({
	member,
	projectId,
}: { member: ProjectRosterMember; projectId: string }) {
	const isActive = member.state === "active";
	const hasSession = !!member.session.activeSessionId;
	const color = getRoleColor(member.roleName);

	return (
		<Link
			href={`/projects/${projectId}/roster/${member.roleName}`}
			className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-indigo-900/20 transition-colors group"
		>
			<span
				className={cn("w-2 h-2 rounded-full", isActive && hasSession && "animate-pulse")}
				style={{ backgroundColor: color }}
			/>
			<div className="flex-1 min-w-0">
				<span className="text-[12px] font-medium text-cyan-100 group-hover:text-cyan-50 transition-colors">
					{member.persona}
				</span>
				<span className="text-[10px] text-indigo-400/60 ml-2 uppercase tracking-wider">
					{member.roleName}
				</span>
			</div>
			<span
				className={cn(
					"text-[9px] uppercase tracking-wider px-2 py-0.5 rounded",
					isActive ? "text-cyan-400 bg-cyan-400/10" : "text-indigo-500 bg-indigo-500/10",
				)}
			>
				{member.state}
			</span>
		</Link>
	);
}

function TaskRow({ task, projectId }: { task: TaskListItem; projectId: string }) {
	const stateColors: Record<string, string> = {
		open: "text-cyan-400 bg-cyan-400/10",
		in_progress: "text-pink-400 bg-pink-400/10",
		blocked: "text-orange-400 bg-orange-400/10",
		draft: "text-indigo-400 bg-indigo-400/10",
	};

	return (
		<Link
			href={`/workspace/${projectId}?t=${task.id}`}
			className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-indigo-900/20 transition-colors group"
		>
			<span className="text-[10px] font-mono text-indigo-400/60">{task.id}</span>
			<div className="flex-1 min-w-0">
				<span className="text-[12px] font-medium text-cyan-100 group-hover:text-cyan-50 transition-colors truncate block">
					{task.title}
				</span>
			</div>
			<span
				className={cn(
					"text-[9px] uppercase tracking-wider px-2 py-0.5 rounded shrink-0",
					stateColors[task.state] ?? "text-indigo-400 bg-indigo-400/10",
				)}
			>
				{task.state.replace("_", " ")}
			</span>
		</Link>
	);
}

function RunRow({ run }: { run: RunSummary }) {
	const statusColors: Record<string, string> = {
		running: "text-cyan-400 bg-cyan-400/10",
		completed: "text-green-400 bg-green-400/10",
		failed: "text-red-400 bg-red-400/10",
		pending: "text-indigo-400 bg-indigo-400/10",
	};

	const timeAgo = formatTimeAgo(run.createdAt);

	const content = (
		<>
			<span className="text-[10px] font-mono text-indigo-400/60 w-20 truncate">
				{run.runId.slice(0, 8)}
			</span>
			<div className="flex-1 min-w-0">
				<span className="text-[11px] text-cyan-100 truncate block">
					{run.inputPreview || "No preview"}
				</span>
			</div>
			<span className="text-[9px] text-indigo-400/50 shrink-0">{timeAgo}</span>
			<span
				className={cn(
					"text-[9px] uppercase tracking-wider px-2 py-0.5 rounded shrink-0",
					statusColors[run.status] ?? "text-indigo-400 bg-indigo-400/10",
				)}
			>
				{run.status}
			</span>
		</>
	);

	// If sessionId is available, make it a clickable link to the timeline
	if (run.sessionId) {
		return (
			<Link
				href={`/sessions/${run.sessionId}/timeline`}
				className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-indigo-900/20 transition-colors group cursor-pointer"
			>
				{content}
			</Link>
		);
	}

	// Fallback to non-clickable div if no sessionId
	return (
		<div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-indigo-900/20 transition-colors">
			{content}
		</div>
	);
}

function SpecRow({ spec, projectId }: { spec: SpecManifest; projectId: string }) {
	return (
		<Link
			href={`/workspace/${projectId}/spec-writer/${spec.slug}`}
			className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-indigo-900/20 transition-colors group"
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				className="text-violet-400/60 shrink-0"
			>
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
				<polyline points="14 2 14 8 20 8" />
				<line x1="16" y1="13" x2="8" y2="13" />
				<line x1="16" y1="17" x2="8" y2="17" />
			</svg>
			<div className="flex-1 min-w-0">
				<span className="text-[12px] font-medium text-cyan-100 group-hover:text-cyan-50 transition-colors truncate block">
					{spec.title}
				</span>
			</div>
			<span className="text-[9px] text-indigo-400/50 font-mono">{spec.slug}</span>
		</Link>
	);
}

// =============================================================================
// Icons
// =============================================================================

function RosterIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	);
}

function TasksIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<path d="M9 11l3 3L22 4" />
			<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
		</svg>
	);
}

function SpecsIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
			<polyline points="10 9 9 9 8 9" />
		</svg>
	);
}

function RunsIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<polygon points="5 3 19 12 5 21 5 3" />
		</svg>
	);
}

function RalphIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<path d="M12 2v4" />
			<path d="M12 18v4" />
			<path d="M4.93 4.93l2.83 2.83" />
			<path d="M16.24 16.24l2.83 2.83" />
			<path d="M2 12h4" />
			<path d="M18 12h4" />
			<path d="M4.93 19.07l2.83-2.83" />
			<path d="M16.24 7.76l2.83-2.83" />
			<circle cx="12" cy="12" r="4" />
		</svg>
	);
}

// =============================================================================
// Helpers
// =============================================================================

function formatTimeAgo(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	if (diff < 60000) return "just now";
	if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
	if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
	return `${Math.floor(diff / 86400000)}d ago`;
}
