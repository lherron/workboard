import {
	type RosterMember,
	type WorkItemRun,
	fetchWorkItemRoster,
	fetchWorkItemRuns,
} from "@/api/client";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { RosterMemberColumn } from "./RosterMemberColumn";

type RosterDetailViewProps = {
	workItemId: string;
};

// Agent identity colors by role
const ROLE_COLORS: Record<string, string> = {
	coordinator: "#00ff9d",
	implementer: "#00d4ff",
	reviewer: "#a78bfa",
	triager: "#ffaa00",
	tester: "#f472b6",
};

function getRoleColor(roleName: string): string {
	return ROLE_COLORS[roleName.toLowerCase()] ?? "#6b7280";
}

// View model: member with associated runs
export type MemberWithRuns = {
	member: RosterMember;
	runs: WorkItemRun[];
	roleColor: string;
};

export function RosterDetailView({ workItemId }: RosterDetailViewProps) {
	const [, setLocation] = useLocation();

	// Data state
	const [members, setMembers] = useState<MemberWithRuns[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch roster and runs - exposed for child components to trigger refetch
	const fetchData = useCallback(
		async (signal?: AbortSignal) => {
			try {
				// Fetch roster and runs in parallel
				const [rosterResponse, runsResponse] = await Promise.all([
					fetchWorkItemRoster(workItemId, signal),
					fetchWorkItemRuns(workItemId, signal),
				]);

				const { roster } = rosterResponse;
				const { runs } = runsResponse;

				// Group runs by roleName
				const runsByRole = new Map<string, WorkItemRun[]>();
				for (const run of runs) {
					const roleName = run.roleName ?? "unknown";
					const list = runsByRole.get(roleName) ?? [];
					list.push(run);
					runsByRole.set(roleName, list);
				}

				// Build view model: associate runs with members
				const membersWithRuns: MemberWithRuns[] = roster.members.map((member) => ({
					member,
					runs: (runsByRole.get(member.roleName) ?? []).sort(
						(a, b) => a.createdAt - b.createdAt, // Chronological order (oldest first)
					),
					roleColor: getRoleColor(member.roleName),
				}));

				setMembers(membersWithRuns);
				setError(null);
			} catch (err) {
				if ((err as Error).name === "AbortError") return;
				console.error("Failed to fetch roster data:", err);
				setError((err as Error).message || "Failed to load roster");
			} finally {
				setLoading(false);
			}
		},
		[workItemId],
	);

	// Initial load
	useEffect(() => {
		const controller = new AbortController();
		fetchData(controller.signal);
		return () => controller.abort();
	}, [fetchData]);

	// Aggregate stats
	const activeCount = members.filter((m) => m.member.state === "active").length;
	const pausedCount = members.filter((m) => m.member.state === "paused").length;
	const totalRuns = members.reduce((acc, m) => acc + m.runs.length, 0);
	const runningRuns = members.reduce(
		(acc, m) => acc + m.runs.filter((r) => r.status === "running").length,
		0,
	);

	// Navigate back to work items
	const handleBack = () => {
		setLocation("/work-items");
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="flex flex-col items-center gap-4">
					<div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
					<p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">
						Loading roster...
					</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full">
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
					<p className="text-[13px] text-foreground/80">{error}</p>
					<button
						onClick={() => {
							setLoading(true);
							setError(null);
							fetchData();
						}}
						className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider border border-border/50 hover:bg-secondary/50 transition-colors"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen overflow-hidden">
			{/* Header - Mission Control style */}
			<header className="relative border-b border-border/40 bg-secondary/30 shrink-0">
				{/* Top accent line */}
				<div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

				<div className="px-6 py-3">
					<div className="flex items-center justify-between">
						{/* Left: Back + Title */}
						<div className="flex items-center gap-4">
							<button
								onClick={handleBack}
								className="flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 hover:text-foreground border border-border/40 hover:border-border/60 transition-colors"
							>
								<ArrowLeft className="w-3 h-3" />
								Back
							</button>

							<div className="flex items-center gap-3">
								{/* Logo/icon */}
								<div className="w-8 h-8 border border-emerald-500/40 flex items-center justify-center bg-emerald-500/5">
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										className="text-emerald-400"
									>
										<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
										<circle cx="9" cy="7" r="4" />
										<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
										<path d="M16 3.13a4 4 0 0 1 0 7.75" />
									</svg>
								</div>
								<div>
									<h1 className="text-[14px] font-bold tracking-wide uppercase text-foreground">
										Roster Detail
									</h1>
									<p className="text-[10px] text-muted-foreground/60 font-mono">
										WI-{workItemId.slice(0, 8)}
									</p>
								</div>
							</div>
						</div>

						{/* Right: Status indicators */}
						<div className="flex items-center gap-6">
							{/* Active agents */}
							<div className="flex items-center gap-2">
								<span className="relative flex h-2 w-2">
									{activeCount > 0 && (
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
									)}
									<span
										className={cn(
											"relative inline-flex rounded-full h-2 w-2",
											activeCount > 0 ? "bg-emerald-400" : "bg-zinc-600",
										)}
									/>
								</span>
								<span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
									{activeCount} Active
								</span>
							</div>

							{/* Paused */}
							{pausedCount > 0 && (
								<div className="flex items-center gap-2">
									<span className="w-2 h-2 rounded-full bg-amber-400" />
									<span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
										{pausedCount} Paused
									</span>
								</div>
							)}

							{/* Running runs */}
							{runningRuns > 0 && (
								<div className="flex items-center gap-2">
									<span className="w-2 h-2 rounded-full bg-cyan-400 animate-live-dot" />
									<span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
										{runningRuns} Running
									</span>
								</div>
							)}

							{/* Total stats */}
							<div className="pl-4 border-l border-border/30 flex items-center gap-4">
								<span className="text-[10px] font-mono text-muted-foreground/60">
									{members.length} agents
								</span>
								<span className="text-[10px] font-mono text-muted-foreground/60">
									{totalRuns} runs
								</span>
							</div>
						</div>
					</div>

					{/* Keyboard hints */}
					<div className="mt-2 flex items-center gap-4 text-[9px] text-muted-foreground/40">
						<span>
							<kbd className="px-1 py-0.5 bg-secondary/60 border border-border/30 rounded text-[8px]">
								h/l
							</kbd>{" "}
							or{" "}
							<kbd className="px-1 py-0.5 bg-secondary/60 border border-border/30 rounded text-[8px]">
								←/→
							</kbd>{" "}
							columns
						</span>
						<span>
							<kbd className="px-1 py-0.5 bg-secondary/60 border border-border/30 rounded text-[8px]">
								j/k
							</kbd>{" "}
							scroll
						</span>
						<span>
							<kbd className="px-1 py-0.5 bg-secondary/60 border border-border/30 rounded text-[8px]">
								r
							</kbd>{" "}
							refresh
						</span>
					</div>
				</div>

				{/* Scan line effect */}
				<div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.015]">
					{[...Array(12)].map((_, i) => (
						<div
							key={i}
							className="absolute left-0 right-0 h-px bg-white"
							style={{ top: `${(i + 1) * 8}%` }}
						/>
					))}
				</div>
			</header>

			{/* Columns container */}
			<div className="flex-1 min-h-0 overflow-x-auto">
				{members.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<div className="flex flex-col items-center gap-4 max-w-md text-center">
							<div className="w-16 h-16 border border-border/40 flex items-center justify-center">
								<svg
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									className="text-muted-foreground/40"
								>
									<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
									<circle cx="9" cy="7" r="4" />
									<line x1="23" y1="11" x2="17" y2="11" />
								</svg>
							</div>
							<p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">
								No roster members yet
							</p>
						</div>
					</div>
				) : (
					<div className="flex h-full gap-0 py-2 px-4">
						{members.map((memberWithRuns, index) => (
							<RosterMemberColumn
								key={memberWithRuns.member.memberId}
								memberWithRuns={memberWithRuns}
								workItemId={workItemId}
								isFirst={index === 0}
								isLast={index === members.length - 1}
								onRunSubmitted={fetchData}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
