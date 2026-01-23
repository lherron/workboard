import { type ProjectRosterMember, fetchProjectRoster, fetchWorkspaces } from "@/api/client";
import { cn } from "@/lib/utils";
import type { Workspace, WorkspaceListResponse } from "@workboard/shared";
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";

// Role accent colors - cyberpunk palette matching roster detail
const ROLE_COLORS: Record<string, string> = {
	oracle: "#ff6b9d", // coral-pink - warm, authoritative
	reviewer: "#a78bfa", // violet - analytical
	implementer: "#00d9ff", // electric cyan - technical precision
	coordinator: "#7dd3c0", // mint - harmonizing
	triager: "#ffa94d", // warm orange - prioritization
};

function getRoleColor(roleName: string): string {
	return ROLE_COLORS[roleName.toLowerCase()] ?? "#67e8f9"; // cyan-300 default
}

type ProjectWithRoster = {
	id: string;
	name: string;
	root: string;
	members: ProjectRosterMember[];
	loadingRoster: boolean;
	rosterError: string | null;
};

export function ProjectsIndexRoute() {
	const [projects, setProjects] = useState<ProjectWithRoster[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async (signal?: AbortSignal) => {
		try {
			const response: WorkspaceListResponse = await fetchWorkspaces(signal);

			// Initialize projects without rosters
			const projectsWithRosters: ProjectWithRoster[] = response.workspaces.map((w: Workspace) => ({
				id: w.id,
				name: w.name,
				root: w.root,
				members: [],
				loadingRoster: true,
				rosterError: null,
			}));

			setProjects(projectsWithRosters);
			setLoading(false);

			// Fetch rosters in parallel
			const rosterPromises = response.workspaces.map(async (w: Workspace) => {
				try {
					const rosterResponse = await fetchProjectRoster(w.id, signal);
					const members = rosterResponse.roster?.members ?? [];
					return { id: w.id, members, error: null };
				} catch (err) {
					if ((err as { status?: number }).status === 404) {
						return { id: w.id, members: [], error: null };
					}
					return { id: w.id, members: [], error: (err as Error).message };
				}
			});

			const results = await Promise.all(rosterPromises);

			setProjects((prev) =>
				prev.map((p) => {
					const result = results.find(
						(r: { id: string; members: ProjectRosterMember[]; error: string | null }) =>
							r.id === p.id,
					);
					return result
						? { ...p, members: result.members, loadingRoster: false, rosterError: result.error }
						: { ...p, loadingRoster: false };
				}),
			);
		} catch (err) {
			if ((err as Error).name === "AbortError") return;
			setError((err as Error).message || "Failed to load projects");
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		document.title = "workboard | projects";
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		fetchData(controller.signal);
		return () => controller.abort();
	}, [fetchData]);

	const totalActive = projects.reduce(
		(sum, p) => sum + p.members.filter((m) => m.state === "active").length,
		0,
	);
	const totalMembers = projects.reduce((sum, p) => sum + p.members.length, 0);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full bg-[#0a0e27]">
				<div className="flex flex-col items-center gap-4">
					<div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
					<p className="text-[11px] text-cyan-300/60 uppercase tracking-wider">
						Loading projects...
					</p>
				</div>
			</div>
		);
	}

	if (error) {
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
					<p className="text-[13px] text-cyan-100">{error}</p>
					<button
						onClick={() => {
							setLoading(true);
							setError(null);
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
				{/* Top accent line - cyan gradient */}
				<div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

				<div className="px-8 py-4">
					<div className="flex items-center justify-between">
						{/* Left: Title */}
						<div className="flex items-center gap-4">
							{/* Constellation icon */}
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
									{/* Constellation/network icon */}
									<circle cx="5" cy="5" r="2" />
									<circle cx="19" cy="5" r="2" />
									<circle cx="12" cy="12" r="2.5" />
									<circle cx="5" cy="19" r="2" />
									<circle cx="19" cy="19" r="2" />
									<path d="M7 5h10M5 7v10M19 7v10M7 19h10" strokeOpacity="0.4" />
									<path
										d="M6.5 6.5l4 4M13.5 13.5l4 4M17.5 6.5l-4 4M10.5 13.5l-4 4"
										strokeOpacity="0.4"
									/>
								</svg>
							</div>
							<div>
								<h1 className="text-[18px] font-bold tracking-wide uppercase text-cyan-100">
									Projects
								</h1>
								<p className="text-[11px] text-cyan-400/70 font-mono tracking-wider">
									Agent Rosters
								</p>
							</div>
						</div>

						{/* Right: Stats */}
						<div className="flex items-center gap-8">
							{/* Projects count */}
							<div className="flex flex-col items-end">
								<span className="text-[24px] font-bold text-cyan-200 font-mono tabular-nums">
									{projects.length}
								</span>
								<span className="text-[9px] uppercase tracking-widest text-indigo-400/60">
									Projects
								</span>
							</div>

							{/* Divider */}
							<div className="h-10 w-px bg-indigo-700/50" />

							{/* Active agents */}
							<div className="flex flex-col items-end">
								<div className="flex items-center gap-2">
									<span className="relative flex h-2 w-2">
										{totalActive > 0 && (
											<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
										)}
										<span
											className={cn(
												"relative inline-flex rounded-full h-2 w-2",
												totalActive > 0 ? "bg-cyan-400" : "bg-indigo-600",
											)}
										/>
									</span>
									<span className="text-[24px] font-bold text-cyan-400 font-mono tabular-nums">
										{totalActive}
									</span>
								</div>
								<span className="text-[9px] uppercase tracking-widest text-indigo-400/60">
									Active Agents
								</span>
							</div>

							{/* Total members */}
							<div className="flex flex-col items-end">
								<span className="text-[24px] font-bold text-indigo-300 font-mono tabular-nums">
									{totalMembers}
								</span>
								<span className="text-[9px] uppercase tracking-widest text-indigo-400/60">
									Total Roles
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* Subtle scan line effect */}
				<div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.02]">
					{[...Array(6)].map((_, i) => (
						<div
							key={i}
							className="absolute left-0 right-0 h-px bg-cyan-400"
							style={{ top: `${(i + 1) * 14}%` }}
						/>
					))}
				</div>
			</header>

			{/* Main content - Project grid */}
			<div className="flex-1 overflow-auto p-8 relative">
				{projects.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-center">
						<div className="w-20 h-20 border border-indigo-700/30 rounded-2xl flex items-center justify-center mb-6 bg-indigo-950/20">
							<svg
								width="32"
								height="32"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								className="text-cyan-400/50"
							>
								<path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
								<circle cx="12" cy="12" r="4" />
								<path d="M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
							</svg>
						</div>
						<h2 className="text-[14px] font-medium text-cyan-300/70 mb-2">No Projects Found</h2>
						<p className="text-[11px] text-indigo-400/50 max-w-xs">
							No projects are configured yet. Projects with agent rosters will appear here.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
						{projects.map((project) => (
							<ProjectCard key={project.id} project={project} />
						))}
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="shrink-0 px-8 py-3 border-t border-indigo-900/30 bg-[#0d1133]/60 backdrop-blur-sm relative">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-6 text-[9px] text-indigo-400/60">
						<span>
							<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
								⏎
							</kbd>{" "}
							open roster
						</span>
						<span>
							<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
								r
							</kbd>{" "}
							refresh
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

// ============================================================================
// Project Card Component
// ============================================================================

type ProjectCardProps = {
	project: ProjectWithRoster;
};

function ProjectCard({ project }: ProjectCardProps) {
	const activeCount = project.members.filter((m) => m.state === "active").length;
	const hasOracle = project.members.some((m) => m.roleName.toLowerCase() === "oracle");
	const oracleMember = project.members.find((m) => m.roleName.toLowerCase() === "oracle");
	const oracleActive = oracleMember?.session.activeSessionId;

	// Determine card accent based on state
	const hasActivity = activeCount > 0;
	const accentColor = hasOracle ? "pink" : "cyan";

	return (
		<Link
			href={`/projects/${project.id}`}
			className={cn(
				"group relative block rounded-xl border transition-all duration-300",
				"bg-[#0d1133]/60 backdrop-blur-sm",
				"border-indigo-800/40 hover:border-indigo-700/60",
				hasActivity && "hover:shadow-lg",
				hasActivity && accentColor === "pink" && "hover:shadow-pink-500/10",
				hasActivity && accentColor === "cyan" && "hover:shadow-cyan-500/10",
			)}
		>
			{/* Top accent bar */}
			<div
				className={cn(
					"h-[3px] rounded-t-xl transition-all duration-300",
					hasActivity ? "opacity-100" : "opacity-30",
					accentColor === "pink" && "bg-gradient-to-r from-pink-600 via-pink-400 to-pink-600",
					accentColor === "cyan" && "bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-600",
				)}
			/>

			<div className="p-5">
				{/* Header: Project name + status */}
				<div className="flex items-start justify-between mb-4">
					<div className="flex-1 min-w-0">
						<h3 className="text-[15px] font-bold text-cyan-100 truncate group-hover:text-cyan-50 transition-colors">
							{project.name}
						</h3>
						<p className="text-[10px] font-mono text-indigo-400/50 truncate mt-0.5">
							{project.root}
						</p>
					</div>

					{/* Activity indicator */}
					{hasActivity && (
						<div className="flex items-center gap-1.5 shrink-0 ml-3">
							<span className="relative flex h-2 w-2">
								<span
									className={cn(
										"animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
										accentColor === "pink" ? "bg-pink-400" : "bg-cyan-400",
									)}
								/>
								<span
									className={cn(
										"relative inline-flex rounded-full h-2 w-2",
										accentColor === "pink" ? "bg-pink-400" : "bg-cyan-400",
									)}
								/>
							</span>
							<span
								className={cn(
									"text-[9px] font-bold uppercase tracking-wider",
									accentColor === "pink" ? "text-pink-400" : "text-cyan-400",
								)}
							>
								{activeCount} active
							</span>
						</div>
					)}
				</div>

				{/* Roster members display */}
				{project.loadingRoster ? (
					<div className="flex items-center gap-2 py-4">
						<div className="w-4 h-4 border border-indigo-700/50 border-t-cyan-400 rounded-full animate-spin" />
						<span className="text-[10px] text-indigo-400/60">Loading roster...</span>
					</div>
				) : project.members.length === 0 ? (
					<div className="py-4 text-center">
						<div className="w-10 h-10 mx-auto mb-2 rounded-lg border border-indigo-800/30 flex items-center justify-center bg-indigo-950/20">
							<svg
								width="16"
								height="16"
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
						<p className="text-[10px] text-indigo-400/60">No roster configured</p>
						<p className="text-[9px] text-indigo-500/40 mt-0.5">Ask a question to create oracle</p>
					</div>
				) : (
					<div className="space-y-2">
						{/* Role chips */}
						<div className="flex flex-wrap gap-1.5">
							{project.members.slice(0, 5).map((member) => (
								<RoleChip key={member.memberId} member={member} />
							))}
							{project.members.length > 5 && (
								<span className="px-2 py-1 text-[9px] text-slate-600">
									+{project.members.length - 5} more
								</span>
							)}
						</div>

						{/* Oracle session status */}
						{oracleMember && (
							<div className="pt-2 mt-2 border-t border-indigo-800/30">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<span
											className={cn(
												"w-1.5 h-1.5 rounded-full",
												oracleActive ? "bg-pink-400 animate-pulse" : "bg-indigo-600",
											)}
										/>
										<span className="text-[9px] text-indigo-400/70">
											Oracle {oracleActive ? "live" : "idle"}
										</span>
									</div>
									{oracleActive && (
										<span className="text-[8px] font-mono text-indigo-500/50">
											{oracleActive.slice(0, 8)}
										</span>
									)}
								</div>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Hover arrow indicator */}
			<div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					className="text-cyan-400/60"
				>
					<path d="M5 12h14M12 5l7 7-7 7" />
				</svg>
			</div>
		</Link>
	);
}

// ============================================================================
// Role Chip Component
// ============================================================================

type RoleChipProps = {
	member: ProjectRosterMember;
};

function RoleChip({ member }: RoleChipProps) {
	const isOracle = member.roleName.toLowerCase() === "oracle";
	const isActive = member.state === "active";
	const color = getRoleColor(member.roleName);

	return (
		<div
			className={cn(
				"inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors",
				isOracle
					? "bg-pink-500/15 text-pink-300 border border-pink-500/20"
					: "bg-indigo-900/40 text-indigo-300 border border-indigo-700/30",
			)}
		>
			<span
				className={cn("w-1.5 h-1.5 rounded-full", isActive && "animate-pulse")}
				style={{ backgroundColor: color }}
			/>
			<span className="uppercase tracking-wider">{member.persona}</span>
		</div>
	);
}
