/**
 * SpecChatPane - Architect chat interface for spec editing.
 *
 * Uses the same component patterns as ConciergePanel:
 * - ChatInput for message input
 * - RunCard for event display
 * - useAutoScroll for auto-scrolling
 * - groupEventsByRun for event organization
 *
 * Adds spec-specific mutation handling (apply/discard/undo).
 */

import { ChatInput } from "@/components/chat/ChatInput";
import { RunCard } from "@/components/chat/RunCard";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { detectLiveRun, groupEventsByRun } from "@/lib/chat";
import { cn } from "@/lib/utils";
import type { SpecDocument } from "@workboard/shared";
import {
	AlertTriangle,
	CheckCircle,
	Loader2,
	Radio,
	RefreshCw,
	Undo2,
	Wifi,
	WifiOff,
	XCircle,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type MutationStatus, useArchitectChat } from "./hooks/useArchitectChat";

const THEME_COLOR = "#22d3ee"; // cyan for architect

type Props = {
	workspaceId: string;
	spec: SpecDocument | null;
	onSpecUpdate: (spec: SpecDocument) => void;
	onSaveComplete: (spec: SpecDocument) => void;
	onConflict?: () => void;
};

function loadAutoApplyPreference(): boolean {
	try {
		if (typeof window === "undefined") return false;
		const raw = window.localStorage.getItem("specWriter.autoApplyMutations");
		return raw === "true";
	} catch {
		return false;
	}
}

function persistAutoApplyPreference(value: boolean) {
	try {
		if (typeof window === "undefined") return;
		window.localStorage.setItem("specWriter.autoApplyMutations", value ? "true" : "false");
	} catch {
		// ignore
	}
}

/**
 * Mutation actions component - shown below RunCard when mutations are available
 */
function MutationActions({
	mutationCount,
	status,
	onApply,
	onDiscard,
}: {
	mutationCount: number;
	status: MutationStatus;
	onApply: () => void;
	onDiscard: () => void;
}) {
	return (
		<div className="flex items-center gap-2 mt-2 ml-2 text-[10px] font-mono">
			{status.state === "saved" ? (
				<span className="flex items-center gap-1 text-emerald-400">
					<CheckCircle size={10} />
					<span>
						{mutationCount} mutation{mutationCount !== 1 ? "s" : ""} applied
					</span>
				</span>
			) : status.state === "applying" ? (
				<span className="flex items-center gap-1 text-cyan-400">
					<Loader2 size={10} className="animate-spin" />
					<span>applying…</span>
				</span>
			) : status.state === "discarded" ? (
				<span className="flex items-center gap-1 text-slate-500">
					<XCircle size={10} />
					<span>discarded</span>
				</span>
			) : status.state === "error" ? (
				<span className="flex items-center gap-1 text-red-400" title={status.error}>
					<AlertTriangle size={10} />
					<span>error</span>
				</span>
			) : (
				<>
					<span className="flex items-center gap-1 text-amber-400">
						<Zap size={10} />
						<span>
							{mutationCount} mutation{mutationCount !== 1 ? "s" : ""} proposed
						</span>
					</span>
					<button
						type="button"
						onClick={onApply}
						className="px-1.5 py-0.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 transition-colors"
					>
						apply
					</button>
					<button
						type="button"
						onClick={onDiscard}
						className="px-1.5 py-0.5 bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:bg-slate-700/60 transition-colors"
					>
						discard
					</button>
				</>
			)}
		</div>
	);
}

/**
 * Right pane for architect chat interface.
 * Maintains session continuity and can apply spec mutations.
 */
