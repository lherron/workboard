import type { WorkItemRun } from "@/api/client";
import { submitMemberTurn } from "@/api/client";
import { cn } from "@/lib/utils";
import { Plus, Radio } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MemberWithRuns } from "./RosterDetailView";
import { SessionCard } from "./SessionCard";

type RosterMemberColumnProps = {
	memberWithRuns: MemberWithRuns;
	workItemId: string;
	isFirst?: boolean;
	isLast?: boolean;
	onRunSubmitted?: () => void;
};

// State indicator styling
const stateStyles: Record<string, { dot: string; text: string; label: string }> = {
	active: {
		dot: "bg-emerald-400",
		text: "text-emerald-400",
		label: "ACTIVE",
	},
	paused: {
		dot: "bg-amber-400",
		text: "text-amber-400",
		label: "PAUSED",
	},
	retired: {
		dot: "bg-zinc-500",
		text: "text-zinc-500 line-through",
		label: "RETIRED",
	},
};

// Session with its runs
type SessionWithRuns = {
	sessionId: string;
	runs: WorkItemRun[];
};

export function RosterMemberColumn({
	memberWithRuns,
	workItemId,
	isFirst = false,
	isLast = false,
	onRunSubmitted,
}: RosterMemberColumnProps) {
	const { member, runs, roleColor } = memberWithRuns;

	// Group runs by sessionId, building session list
	const sessions = useMemo(() => {
		const sessionMap = new Map<string, SessionWithRuns>();

		// Always include the active session (even if no runs yet)
		if (member.session.activeSessionId) {
			sessionMap.set(member.session.activeSessionId, {
				sessionId: member.session.activeSessionId,
				runs: [],
			});
		}

		// Add runs to their sessions
		for (const run of runs) {
			if (run.sessionId) {
				const existing = sessionMap.get(run.sessionId);
				if (existing) {
					existing.runs.push(run);
				} else {
					sessionMap.set(run.sessionId, {
						sessionId: run.sessionId,
						runs: [run],
					});
				}
			}
		}

		// Sort runs within each session by createdAt
		for (const session of sessionMap.values()) {
			session.runs.sort((a, b) => a.createdAt - b.createdAt);
		}

		return Array.from(sessionMap.values());
	}, [runs, member.session.activeSessionId]);

	const stateStyle = stateStyles[member.state] ?? stateStyles.active;
	const hasLiveRun = runs.some((r) => r.status === "running");
	const totalSessions = sessions.length;

	// Active session tab - default to active session or first session
	const [activeSessionId, setActiveSessionId] = useState<string | null>(
		member.session.activeSessionId ?? sessions[0]?.sessionId ?? null,
	);

	// Update active tab when sessions change (e.g., new session created)
	useEffect(() => {
		if (sessions.length > 0 && !sessions.find((s) => s.sessionId === activeSessionId)) {
			setActiveSessionId(member.session.activeSessionId ?? sessions[0]?.sessionId ?? null);
		}
	}, [sessions, activeSessionId, member.session.activeSessionId]);

	const activeSession = sessions.find((s) => s.sessionId === activeSessionId) ?? sessions[0];

	// New session creation
	const [isCreatingSession, setIsCreatingSession] = useState(false);

	const handleNewSession = async () => {
		if (isCreatingSession) return;

		// Map roleName to kind (coordinator -> coord, implementer -> impl)
		const kind = member.roleName === "coordinator" ? "coord" : "impl";

		setIsCreatingSession(true);
		try {
			// Empty prompt creates a new session
			await submitMemberTurn(workItemId, member.memberId, kind, "");
		} catch (err) {
			console.error("Failed to create new session:", err);
		} finally {
			setIsCreatingSession(false);
		}
	};

	return (
		<div
			className={cn(
				"flex flex-col h-full min-h-0 w-[520px] min-w-[520px] border-r border-border/30",
				isFirst && "border-l",
				isLast && "border-r-0",
			)}
		>
			{/* Top accent bar - role color */}
			<div className="h-[2px] shrink-0" style={{ backgroundColor: roleColor }} />

			{/* Column Header - Sticky */}
			<div className="shrink-0 px-4 py-2 bg-secondary/40 border-b border-border/30">
				{/* Role label */}
				<div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">
					═══ {member.roleName.toUpperCase()} ═══
				</div>

				{/* Persona badge */}
				<div
					className="inline-flex items-center gap-2 px-2 py-1 rounded-sm mb-2"
					style={{
						backgroundColor: `${roleColor}10`,
						boxShadow: `0 0 20px ${roleColor}15`,
					}}
				>
					<span
						className={cn("w-2 h-2 rounded-full", member.state === "active" && "animate-live-dot")}
						style={{ backgroundColor: roleColor }}
					/>
					<span
						className="text-[12px] font-bold uppercase tracking-wide"
						style={{ color: roleColor }}
					>
						{member.persona}
					</span>
				</div>

				{/* Agent target */}
				<div className="text-[9px] font-mono text-muted-foreground/40 mb-2">
					{member.agentTarget}
				</div>

				{/* State + Session row */}
				<div className="flex items-center justify-between mb-1">
					<div className="flex items-center gap-2">
						<span
							className={cn(
								"w-1.5 h-1.5 rounded-full",
								stateStyle.dot,
								member.state === "active" && "animate-pulse",
							)}
						/>
						<span className={cn("text-[10px] font-bold uppercase tracking-wider", stateStyle.text)}>
							{stateStyle.label}
						</span>
					</div>

					{totalSessions > 0 && (
						<span className="text-[9px] font-mono text-muted-foreground/40">
							{totalSessions} session{totalSessions !== 1 ? "s" : ""}
						</span>
					)}
				</div>

				{/* Divider */}
				<div className="border-t border-border/30 my-1" />

				{/* Stats bar */}
				<div className="flex items-center justify-between text-[9px] text-muted-foreground/50">
					<div className="flex items-center gap-3">
						<span>{runs.length} runs</span>

						{/* Live indicator if any run is active */}
						{hasLiveRun && (
							<span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 text-emerald-300 px-2 py-0.5">
								<Radio className="h-2.5 w-2.5" />
								<span className="animate-live-dot">Live</span>
							</span>
						)}
					</div>

					{/* New Session button */}
					<button
						onClick={handleNewSession}
						disabled={isCreatingSession || hasLiveRun}
						className={cn(
							"inline-flex items-center gap-1 px-2 py-1 rounded border transition-colors",
							"border-border/40 hover:border-cyan-500/40 hover:text-cyan-400",
							"disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border/40 disabled:hover:text-muted-foreground/50",
						)}
					>
						<Plus className="h-3 w-3" />
						<span className="text-[9px] font-medium uppercase tracking-wider">
							{isCreatingSession ? "Creating..." : "New Session"}
						</span>
					</button>
				</div>
			</div>

			{/* Sessions container with tabs */}
			<div className="flex-1 min-h-0 flex flex-col">
				{sessions.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-center py-8">
						<div className="border border-dashed border-border/40 rounded px-6 py-4">
							<div className="text-[20px] text-muted-foreground/30 mb-2">○ ○ ○</div>
							<div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40">
								NO SESSIONS
							</div>
							<div className="text-[10px] text-muted-foreground/30 mt-1">Agent idle</div>
						</div>
					</div>
				) : (
					<>
						{/* Session tabs - only show if multiple sessions */}
						{sessions.length > 1 && (
							<div className="shrink-0 flex border-b border-border/30 bg-secondary/20">
								{sessions.map((session) => {
									const isActive = session.sessionId === activeSessionId;
									const isLiveSession = session.sessionId === member.session.activeSessionId;
									const hasRunning = session.runs.some((r) => r.status === "running");

									return (
										<button
											key={session.sessionId}
											onClick={() => setActiveSessionId(session.sessionId)}
											className={cn(
												"flex items-center gap-1.5 px-3 py-2 text-[9px] font-mono border-b-2 transition-colors",
												isActive
													? "border-current bg-secondary/40"
													: "border-transparent hover:bg-secondary/30 text-muted-foreground/60",
												isActive && isLiveSession && "text-emerald-400",
												isActive && !isLiveSession && "text-foreground/80",
											)}
										>
											{isLiveSession && hasRunning && (
												<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
											)}
											{isLiveSession && !hasRunning && (
												<span className="w-1.5 h-1.5 rounded-full bg-emerald-400/50" />
											)}
											<span>{session.sessionId.slice(0, 8)}</span>
										</button>
									);
								})}
							</div>
						)}

						{/* Active session card */}
						{activeSession && (
							<SessionCard
								key={activeSession.sessionId}
								sessionId={activeSession.sessionId}
								runs={activeSession.runs}
								roleColor={roleColor}
								workItemId={workItemId}
								roleName={member.roleName}
								onRunSubmitted={onRunSubmitted}
							/>
						)}
					</>
				)}
			</div>
		</div>
	);
}
