import {
	type ProjectRosterMember,
	type RunSummary,
	fetchProjectRoster,
	fetchProjectRuns,
} from "@/api/client";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ProjectRosterConversation } from "./ProjectRosterConversation";
import { ProjectRosterHeader } from "./ProjectRosterHeader";
import { ProjectRosterMemberCard } from "./ProjectRosterMemberCard";

type ProjectRosterViewProps = {
	projectId: string;
	initialRoleName?: string;
	initialSessionId?: string;
};

// Role accent colors - cyberpunk palette with distinct character
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

// Session with its runs
export type SessionWithRuns = {
	sessionId: string;
	runs: RunSummary[];
	isActive: boolean;
};

export type MemberWithRuns = {
	member: ProjectRosterMember;
	sessions: SessionWithRuns[];
	roleColor: string;
};

export function ProjectRosterView({
	projectId,
	initialRoleName,
	initialSessionId,
}: ProjectRosterViewProps) {
	const [, setLocation] = useLocation();

	// Data state
	const [members, setMembers] = useState<MemberWithRuns[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Selected member for conversation panel
	const [selectedRoleName, setSelectedRoleName] = useState<string | null>(
		initialRoleName ?? "oracle",
	);

	// Selected session ID (for URL embedding)
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
		initialSessionId ?? null,
	);

	// Fetch roster and runs
	const fetchData = useCallback(
		async (signal?: AbortSignal) => {
			try {
				// Fetch roster - may return empty if not yet created
				let rosterResponse: Awaited<ReturnType<typeof fetchProjectRoster>>;
				try {
					rosterResponse = await fetchProjectRoster(projectId, signal);
				} catch (err) {
					// 404 means roster doesn't exist yet - that's OK
					if ((err as { status?: number }).status === 404) {
						setMembers([]);
						setError(null);
						setLoading(false);
						return;
					}
					throw err;
				}

				// Use empty array if roster is null (roster not yet created)
				const rosterMembers = rosterResponse.roster?.members ?? [];

				// Fetch runs for the project
				let runs: RunSummary[] = [];
				try {
					const runsResponse = await fetchProjectRuns(projectId, undefined, signal);
					runs = runsResponse.runs;
				} catch {
					// Runs fetch failure is non-fatal
					console.warn("Failed to fetch project runs");
				}

				// Group runs by session for each member
				const sessionsByRole = new Map<string, Map<string, SessionWithRuns>>();

				for (const member of rosterMembers) {
					const sessionMap = new Map<string, SessionWithRuns>();

					// Always include active session (even if no runs yet)
					if (member.session.activeSessionId) {
						sessionMap.set(member.session.activeSessionId, {
							sessionId: member.session.activeSessionId,
							runs: [],
							isActive: true,
						});
					}

					// Include prior sessions
					for (const priorId of member.session.priorSessionIds ?? []) {
						if (!sessionMap.has(priorId)) {
							sessionMap.set(priorId, {
								sessionId: priorId,
								runs: [],
								isActive: false,
							});
						}
					}

					sessionsByRole.set(member.roleName, sessionMap);
				}

				// Add runs to their sessions
				for (const run of runs) {
					const runSessionId = run.sessionId;
					if (!runSessionId) continue;

					// Find which member this run belongs to
					const member = rosterMembers.find(
						(m) =>
							m.session.activeSessionId === runSessionId ||
							m.session.priorSessionIds?.includes(runSessionId),
					);

					if (member) {
						const sessionMap = sessionsByRole.get(member.roleName);
						if (sessionMap) {
							let session = sessionMap.get(runSessionId);
							if (!session) {
								// Session not in priorSessionIds but has runs - add it
								session = {
									sessionId: runSessionId,
									runs: [],
									isActive: member.session.activeSessionId === runSessionId,
								};
								sessionMap.set(runSessionId, session);
							}
							session.runs.push(run);
						}
					}
				}

				// Build view model with sessions limited to 5 most recent
				const membersWithRuns: MemberWithRuns[] = rosterMembers.map((member) => {
					const sessionMap =
						sessionsByRole.get(member.roleName) ?? new Map<string, SessionWithRuns>();

					// Sort runs within each session
					for (const session of sessionMap.values()) {
						session.runs.sort((a, b) => a.createdAt - b.createdAt);
					}

					// Convert to array and sort by most recent activity (newest first)
					let sessions = Array.from(sessionMap.values()).sort((a, b) => {
						// Active session always first
						if (a.isActive && !b.isActive) return -1;
						if (!a.isActive && b.isActive) return 1;
						// Then by most recent run
						const aLatest = a.runs[a.runs.length - 1]?.createdAt ?? 0;
						const bLatest = b.runs[b.runs.length - 1]?.createdAt ?? 0;
						return bLatest - aLatest;
					});

					// Limit to 5 most recent sessions
					sessions = sessions.slice(0, 5);

					return {
						member,
						sessions,
						roleColor: getRoleColor(member.roleName),
					};
				});

				setMembers(membersWithRuns);
				setError(null);

				// Auto-select oracle if available and nothing selected
				if (
					!selectedRoleName ||
					!membersWithRuns.find((m) => m.member.roleName === selectedRoleName)
				) {
					const oracle = membersWithRuns.find((m) => m.member.roleName === "oracle");
					if (oracle) {
						setSelectedRoleName("oracle");
					} else if (membersWithRuns.length > 0) {
						setSelectedRoleName(membersWithRuns[0].member.roleName);
					}
				}
			} catch (err) {
				if ((err as Error).name === "AbortError") return;
				console.error("Failed to fetch roster data:", err);
				setError((err as Error).message || "Failed to load roster");
			} finally {
				setLoading(false);
			}
		},
		[projectId, selectedRoleName],
	);

	// Initial load
	useEffect(() => {
		const controller = new AbortController();
		fetchData(controller.signal);
		return () => controller.abort();
	}, [fetchData]);

	// Update URL when role or session selection changes
	useEffect(() => {
		if (selectedRoleName) {
			const hasRoleChange = selectedRoleName !== initialRoleName;
			const hasSessionChange = selectedSessionId !== initialSessionId;

			if (hasRoleChange || hasSessionChange) {
				const basePath = `/projects/${projectId}/roster/${selectedRoleName}`;
				const path = selectedSessionId ? `${basePath}/${selectedSessionId}` : basePath;
				setLocation(path, { replace: true });
			}
		}
	}, [
		selectedRoleName,
		selectedSessionId,
		projectId,
		initialRoleName,
		initialSessionId,
		setLocation,
	]);

	// Handle session change from conversation component
	const handleSessionChange = (sessionId: string | null) => {
		setSelectedSessionId(sessionId);
	};

	// Selected member data
	const selectedMember = members.find((m) => m.member.roleName === selectedRoleName);

	// Stats
	const activeCount = members.filter((m) => m.member.state === "active").length;
	const pausedCount = members.filter((m) => m.member.state === "paused").length;

	// Navigate back
	const handleBack = () => {
		setLocation("/projects");
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full bg-[#0a0e27]">
				<div className="flex flex-col items-center gap-4">
					<div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
					<p className="text-[11px] text-cyan-300/60 uppercase tracking-wider">Loading roster...</p>
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
			<ProjectRosterHeader
				projectId={projectId}
				activeCount={activeCount}
				pausedCount={pausedCount}
				totalMembers={members.length}
				onBack={handleBack}
			/>

			{/* Main content - split panel */}
			<div className="flex-1 min-h-0 flex relative">
				{/* Left panel - Member grid */}
				<div className="w-80 shrink-0 border-r border-indigo-900/30 flex flex-col relative backdrop-blur-sm bg-[#0d1133]/40">
					{/* Grid header */}
					<div className="px-4 py-2 border-b border-indigo-900/30 bg-indigo-950/20">
						<h2 className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/80">
							Roster Members
						</h2>
					</div>

					{/* Member cards */}
					<div className="flex-1 overflow-y-auto p-3 space-y-2">
						{members.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-full text-center py-8">
								<div className="w-16 h-16 border border-indigo-700/30 rounded-lg flex items-center justify-center mb-4 bg-indigo-950/20">
									<svg
										width="24"
										height="24"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.5"
										className="text-cyan-400/50"
									>
										<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
										<circle cx="9" cy="7" r="4" />
										<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
										<path d="M16 3.13a4 4 0 0 1 0 7.75" />
									</svg>
								</div>
								<p className="text-[11px] text-cyan-300/60 uppercase tracking-wider mb-1">
									No roster members
								</p>
								<p className="text-[10px] text-indigo-400/40">
									Send a message to create the oracle
								</p>
							</div>
						) : (
							members.map((memberWithRuns) => (
								<ProjectRosterMemberCard
									key={memberWithRuns.member.memberId}
									memberWithRuns={memberWithRuns}
									isSelected={memberWithRuns.member.roleName === selectedRoleName}
									onSelect={() => {
										setSelectedRoleName(memberWithRuns.member.roleName);
										// Reset session when switching roles
										setSelectedSessionId(null);
									}}
								/>
							))
						)}
					</div>
				</div>

				{/* Right panel - Conversation */}
				<div className="flex-1 min-w-0 flex flex-col">
					{selectedMember ? (
						<ProjectRosterConversation
							projectId={projectId}
							memberWithRuns={selectedMember}
							onRefresh={fetchData}
							initialSessionId={selectedSessionId ?? undefined}
							onSessionChange={handleSessionChange}
						/>
					) : (
						<div className="flex-1 flex items-center justify-center">
							<div className="text-center">
								<div
									className={cn(
										"w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center",
										"bg-gradient-to-br from-cyan-500/10 to-indigo-900/50 border border-cyan-500/20",
									)}
								>
									<svg
										width="32"
										height="32"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.5"
										className="text-cyan-400/60"
									>
										<circle cx="12" cy="12" r="10" />
										<path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
									</svg>
								</div>
								<p className="text-[12px] text-cyan-200/70 mb-1">No member selected</p>
								<p className="text-[10px] text-indigo-400/50">
									Select a member from the roster or ask the oracle
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Footer - keyboard hints */}
			<div className="shrink-0 px-4 py-2 border-t border-indigo-900/30 bg-[#0d1133]/60 backdrop-blur-sm relative">
				<div className="flex items-center gap-6 text-[9px] text-indigo-400/60">
					<span>
						<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
							↑/↓
						</kbd>{" "}
						navigate
					</span>
					<span>
						<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
							⏎
						</kbd>{" "}
						select
					</span>
					<span>
						<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
							n
						</kbd>{" "}
						new session
					</span>
					<span>
						<kbd className="px-1.5 py-0.5 bg-indigo-950/50 border border-indigo-800/40 rounded text-[8px] text-cyan-300/70">
							r
						</kbd>{" "}
						refresh
					</span>
				</div>
			</div>
		</div>
	);
}
