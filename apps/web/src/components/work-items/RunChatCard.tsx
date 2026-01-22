import type { WorkItemRun } from "@/api/client";
import { useCpSessionStream } from "@/hooks/useCpSessionStream";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { EventBlock } from "./EventBlock";

type RunChatCardProps = {
	run: WorkItemRun;
	runIndex: number;
	roleColor: string;
	isLatest?: boolean;
};

// Run status configuration
const statusStyles: Record<
	string,
	{ label: string; bg: string; text: string; border: string; pulse?: boolean }
> = {
	queued: {
		label: "QUEUED",
		bg: "bg-cyan-500/10",
		text: "text-cyan-300",
		border: "border-cyan-500/40",
	},
	running: {
		label: "RUNNING",
		bg: "bg-emerald-500/15",
		text: "text-emerald-300",
		border: "border-emerald-500/40",
		pulse: true,
	},
	completed: {
		label: "COMPLETE",
		bg: "bg-zinc-500/10",
		text: "text-zinc-400",
		border: "border-zinc-500/30",
	},
	failed: {
		label: "FAILED",
		bg: "bg-red-500/15",
		text: "text-red-400",
		border: "border-red-500/40",
	},
	cancelled: {
		label: "CANCELLED",
		bg: "bg-zinc-600/10",
		text: "text-zinc-500",
		border: "border-zinc-600/30",
	},
	timed_out: {
		label: "TIMEOUT",
		bg: "bg-orange-500/15",
		text: "text-orange-400",
		border: "border-orange-500/40",
	},
	launched: {
		label: "LAUNCHED",
		bg: "bg-cyan-500/10",
		text: "text-cyan-300",
		border: "border-cyan-500/40",
	},
};

const defaultStatusStyle = {
	label: "UNKNOWN",
	bg: "bg-zinc-700/20",
	text: "text-zinc-400",
	border: "border-zinc-600/30",
};

// Kind badge colors
const kindStyles: Record<string, string> = {
	coord: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
	triage: "bg-amber-500/20 text-amber-300 border-amber-500/30",
	implement: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
	review: "bg-violet-500/20 text-violet-300 border-violet-500/30",
	test: "bg-pink-500/20 text-pink-300 border-pink-500/30",
	fix: "bg-red-500/20 text-red-300 border-red-500/30",
	refactor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
};

function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function formatDuration(startMs: number, endMs?: number): string {
	const end = endMs ?? Date.now();
	const seconds = Math.floor((end - startMs) / 1000);
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	return `${hours}h ${mins}m`;
}

export function RunChatCard({ run, runIndex, roleColor, isLatest = false }: RunChatCardProps) {
	const statusStyle = statusStyles[run.status] ?? defaultStatusStyle;
	const kindStyle = kindStyles[run.kind ?? ""] ?? "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
	const isRunning = run.status === "running";

	// Connect to SSE stream for this run's session
	const { entries } = useCpSessionStream({
		sessionId: run.sessionId ?? null,
		enabled: !!run.sessionId,
		maxEvents: 200,
	});

	// Filter and sort events for this specific run
	const sortedEvents = useMemo(() => {
		const runEvents = entries.filter((e) => e.runId === run.runId);
		return runEvents.sort((a, b) => a.seq - b.seq);
	}, [entries, run.runId]);

	return (
		<div
			className={cn(
				"relative border rounded-sm transition-all",
				statusStyle.bg,
				statusStyle.border,
				isRunning && "animate-streaming-border",
				isLatest && isRunning && "shadow-[0_0_20px_rgba(0,255,157,0.15)]",
			)}
		>
			{/* Run Header */}
			<div className="px-3 py-2 border-b border-border/30">
				{/* Top row: Run ID + badges */}
				<div className="flex items-center justify-between gap-2 mb-2">
					<div className="flex items-center gap-2">
						<span className="text-[10px] font-mono text-muted-foreground/60">RUN #{runIndex}</span>
						<span className="text-[9px] font-mono text-muted-foreground/40">
							{run.runId.slice(0, 8)}
						</span>
					</div>

					{/* Duration */}
					<span className="text-[9px] font-mono text-muted-foreground/50 tabular-nums">
						{formatDuration(run.createdAt, run.completedAt)}
					</span>
				</div>

				{/* Badges row */}
				<div className="flex items-center gap-2 flex-wrap">
					{/* Kind badge */}
					{run.kind && (
						<span
							className={cn(
								"px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border rounded-sm",
								kindStyle,
							)}
						>
							{run.kind}
						</span>
					)}

					{/* Status badge */}
					<span
						className={cn(
							"flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
							statusStyle.bg,
							statusStyle.text,
							statusStyle.border,
						)}
					>
						<span
							className={cn(
								"w-1.5 h-1.5 rounded-full",
								run.status === "running" && "bg-emerald-400 animate-pulse",
								run.status === "queued" && "bg-cyan-400",
								run.status === "completed" && "bg-zinc-500",
								run.status === "failed" && "bg-red-400",
								run.status === "cancelled" && "bg-zinc-600",
								run.status === "timed_out" && "bg-orange-400",
							)}
						/>
						{statusStyle.label}
					</span>
				</div>

				{/* Started timestamp */}
				<div className="mt-2 text-[9px] text-muted-foreground/40">
					Started: {formatTime(run.createdAt)}
					{run.completedAt && ` · Ended: ${formatTime(run.completedAt)}`}
				</div>
			</div>

			{/* Events Timeline (Chat-style) */}
			<div className="px-3 py-2 space-y-2 max-h-[400px] overflow-y-auto">
				{sortedEvents.length === 0 ? (
					<div className="text-[10px] text-muted-foreground/40 italic py-2 text-center">
						{isRunning ? "Waiting for events..." : "No events recorded"}
					</div>
				) : (
					sortedEvents.map((entry, index) => (
						<EventBlock
							key={entry.id}
							entry={entry}
							roleColor={roleColor}
							isNew={entry.source === "live" && index === sortedEvents.length - 1}
						/>
					))
				)}

				{/* Live streaming indicator */}
				{isRunning && (
					<div className="flex items-center gap-2 py-2 text-[10px] text-emerald-400/70">
						<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-live-dot" />
						<span className="animate-pulse">Streaming...</span>
					</div>
				)}
			</div>
		</div>
	);
}
