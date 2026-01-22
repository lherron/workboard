/**
 * ConciergePanel - the main chat drawer for the UI concierge.
 *
 * Features:
 * - Slide-in/out animation from right edge
 * - Header with title, session badge, new chat, close
 * - Scrollable event timeline using RunCard
 * - ChatInput footer with Enter-to-submit
 */

import { ChatInput } from "@/components/chat/ChatInput";
import { RunCard } from "@/components/chat/RunCard";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useCpSessionStream } from "@/hooks/useCpSessionStream";
import { detectLiveRun, groupEventsByRun } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { Loader2, MessageSquarePlus, Pin, PinOff, Radio, WifiOff, X } from "lucide-react";
import { useMemo } from "react";
import { useConcierge } from "./useConcierge";

const PANEL_WIDTH = 380;
const THEME_COLOR = "#f59e0b"; // amber for concierge

export function ConciergePanel() {
	const {
		isOpen,
		isPinned,
		sessionId,
		isConnecting: isLoadingRoster,
		isSubmitting,
		runs,
		error: rosterError,
		close,
		togglePin,
		submit,
		newChat,
		refresh,
	} = useConcierge();

	// SSE connection for live events
	const {
		entries = [],
		isConnected,
		isConnecting: isConnectingSSE,
		error: sseError,
	} = useCpSessionStream({
		sessionId,
		enabled: isOpen && !!sessionId,
		maxEvents: 500,
	});

	// Sort entries by sequence
	const sortedEntries = useMemo(
		() => [...(entries || [])].sort((a, b) => a.seq - b.seq),
		[entries],
	);

	// Group events by run
	const runGroups = useMemo(() => groupEventsByRun(sortedEntries, runs), [sortedEntries, runs]);

	// Detect if any run is live
	const hasLiveRun = useMemo(() => detectLiveRun(runs, sortedEntries), [runs, sortedEntries]);

	// Auto-scroll on new entries
	const { scrollRef, scrollToBottom } = useAutoScroll({
		dependency: entries?.length ?? 0,
		resetKey: sessionId,
	});

	// Handle prompt submission
	const handleSubmit = async (prompt: string) => {
		if (!prompt.trim() || isSubmitting || hasLiveRun) return;

		scrollToBottom();
		await submit(prompt);
	};

	// Handle new chat
	const handleNewChat = async () => {
		if (hasLiveRun) return;
		await newChat();
	};

	const isConnecting = isLoadingRoster || isConnectingSSE;
	const error = rosterError || sseError;

	return (
		<>
			{/* Backdrop - subtle overlay when open and not pinned */}
			{isOpen && !isPinned && (
				<div className="fixed inset-0 bg-black/10 z-40 transition-opacity" onClick={close} />
			)}

			{/* Panel */}
			<div
				className={cn(
					"fixed top-0 right-0 h-full z-50",
					"bg-slate-950 border-l border-slate-800/70",
					"flex flex-col",
					"transition-transform duration-300 ease-out",
					"shadow-2xl shadow-black/50",
					isOpen ? "translate-x-0" : "translate-x-full",
				)}
				style={{ width: PANEL_WIDTH }}
			>
				{/* Header */}
				<div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-800/50 bg-slate-900/50">
					<div className="flex items-center gap-3">
						<h2 className="text-[13px] font-bold uppercase tracking-wide text-amber-400">
							UI Concierge
						</h2>

						{/* Connection status */}
						{sessionId && (
							<div className="flex items-center gap-1.5">
								{isConnectingSSE && <Loader2 className="w-3 h-3 text-amber-400/60 animate-spin" />}
								{isConnected && (
									<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
								)}
								{sseError && <WifiOff className="w-3 h-3 text-red-400/60" />}
							</div>
						)}
					</div>

					<div className="flex items-center gap-2">
						{/* Session ID badge */}
						{sessionId && (
							<span className="text-[9px] font-mono text-slate-600 truncate max-w-[80px]">
								{sessionId.slice(0, 8)}...
							</span>
						)}

						{/* New chat button */}
						<button
							onClick={handleNewChat}
							disabled={hasLiveRun || isSubmitting}
							className={cn(
								"p-1.5 rounded transition-colors",
								"text-slate-500 hover:text-amber-400 hover:bg-slate-800",
								"disabled:opacity-40 disabled:cursor-not-allowed",
							)}
							title="New chat"
						>
							<MessageSquarePlus className="w-4 h-4" />
						</button>

						{/* Pin button */}
						<button
							onClick={togglePin}
							className={cn(
								"p-1.5 rounded transition-colors",
								isPinned
									? "text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
									: "text-slate-500 hover:text-slate-300 hover:bg-slate-800",
							)}
							title={isPinned ? "Unpin panel" : "Pin panel"}
						>
							{isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
						</button>

						{/* Close button */}
						<button
							onClick={close}
							className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
							title="Close panel"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
				</div>

				{/* Stats row */}
				{sessionId && (
					<div className="shrink-0 px-4 py-1.5 flex items-center gap-4 text-[9px] text-slate-500 border-b border-slate-800/30">
						<span>{runs.length} runs</span>
						<span>{entries?.length ?? 0} events</span>
						{hasLiveRun && (
							<span className="inline-flex items-center gap-1 text-amber-400/80">
								<Radio className="w-2.5 h-2.5" />
								<span className="animate-pulse">Live</span>
							</span>
						)}
					</div>
				)}

				{/* Body - scrollable event timeline */}
				<div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
					{!sessionId ? (
						// Empty state - no session
						<div className="flex flex-col items-center justify-center h-full text-center">
							<div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/10 to-slate-800/50 border border-amber-500/20 flex items-center justify-center mb-4">
								<svg
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									className="text-amber-400/60"
								>
									<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
								</svg>
							</div>
							<p className="text-[12px] text-slate-400 mb-1">No active session</p>
							<p className="text-[10px] text-slate-600">Send a message to start a conversation</p>
						</div>
					) : sortedEntries.length === 0 ? (
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
								<RunCard
									key={`${group.runId}-${groupIndex}`}
									run={group.run}
									runId={group.runId}
									events={group.events}
									themeColor={THEME_COLOR}
									isFirst={groupIndex === 0}
								/>
							))}

							{/* Live indicator at bottom */}
							{hasLiveRun && (
								<div className="flex items-center gap-2 py-2 text-[10px] text-amber-400/70">
									<span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
									<span className="animate-pulse">Streaming...</span>
								</div>
							)}
						</div>
					)}

					{/* Error display */}
					{error && (
						<div className="mt-4 p-3 rounded border border-red-500/30 bg-red-500/5">
							<p className="text-[10px] text-red-400 font-mono">{error.message}</p>
							<button
								onClick={refresh}
								className="mt-2 text-[9px] text-red-400/70 hover:text-red-400 underline"
							>
								Retry
							</button>
						</div>
					)}
				</div>

				{/* Footer - input */}
				<ChatInput
					placeholder="Ask the concierge..."
					onSubmit={handleSubmit}
					isSubmitting={isSubmitting}
					disabled={hasLiveRun}
					disabledMessage={hasLiveRun ? "Run in progress..." : undefined}
					submitKey="enter"
					variant="default"
					autoFocus={isOpen}
				/>
			</div>
		</>
	);
}