export function SpecChatPane({
	workspaceId,
	spec,
	onSpecUpdate,
	onSaveComplete,
	onConflict,
}: Props) {
	const [autoApply, setAutoApply] = useState(loadAutoApplyPreference);

	const {
		entries,
		runs,
		isConnected,
		isConnecting,
		error,
		mutationError,
		sendMessage,
		isSending,
		applyMutationsForKey,
		discardMutationsForKey,
		canUndo,
		undoLastApplied,
		clearMutationError,
		getMutationsForRun,
	} = useArchitectChat({
		workspaceId,
		spec,
		onSpecUpdate,
		onSaveComplete,
		onConflict,
		autoApplyMutations: autoApply,
	});

	// Persist preference
	useEffect(() => {
		persistAutoApplyPreference(autoApply);
	}, [autoApply]);

	// Group events by run (like ConciergePanel)
	const runGroups = useMemo(() => groupEventsByRun(entries, runs), [entries, runs]);

	// Detect if any run is live
	const hasLiveRun = useMemo(() => detectLiveRun(runs, entries), [runs, entries]);

	// Auto-scroll on new entries
	const { scrollRef, scrollToBottom } = useAutoScroll({
		dependency: entries.length,
		resetKey: spec?.metadata.sessionId,
	});

	// Handle prompt submission
	const handleSubmit = useCallback(
		async (prompt: string) => {
			if (!prompt.trim() || isSending || hasLiveRun) return;
			scrollToBottom();
			await sendMessage(prompt);
		},
		[isSending, hasLiveRun, scrollToBottom, sendMessage],
	);

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

					{/* Undo button */}
					<button
						type="button"
						onClick={() => void undoLastApplied()}
						disabled={!canUndo}
						className={cn(
							"p-1.5 rounded transition-colors",
							"text-slate-500 hover:text-cyan-400 hover:bg-slate-800",
							"disabled:opacity-40 disabled:cursor-not-allowed",
						)}
						title="Undo last applied mutation"
					>
						<Undo2 className="w-4 h-4" />
					</button>

					{/* Auto-apply toggle */}
					<button
						type="button"
						onClick={() => setAutoApply((v) => !v)}
						className={cn(
							"p-1.5 rounded transition-colors",
							autoApply
								? "text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20"
								: "text-slate-500 hover:text-slate-300 hover:bg-slate-800",
						)}
						title={autoApply ? "Auto-apply: ON" : "Auto-apply: OFF"}
					>
						<Zap className="w-4 h-4" />
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
						{runGroups.map((group, groupIndex) => {
							const mutationInfo = getMutationsForRun(group.runId);

							return (
								<div key={`${group.runId}-${groupIndex}`}>
									<RunCard
										run={group.run}
										runId={group.runId}
										events={group.events}
										themeColor={THEME_COLOR}
										isFirst={groupIndex === 0}
									/>

									{/* Mutation actions (if this run has mutations) */}
									{mutationInfo && (
										<MutationActions
											mutationCount={mutationInfo.mutations.length}
											status={mutationInfo.status}
											onApply={() => void applyMutationsForKey(mutationInfo.mutationKey)}
											onDiscard={() => discardMutationsForKey(mutationInfo.mutationKey)}
										/>
									)}
								</div>
							);
						})}

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

				{/* Mutation save error display */}
				{mutationError && (
					<div
						className={cn(
							"mt-4 p-3 rounded border flex items-start gap-2",
							mutationError.isConflict
								? "border-amber-500/30 bg-amber-500/5"
								: "border-red-500/30 bg-red-500/5",
						)}
					>
						<AlertTriangle
							size={14}
							className={cn(
								"shrink-0 mt-0.5",
								mutationError.isConflict ? "text-amber-400" : "text-red-400",
							)}
						/>
						<div className="flex-1 min-w-0">
							<p
								className={cn(
									"text-[10px] font-mono",
									mutationError.isConflict ? "text-amber-400" : "text-red-400",
								)}
							>
								{mutationError.isConflict
									? "Changes were not saved - spec was modified externally."
									: mutationError.message}
							</p>
							{mutationError.isConflict && onConflict && (
								<button
									type="button"
									onClick={() => {
										clearMutationError();
										onConflict();
									}}
									className="flex items-center gap-1 mt-2 px-2 py-0.5 text-[9px] font-mono bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-colors"
								>
									<RefreshCw size={10} />
									<span>Reload</span>
								</button>
							)}
						</div>
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
				submitKey="cmd-enter"
				variant="minimal"
				autoFocus={false}
			/>
		</div>
	);
}
