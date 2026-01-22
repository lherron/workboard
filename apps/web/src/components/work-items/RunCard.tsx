import type { WorkItem, WorkItemRun } from "@/api/client";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

// Extended work item with latest run info
type WorkItemWithRun = WorkItem & {
	latestRun: WorkItemRun | null;
	latestRunStatus: string | null;
};

type RunCardProps = {
	workItem: WorkItemWithRun;
	isSelected?: boolean;
	onClick: () => void;
	onDoubleClick: () => void;
	selectionScrollBehavior?: ScrollBehavior;
};

// Run status display configuration - industrial color coding
const runStatusConfig: Record<
	string,
	{ label: string; color: string; bg: string; glow: string; pulse?: boolean }
> = {
	queued: {
		label: "QUEUED",
		color: "text-cyan-300",
		bg: "bg-cyan-500/10",
		glow: "shadow-[0_0_12px_rgba(34,211,238,0.15)]",
	},
	launched: {
		label: "LAUNCHED",
		color: "text-cyan-300",
		bg: "bg-cyan-500/10",
		glow: "shadow-[0_0_12px_rgba(34,211,238,0.15)]",
	},
	running: {
		label: "RUNNING",
		color: "text-emerald-300",
		bg: "bg-emerald-500/15",
		glow: "shadow-[0_0_20px_rgba(52,211,153,0.25)]",
		pulse: true,
	},
	completed: {
		label: "COMPLETE",
		color: "text-zinc-400",
		bg: "bg-zinc-500/10",
		glow: "",
	},
	failed: {
		label: "FAILED",
		color: "text-red-400",
		bg: "bg-red-500/15",
		glow: "shadow-[0_0_16px_rgba(239,68,68,0.2)]",
	},
	error: {
		label: "ERROR",
		color: "text-red-400",
		bg: "bg-red-500/15",
		glow: "shadow-[0_0_16px_rgba(239,68,68,0.2)]",
	},
	timed_out: {
		label: "TIMEOUT",
		color: "text-orange-400",
		bg: "bg-orange-500/15",
		glow: "shadow-[0_0_12px_rgba(251,146,60,0.15)]",
	},
	cancelled: {
		label: "CANCELLED",
		color: "text-zinc-500",
		bg: "bg-zinc-600/10",
		glow: "",
	},
};

// Default for not started
const notStartedConfig: {
	label: string;
	color: string;
	bg: string;
	glow: string;
	pulse?: boolean;
} = {
	label: "PENDING",
	color: "text-zinc-400",
	bg: "bg-zinc-800/30",
	glow: "",
};

function formatDuration(startTime: number): string {
	const now = Date.now();
	const seconds = Math.floor((now - startTime) / 1000);

	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
	return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
	});
}

