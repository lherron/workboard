/**
 * SpecChatPane - Architect chat interface for spec editing.
 *
 * Uses the same component patterns as ConciergePanel:
 * - ChatInput for message input
 * - RunCard for event display
 * - useAutoScroll for auto-scrolling
 * - groupEventsByRun for event organization
 *
 * The architect agent updates specs directly via the Control Plane API.
 * This component handles session management and displays the conversation.
 */

import { launchTerminal, updateWorkspaceSpec } from "@/api/client";
import { ChatInput } from "@/components/chat/ChatInput";
import { RunCard } from "@/components/chat/RunCard";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { detectLiveRun, groupEventsByRun } from "@/lib/chat";
import { cn, debugLog } from "@/lib/utils";
import type { SpecDocument } from "@workboard/shared";
import { Loader2, MessageSquarePlus, Radio, Terminal, Wifi, WifiOff } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useArchitectChat } from "./hooks/useArchitectChat";

const THEME_COLOR = "#22d3ee"; // cyan for architect

type Props = {
	workspaceId: string;
	spec: SpecDocument | null;
	onSpecUpdate: (spec: SpecDocument) => void;
};

/**
 * Right pane for architect chat interface.
 * Maintains session continuity - agent updates specs directly via API.
 */
export function SpecChatPane({ workspaceId, spec, onSpecUpdate }: Props) {
	const {
		entries,
		runs,
		isConnected,
		isConnecting,
		error,
		sendMessage,
		isSending,
		harnessSessionId,
	} = useArchitectChat({
		workspaceId,
		spec,
		onSpecUpdate,
	});

	// Group events by run (like ConciergePanel)
	const runGroups = useMemo(() => groupEventsByRun(entries, runs), [entries, runs]);

	// Detect if any run is live
	const hasLiveRun = useMemo(() => {
		const result = detectLiveRun(runs, entries);
		if (result) {
			debugLog("[SpecChatPane]", "hasLiveRun=true", { runCount: runs.length, runs });
		}
		return result;
	}, [runs, entries]);

	// Auto-scroll on new entries
	const { scrollRef, scrollToBottom } = useAutoScroll({
		dependency: entries.length,
		resetKey: spec?.metadata.sessionId,
	});

	// Handle prompt submission
	const handleSubmit = useCallback(
		async (prompt: string) => {
			debugLog("[SpecChatPane]", "handleSubmit called", {
				prompt: prompt.slice(0, 30),
				isSending,
				hasLiveRun,
			});
			if (!prompt.trim() || isSending || hasLiveRun) {
				debugLog("[SpecChatPane]", "Early return", {
					isEmpty: !prompt.trim(),
					isSending,
					hasLiveRun,
				});
				return;
			}
			scrollToBottom();
			await sendMessage(prompt);
		},
		[isSending, hasLiveRun, scrollToBottom, sendMessage],
	);

	// Terminal launch state
	const [isLaunchingTerminal, setIsLaunchingTerminal] = useState(false);

	// New chat loading state
	const [isCreatingNewChat, setIsCreatingNewChat] = useState(false);

	// Handle opening terminal to resume session
	const handleOpenTerminal = useCallback(async () => {
		// Need harness session ID (not CP session ID) for Claude Code resume
		if (!harnessSessionId || hasLiveRun) return;

		setIsLaunchingTerminal(true);
		try {
			await launchTerminal({
				projectId: workspaceId,
				tool: {
					kind: "shell",
					command: `asp run architect --resume ${harnessSessionId}`,
				},
				statusbar: {
					right: `architect@${workspaceId}`,
				},
				foregroundColor: "#cffafe",
				backgroundColor: "#0a1a1a",
			});
		} catch (err) {
			console.error("[SpecChatPane] Failed to open terminal:", err);
		} finally {
			setIsLaunchingTerminal(false);
		}
	}, [workspaceId, harnessSessionId, hasLiveRun]);

	// Handle new chat (clear session from spec)
	const handleNewChat = useCallback(async () => {
		debugLog("[SpecChatPane]", "handleNewChat called", {
			hasSpec: !!spec,
			hasLiveRun,
			isSending,
			isCreatingNewChat,
			sessionId: spec?.metadata.sessionId,
		});

		if (!spec || !spec.metadata.sessionId || hasLiveRun || isSending || isCreatingNewChat) {
			debugLog("[SpecChatPane]", "handleNewChat early return", {
				noSpec: !spec,
				noSession: !spec?.metadata.sessionId,
				hasLiveRun,
				isSending,
				isCreatingNewChat,
			});
			return;
		}

		setIsCreatingNewChat(true);
		try {
			const updatedSpec: SpecDocument = {
				...spec,
				metadata: {
					...spec.metadata,
					sessionId: null,
					updatedAt: Date.now(),
				},
			};
			debugLog("[SpecChatPane]", "Clearing session, calling updateWorkspaceSpec", {
				workspaceId,
				slug: spec.slug,
				rev: spec.rev,
			});
			// Update via API
			const response = await updateWorkspaceSpec(workspaceId, spec.slug, updatedSpec, spec.rev);
			debugLog("[SpecChatPane]", "Session cleared successfully", {
				newRev: response.spec.rev,
				newSessionId: response.spec.metadata.sessionId,
			});
			onSpecUpdate(response.spec);
		} catch (err) {
			console.error("[SpecChatPane] Failed to clear session:", err);
		} finally {
			setIsCreatingNewChat(false);
		}
	}, [spec, workspaceId, hasLiveRun, isSending, isCreatingNewChat, onSpecUpdate]);

	// No spec selected
	if (!spec) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<p className="text-[12px] text-slate-600">Select a spec to start chatting</p>
			</div>
		);
	}

	const sessionId = spec.metadata.sessionId;
	const hasSession = !!sessionId;

	return (
		<div className="flex-1 flex flex-col min-h-0 bg-slate-950">
			{/* Header */}
			<div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-800/50 bg-slate-900/50">
				<div className="flex items-center gap-3">
					<h2 className="text-[13px] font-bold uppercase tracking-wide text-cyan-400">Architect</h2>

					{/* Connection status */}
					{hasSession && (
						<div className="flex items-center gap-1.5">
							{isConnecting && <Loader2 className="w-3 h-3 text-cyan-400/60 animate-spin" />}
							{isConnected && <Wifi className="w-3 h-3 text-emerald-400" />}
							{!isConnected && !isConnecting && <WifiOff className="w-3 h-3 text-slate-500" />}
						</div>
					)}
				</div>

				<div className="flex items-center gap-2">
					{/* Session ID badge */}
					{hasSession && (
						<span className="text-[9px] font-mono text-slate-600 truncate max-w-[80px]">
							{sessionId.slice(0, 8)}...
						</span>
					)}

					{/* Terminal button - resume session in Claude Code */}
					{hasSession && (
						<button
							onClick={handleOpenTerminal}
							disabled={hasLiveRun || isLaunchingTerminal || !harnessSessionId}
							className={cn(
								"p-1.5 rounded transition-colors",
								"text-slate-500 hover:text-cyan-400 hover:bg-slate-800",
								"disabled:opacity-40 disabled:cursor-not-allowed",
							)}
							title="Resume in terminal"
						>
							{isLaunchingTerminal ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<Terminal className="w-4 h-4" />
							)}
						</button>
					)}

					{/* New chat button */}
					<button
						onClick={handleNewChat}
						disabled={!hasSession || hasLiveRun || isSending || isCreatingNewChat}
						className={cn(
							"p-1.5 rounded transition-colors",
							"text-slate-500 hover:text-cyan-400 hover:bg-slate-800",
							"disabled:opacity-40 disabled:cursor-not-allowed",
						)}
						title="New chat"
					>
						{isCreatingNewChat ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<MessageSquarePlus className="w-4 h-4" />
						)}
					</button>
				</div>
			</div>

			{/* Stats row */}
			{hasSession && (
				<div className="shrink-0 px-4 py-1.5 flex items-center gap-4 text-[9px] text-slate-500 border-b border-slate-800/30">
					<span>
						{runs.length} run{runs.length !== 1 ? "s" : ""}
					</span>
					<span>
						{entries.length} event{entries.length !== 1 ? "s" : ""}
					</span>
					{hasLiveRun && (
						<span className="inline-flex items-center gap-1 text-cyan-400/80">
							<Radio className="w-2.5 h-2.5" />
							<span className="animate-pulse">Live</span>
						</span>
					)}
				</div>
			)}

			{/* Body - scrollable event timeline */}
			<div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
				{!hasSession ? (
					// Empty state - no session
					<div className="flex flex-col items-center justify-center h-full text-center">
						<div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/10 to-slate-800/50 border border-cyan-500/20 flex items-center justify-center mb-4">
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								className="text-cyan-400/60"
							>
								<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
							</svg>
						</div>
						<p className="text-[12px] text-slate-400 mb-1">No active session</p>
						<p className="text-[10px] text-slate-600">Send a message to start collaborating</p>
					</div>
				) : entries.length === 0 ? (
					// Session exists but no events yet
					<div className="flex flex-col items-center justify-center h-full text-center">
						<div className="border border-dashed border-slate-700/50 rounded-lg px-6 py-4">
							<div className="text-[20px] text-slate-600 mb-2">...</div>
							<div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
								{isConnecting ? "CONNECTING..." : "AWAITING EVENTS"}
							</div>
							<div className="text-[10px] text-slate-600 mt-1">
								{isConnecting ? "Establishing connection" : "Session is idle"}
							</div>
						</div>
					</div>
				) : (
					// Event timeline
					<div className="space-y-1">
						{runGroups.map((group, groupIndex) => (
							<div key={`${group.runId}-${groupIndex}`}>
								<RunCard
									run={group.run}
									runId={group.runId}
									events={group.events}
									themeColor={THEME_COLOR}
									isFirst={groupIndex === 0}
								/>
							</div>
						))}

						{/* Live indicator at bottom */}
						{hasLiveRun && (
							<div className="flex items-center gap-2 py-2 text-[10px] text-cyan-400/70">
								<span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
								<span className="animate-pulse">Streaming...</span>
							</div>
						)}
					</div>
				)}

				{/* Error display */}
				{error && (
					<div className="mt-4 p-3 rounded border border-red-500/30 bg-red-500/5">
						<p className="text-[10px] text-red-400 font-mono">{error.message}</p>
					</div>
				)}
			</div>

			{/* Footer - input */}
			<ChatInput
				placeholder="Ask the architect..."
				onSubmit={handleSubmit}
				isSubmitting={isSending}
				disabled={hasLiveRun}
				disabledMessage={hasLiveRun ? "Run in progress..." : undefined}
				submitKey="enter"
				variant="minimal"
				autoFocus={false}
			/>
		</div>
	);
}
