/**
 * SessionCard displays a work item session with runs and a prompt input.
 *
 * Uses shared chat modules for run grouping, auto-scroll, and run display.
 */

import { type WorkItemRun, submitWorkItemRun } from "@/api/client";
import { ChatInput } from "@/components/chat/ChatInput";
import { RunCard } from "@/components/chat/RunCard";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useCpSessionStream } from "@/hooks/useCpSessionStream";
import { detectLiveRun, groupEventsByRun } from "@/lib/chat";
import { Radio, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";

type SessionCardProps = {
	sessionId: string;
	runs: WorkItemRun[];
	roleColor: string;
	workItemId: string;
	roleName: string;
	onRunSubmitted?: () => void;
};

export function SessionCard({
	sessionId,
	runs,
	roleColor,
	workItemId,
	roleName,
	onRunSubmitted,
}: SessionCardProps) {
	// Connect to SSE for this session
	const {
		entries = [],
		isConnected,
		isConnecting,
		error,
	} = useCpSessionStream({
		sessionId,
		enabled: true,
		maxEvents: 500,
	});

	// Sort entries by sequence
	const sortedEntries = useMemo(
		() => [...(entries || [])].sort((a, b) => a.seq - b.seq),
		[entries],
	);

	// Group events by run
	const runGroups = useMemo(
		() => groupEventsByRun(sortedEntries, runs || []),
		[sortedEntries, runs],
	);

	// Detect live runs
	const hasLiveRun = useMemo(() => detectLiveRun(runs || [], sortedEntries), [runs, sortedEntries]);

	// Auto-scroll on new entries
	const { scrollRef, scrollToBottom } = useAutoScroll({
		dependency: entries?.length ?? 0,
		resetKey: sessionId,
	});

	const totalEvents = (entries || []).length;

	// Prompt submission
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmitPrompt = async (prompt: string) => {
		if (!prompt.trim() || isSubmitting) return;

		setIsSubmitting(true);
		try {
			// Scroll to bottom immediately so user can see new content arrive
			scrollToBottom();

			// Use "coord" or "impl" as kind based on role
			const kind = roleName === "coordinator" ? "coord" : "impl";
			await submitWorkItemRun(workItemId, sessionId, roleName, kind, prompt.trim());

			// Trigger refetch of runs data
			onRunSubmitted?.();
		} catch (err) {
			console.error(`[SessionCard ${sessionId.slice(0, 8)}] Failed to submit prompt:`, err);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="flex flex-col flex-1 min-h-0">
			{/* Session Header */}
			<div className="shrink-0 px-3 py-1.5 bg-secondary/20 border-b border-border/30">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="text-[9px] font-mono text-muted-foreground/50">SESSION</span>
						<span className="text-[9px] font-mono text-muted-foreground/40">
							{sessionId.slice(0, 8)}
						</span>
					</div>

					{/* Connection status */}
					<div className="flex items-center gap-2">
						{isConnecting && (
							<span className="text-[8px] text-amber-400/70 animate-pulse">connecting...</span>
						)}
						{isConnected && (
							<span className="flex items-center gap-1 text-[8px] text-emerald-400/70">
								<span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
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
				</div>

				{/* Stats row */}
				<div className="flex items-center justify-between mt-1 text-[9px] text-muted-foreground/40">
					<span>{(runs || []).length} runs</span>
					<span>{totalEvents} events</span>

					{hasLiveRun && (
						<span className="inline-flex items-center gap-1 text-emerald-400/80">
							<Radio className="h-2.5 w-2.5" />
							<span className="animate-live-dot">Live</span>
						</span>
					)}
				</div>
			</div>

			{/* Events Timeline - scrollable */}
			<div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
				{sortedEntries.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-center py-8">
						<div className="border border-dashed border-border/40 rounded px-6 py-4">
							<div className="text-[20px] text-muted-foreground/30 mb-2">○ ○ ○</div>
							<div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40">
								{isConnecting ? "CONNECTING..." : "NO EVENTS"}
							</div>
							<div className="text-[10px] text-muted-foreground/30 mt-1">
								{isConnecting ? "Establishing connection" : "Waiting for activity"}
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

			{/* Prompt Input */}
			<ChatInput
				onSubmit={handleSubmitPrompt}
				placeholder="Enter prompt... (Cmd+Enter to send)"
				isSubmitting={isSubmitting}
				disabled={hasLiveRun}
				disabledMessage="Run in progress..."
				submitKey="cmd-enter"
				variant="minimal"
				autoFocus={false}
			/>
		</div>
	);
}