export function RunCard({
	workItem,
	isSelected = false,
	onClick,
	onDoubleClick,
	selectionScrollBehavior = "smooth",
}: RunCardProps) {
	const cardRef = useRef<HTMLDivElement>(null);
	const runStatus = workItem.latestRunStatus;
	const latestRun = workItem.latestRun;
	const statusConfig = runStatus
		? runStatusConfig[runStatus] || runStatusConfig.queued
		: notStartedConfig;

	// Scroll into view when selected
	useEffect(() => {
		if (isSelected && cardRef.current) {
			cardRef.current.scrollIntoView({
				behavior: selectionScrollBehavior,
				block: "nearest",
			});
		}
	}, [isSelected, selectionScrollBehavior]);

	// Determine accent color for top bar
	const getAccentClass = () => {
		if (!runStatus) return "bg-zinc-600/50";
		switch (runStatus) {
			case "running":
				return "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500";
			case "queued":
			case "launched":
				return "bg-gradient-to-r from-cyan-500/60 via-cyan-400/80 to-cyan-500/60";
			case "completed":
				return "bg-zinc-600/50";
			case "failed":
			case "error":
				return "bg-gradient-to-r from-red-500/80 via-red-400 to-red-500/80";
			case "timed_out":
				return "bg-gradient-to-r from-orange-500/70 via-orange-400/90 to-orange-500/70";
			case "cancelled":
				return "bg-zinc-700/50";
			default:
				return "bg-zinc-600/50";
		}
	};

	// Get status dot color
	const getStatusDotClass = () => {
		if (!runStatus) return "bg-zinc-500";
		switch (runStatus) {
			case "running":
				return "bg-emerald-400 animate-pulse";
			case "queued":
			case "launched":
				return "bg-cyan-400";
			case "completed":
				return "bg-zinc-500";
			case "failed":
			case "error":
				return "bg-red-400";
			case "timed_out":
				return "bg-orange-400";
			case "cancelled":
				return "bg-zinc-600";
			default:
				return "bg-zinc-500";
		}
	};

	return (
		<div
			ref={cardRef}
			onClick={onClick}
			onDoubleClick={onDoubleClick}
			className={cn(
				"group relative cursor-pointer transition-all duration-150",
				// Base card styling - sharp industrial edges
				"border border-border/40",
				statusConfig.bg,
				// Glow effect based on status
				statusConfig.glow,
				// Selected state - sharp amber highlight
				isSelected
					? "ring-1 ring-amber-400/60 border-amber-500/50 bg-amber-500/[0.08]"
					: "hover:border-border/60 hover:bg-secondary/40",
				// Pulse animation for running
				statusConfig.pulse && "animate-pulse-subtle",
			)}
		>
			{/* Top accent bar - status colored */}
			<div className={cn("absolute top-0 left-0 right-0 h-[2px]", getAccentClass())} />

			<div className="px-3 py-2.5">
				{/* Header row: Status badge + Duration/Time */}
				<div className="flex items-center justify-between gap-2 mb-2">
					{/* Status badge - industrial style */}
					<div
						className={cn(
							"flex items-center gap-1.5 px-2 py-0.5",
							"border text-[9px] font-bold tracking-wider uppercase",
							statusConfig.color,
							!runStatus && "border-zinc-600/30",
							runStatus === "running" && "border-emerald-500/40",
							runStatus === "queued" && "border-cyan-500/30",
							runStatus === "launched" && "border-cyan-500/30",
							runStatus === "completed" && "border-zinc-600/30",
							runStatus === "failed" && "border-red-500/40",
							runStatus === "error" && "border-red-500/40",
							runStatus === "timed_out" && "border-orange-500/40",
							runStatus === "cancelled" && "border-zinc-600/30",
						)}
					>
						{/* Status indicator dot */}
						<span className={cn("w-1.5 h-1.5 rounded-full", getStatusDotClass())} />
						{statusConfig.label}
					</div>

					{/* Duration / Time */}
					{latestRun ? (
						<span className="text-[9px] font-mono text-muted-foreground/60 tabular-nums">
							{runStatus === "running" || runStatus === "queued" || runStatus === "launched"
								? formatDuration(latestRun.createdAt)
								: formatTime(latestRun.completedAt || latestRun.createdAt)}
						</span>
					) : (
						<span className="text-[9px] font-mono text-muted-foreground/40 tabular-nums">
							{formatTime(workItem.createdAt)}
						</span>
					)}
				</div>

				{/* Work item info */}
				<div className="mb-2">
					{/* Project badge */}
					<span className="text-[9px] font-mono text-muted-foreground/50 bg-secondary/60 px-1.5 py-0.5 border border-border/30">
						{workItem.projectId}
					</span>
				</div>

				{/* Task state (cached) */}
				{workItem.taskStateCache && (
					<div className="flex items-center gap-2 mb-2">
						<span className="text-[9px] text-muted-foreground/50">Task:</span>
						<span className="text-[10px] text-muted-foreground/70 capitalize">
							{workItem.taskStateCache}
						</span>
					</div>
				)}

				{/* Run role/kind info */}
				{latestRun && (latestRun.roleName || latestRun.kind) && (
					<div className="flex items-center gap-2 flex-wrap mb-2">
						{latestRun.roleName && (
							<span className="text-[9px] font-medium px-1.5 py-0.5 bg-primary/10 text-primary/80 border border-primary/20">
								{latestRun.roleName}
							</span>
						)}
						{latestRun.kind && (
							<span className="text-[9px] text-muted-foreground/50">{latestRun.kind}</span>
						)}
					</div>
				)}

				{/* IDs row */}
				<div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground/40">
					<span className="truncate max-w-[120px]" title={workItem.workItemId}>
						WI:{workItem.workItemId.slice(0, 8)}
					</span>
					{latestRun && (
						<span className="truncate max-w-[100px]" title={latestRun.runId}>
							RUN:{latestRun.runId.slice(0, 8)}
						</span>
					)}
				</div>
			</div>

			{/* Quick action: Open detail modal */}
			<button
				onClick={(e) => {
					e.stopPropagation();
					onDoubleClick();
				}}
				className={cn(
					"absolute bottom-2 right-2 p-1 rounded",
					"opacity-0 group-hover:opacity-100 transition-opacity",
					"text-muted-foreground/40 hover:text-primary hover:bg-primary/10",
					isSelected && "opacity-100",
				)}
				title="View details"
			>
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="M12 16v-4M12 8h.01" />
				</svg>
			</button>
		</div>
	);
}
