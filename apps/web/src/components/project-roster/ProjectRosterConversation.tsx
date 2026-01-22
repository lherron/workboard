/**
 * ProjectRosterConversation displays a project roster member's conversation.
 *
 * Features:
 * - Multi-session tabs (active + historical)
 * - Live streaming via SSE
 * - Role-based styling
 * - Session lifecycle actions (new chat, clear)
 *
 * Uses shared chat modules for run grouping, auto-scroll, and run display.
 */

import { askProject, clearProjectRoleSession, submitProjectRoleTurn } from "@/api/client";
import { ChatInput } from "@/components/chat/ChatInput";
import { RunCard } from "@/components/chat/RunCard";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useCpSessionStream } from "@/hooks/useCpSessionStream";
import { detectLiveRun, groupEventsByRun } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { MessageSquarePlus, Radio, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MemberWithRuns } from "./ProjectRosterView";

type ProjectRosterConversationProps = {
	projectId: string;
	memberWithRuns: MemberWithRuns;
	onRefresh: () => void;
};

export function ProjectRosterConversation({
	projectId,
	memberWithRuns,
	onRefresh,
}: ProjectRosterConversationProps) {
	const { member, sessions, roleColor } = memberWithRuns;
	const activeSessionId = member.session.activeSessionId;

	// Track selected session tab - default to active session
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
		activeSessionId ?? sessions[0]?.sessionId ?? null,
	);

	// Track previous member to detect member changes
	const prevMemberIdRef = useRef(member.memberId);

	// Reset selected session when member changes (not on every render)
	useEffect(() => {
		if (prevMemberIdRef.current !== member.memberId) {
			prevMemberIdRef.current = member.memberId;
			setSelectedSessionId(activeSessionId ?? sessions[0]?.sessionId ?? null);
		}
	}, [member.memberId, activeSessionId, sessions]);

	// Track pending session ID (set by submit, before refresh completes)
	const pendingSessionIdRef = useRef<string | null>(null);

	// Update selected tab when sessions change (e.g., new session created)
	// But only if the current selection is truly invalid (not a pending new session)
	useEffect(() => {
		// If we're waiting for a new session to appear, don't reset
		if (pendingSessionIdRef.current === selectedSessionId) {
			// Check if it's now in sessions
			if (sessions.find((s) => s.sessionId === selectedSessionId)) {
				pendingSessionIdRef.current = null;
			}
			return;
		}

		if (
			selectedSessionId !== null &&
			sessions.length > 0 &&
			!sessions.find((s) => s.sessionId === selectedSessionId)
		) {
			setSelectedSessionId(activeSessionId ?? sessions[0]?.sessionId ?? null);
		}
	}, [sessions, selectedSessionId, activeSessionId]);

	const selectedSession = sessions.find((s) => s.sessionId === selectedSessionId) ?? sessions[0];
	const runs = selectedSession?.runs ?? [];

	// SSE connection for selected session's live events
	const {
		entries = [],
		isConnected,
		isConnecting,
		error,
	} = useCpSessionStream({
		sessionId: selectedSessionId,
		enabled: !!selectedSessionId,
		maxEvents: 500,
	});

	// Sort and group events
	const sortedEntries = useMemo(
		() => [...(entries || [])].sort((a, b) => a.seq - b.seq),
		[entries],
	);

	// Convert runs to simpler format for grouping
	const runsForGrouping = useMemo(
		() =>
			runs.map((r) => ({
				runId: r.runId,
				status: r.status,
				createdAt: r.createdAt,
				completedAt: r.completedAt,
			})),
		[runs],
	);

	const runGroups = useMemo(
		() => groupEventsByRun(sortedEntries, runsForGrouping),
		[sortedEntries, runsForGrouping],
	);

	// Detect live run in selected session
	const hasLiveRun = useMemo(
		() => detectLiveRun(runsForGrouping, sortedEntries),
		[runsForGrouping, sortedEntries],
	);

	// Check if selected session is the active one
	const isActiveSession = selectedSessionId === activeSessionId;

	// Auto-scroll on new entries
	const { scrollRef, scrollToBottom } = useAutoScroll({
		dependency: entries?.length ?? 0,
		resetKey: selectedSessionId ?? undefined,
	});

	// Prompt submission
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmitPrompt = async (prompt: string) => {
		if (!prompt.trim() || isSubmitting) return;

		setIsSubmitting(true);
		try {
			// Scroll to bottom immediately so user can see new content arrive
			scrollToBottom();

			// Use /ask for oracle, /turn for other roles
			const isOracle = member.roleName.toLowerCase() === "oracle";
			let response: { sessionId?: string };
			if (isOracle) {
				response = await askProject(projectId, prompt.trim());
			} else {
				response = await submitProjectRoleTurn(projectId, member.roleName, prompt.trim());
			}

			// Switch to the new session
			if (response.sessionId) {
				pendingSessionIdRef.current = response.sessionId;
				setSelectedSessionId(response.sessionId);
			}

			onRefresh();
		} catch (err) {
			console.error("Failed to submit prompt:", err);
		} finally {
			setIsSubmitting(false);
		}
	};

	// Clear session
	const [isClearing, setIsClearing] = useState(false);

	const handleClearSession = async () => {
		if (isClearing) return;

		setIsClearing(true);
		try {
			await clearProjectRoleSession(projectId, member.roleName);
			onRefresh();
		} catch (err) {
			console.error("Failed to clear session:", err);
		} finally {
			setIsClearing(false);
		}
	};

	// New chat - clears session if exists, next message starts fresh
	const [isStartingNew, setIsStartingNew] = useState(false);

	const handleNewChat = async () => {
		if (isStartingNew || hasLiveRun) return;

		setIsStartingNew(true);
		try {
			// Clear existing session if there is one
			if (activeSessionId) {
				await clearProjectRoleSession(projectId, member.roleName);
			}
			// Switch to "new session" view
			setSelectedSessionId(null);
			onRefresh();
		} catch (err) {
			console.error("Failed to start new chat:", err);
		} finally {
			setIsStartingNew(false);
		}
	};

	const isOracle = member.roleName.toLowerCase() === "oracle";

	return (
		<div className="flex flex-col h-full">
			{/* Conversation header */}
			<div className="shrink-0 px-4 py-3 border-b border-indigo-900/30 bg-indigo-950/20">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						{/* Role indicator */}
						<div
							className="w-3 h-3 rounded-full"
							style={{
								backgroundColor: roleColor,
								boxShadow: `0 0 12px ${roleColor}40`,
							}}
						/>
						<div>
							<h2
								className={cn(
									"text-[13px] font-bold uppercase tracking-wide",
									isOracle ? "text-[#ff6b9d]" : "text-cyan-100",
								)}
							>
								{member.roleName}
							</h2>
							<p className="text-[9px] text-indigo-300/60 font-mono">
								{member.persona} · {member.model ?? "default"}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3">
						{/* Connection status - only show for active session */}
						{selectedSessionId && isActiveSession && (
							<div className="flex items-center gap-2">
								{isConnecting && (
									<span className="text-[8px] text-cyan-400/70 animate-pulse">connecting...</span>
								)}
								{isConnected && (
									<span className="flex items-center gap-1 text-[8px] text-cyan-400/80">
										<span
											className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse"
											style={{ boxShadow: "0 0 4px #22d3ee" }}
										/>
										live
									</span>
								)}
								{error && (
									<span className="flex items-center gap-1 text-[8px] text-red-400/70">
										<WifiOff className="w-2.5 h-2.5" />
										disconnected
									</span>
								)}
							</div>
						)}

						{/* Actions */}
						<div className="flex items-center gap-1">
							<button
								onClick={onRefresh}
								className="p-1.5 rounded text-indigo-400/60 hover:text-cyan-300 hover:bg-indigo-900/40 transition-colors"
								title="Refresh"
							>
								<RefreshCw className="w-3.5 h-3.5" />
							</button>
							<button
								onClick={handleNewChat}
								disabled={isStartingNew || hasLiveRun}
								className={cn(
									"p-1.5 rounded transition-colors",
									"text-indigo-400/60 hover:text-cyan-400 hover:bg-indigo-900/40",
									"disabled:opacity-40 disabled:cursor-not-allowed",
								)}
								title="New chat"
							>
								<MessageSquarePlus className="w-3.5 h-3.5" />
							</button>
							{activeSessionId && (
								<button
									onClick={handleClearSession}
									disabled={isClearing || hasLiveRun}
									className={cn(
										"p-1.5 rounded transition-colors",
										"text-indigo-400/60 hover:text-red-400 hover:bg-indigo-900/40",
										"disabled:opacity-40 disabled:cursor-not-allowed",
									)}
									title="Clear session"
								>
									<Trash2 className="w-3.5 h-3.5" />
								</button>
							)}
						</div>
					</div>
				</div>

				{/* Stats row */}
				<div className="flex items-center gap-4 mt-2 text-[9px] text-indigo-300/60">
					<span>
						{sessions.length} session{sessions.length !== 1 ? "s" : ""}
					</span>
					<span>{runs.length} runs</span>
					<span>{entries?.length ?? 0} events</span>
					{hasLiveRun && isActiveSession && (
						<span className="inline-flex items-center gap-1 text-cyan-400/80">
							<Radio className="h-2.5 w-2.5" />
							<span className="animate-pulse">Live</span>
						</span>
					)}
				</div>
			</div>

			{/* Session tabs - only show if multiple sessions */}
			{sessions.length > 1 && (
				<div className="shrink-0 flex border-b border-indigo-900/30 bg-indigo-950/10 overflow-x-auto">
					{sessions.map((session) => {
						const isSelected = session.sessionId === selectedSessionId;
						const isActive = session.isActive;
						const hasRunning = session.runs.some((r) => r.status === "running");

						return (
							<button
								key={session.sessionId}
								onClick={() => setSelectedSessionId(session.sessionId)}
								className={cn(
									"flex items-center gap-1.5 px-3 py-2 text-[9px] font-mono border-b-2 transition-colors whitespace-nowrap",
									isSelected
										? "border-current bg-indigo-900/30"
										: "border-transparent hover:bg-indigo-900/20 text-indigo-400/60",
									isSelected && isActive && "text-cyan-400",
									isSelected && !isActive && "text-cyan-200/70",
								)}
							>
								{isActive && hasRunning && (
									<span
										className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"
										style={{ boxShadow: "0 0 4px #22d3ee" }}
									/>
								)}
								{isActive && !hasRunning && (
									<span className="w-1.5 h-1.5 rounded-full bg-cyan-400/50" />
								)}
								<span>{session.sessionId.slice(0, 8)}</span>
								{isActive && <span className="text-[7px] text-cyan-400/60 ml-1">ACTIVE</span>}
							</button>
						);
					})}
				</div>
			)}

			{/* Events timeline */}
			<div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
				{!selectedSessionId ? (
					<div className="flex flex-col items-center justify-center h-full text-center py-8">
						<div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/10 to-indigo-900/40 border border-cyan-500/20 flex items-center justify-center mb-4 relative overflow-hidden">
							<div className="absolute inset-0 bg-gradient-to-tr from-cyan-400/5 to-transparent" />
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								className="text-cyan-400/60 relative z-10"
							>
								<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
							</svg>
						</div>
						<p className="text-[12px] text-cyan-200/70 mb-1">No active session</p>
						<p className="text-[10px] text-indigo-400/50">Send a message to start a conversation</p>
					</div>
				) : sortedEntries.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-center py-8">
						<div className="border border-dashed border-indigo-700/30 rounded-lg px-6 py-4 bg-indigo-950/10">
							<div className="text-[20px] text-cyan-400/30 mb-2">○ ○ ○</div>
							<div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300/70">
								{isConnecting ? "CONNECTING..." : "AWAITING EVENTS"}
							</div>
							<div className="text-[10px] text-indigo-400/50 mt-1">
								{isConnecting ? "Establishing connection" : "Session is idle"}
							</div>
						</div>
					</div>
				) : (
					<div className="space-y-1">
						{runGroups.map((group, groupIndex) => (
							<RunCard
								key={`${group.runId}-${groupIndex}`}
								run={group.run}
								runId={group.runId}
								events={group.events}
								themeColor={roleColor}
								isFirst={groupIndex === 0}
							/>
						))}
					</div>
				)}
			</div>

			{/* Input area - only show for active session */}
			{isActiveSession ? (
				<ChatInput
					placeholder={isOracle ? "Ask the oracle..." : `Message ${member.roleName}...`}
					isSubmitting={isSubmitting}
					disabled={hasLiveRun}
					onSubmit={handleSubmitPrompt}
					submitKey="enter"
					variant="default"
				/>
			) : (
				<div className="shrink-0 px-4 py-3 border-t border-indigo-900/30 bg-indigo-950/20">
					<div className="flex items-center justify-center gap-2 text-[10px] text-indigo-300/60">
						<span>Viewing historical session</span>
						<button
							onClick={() => setSelectedSessionId(activeSessionId)}
							className="text-cyan-400 hover:text-cyan-300 transition-colors"
						>
							Switch to active →
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
