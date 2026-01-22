import type { WorkItem, WorkItemRun } from "@/api/client";
import { cn } from "@/lib/utils";
import { RunCard } from "./RunCard";

export type ColumnId = "not_started" | "queued" | "running" | "completed" | "stopped";

// Extended work item with latest run info
type WorkItemWithRun = WorkItem & {
	latestRun: WorkItemRun | null;
	latestRunStatus: string | null;
};

type RunColumnProps = {
	id: ColumnId;
	title: string;
	workItems: WorkItemWithRun[];
	selectedWorkItemId: string | null;
	isFocused: boolean;
	onSelectWorkItem: (workItemId: string) => void;
	onOpenModal: (workItem: WorkItemWithRun) => void;
	selectionScrollBehavior?: ScrollBehavior;
};

// Column styling configuration - industrial color coding
const columnConfig: Record<
	ColumnId,
	{
		headerBg: string;
		headerBorder: string;
		headerText: string;
		accentColor: string;
		icon: React.ReactNode;
	}
> = {
	not_started: {
		headerBg: "bg-zinc-800/60",
		headerBorder: "border-zinc-600/40",
		headerText: "text-zinc-400",
		accentColor: "bg-zinc-500",
		icon: (
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			>
				<circle cx="12" cy="12" r="10" opacity="0.4" />
				<path d="M12 8v4" strokeLinecap="round" />
				<circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
			</svg>
		),
	},
	queued: {
		headerBg: "bg-cyan-950/40",
		headerBorder: "border-cyan-500/30",
		headerText: "text-cyan-300",
		accentColor: "bg-cyan-500",
		icon: (
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			>
				<rect x="3" y="4" width="18" height="4" rx="1" />
				<rect x="3" y="10" width="18" height="4" rx="1" opacity="0.6" />
				<rect x="3" y="16" width="18" height="4" rx="1" opacity="0.3" />
			</svg>
		),
	},
	running: {
		headerBg: "bg-emerald-950/40",
		headerBorder: "border-emerald-500/40",
		headerText: "text-emerald-300",
		accentColor: "bg-emerald-500",
		icon: (
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			>
				<circle cx="12" cy="12" r="10" />
				<polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
			</svg>
		),
	},
	completed: {
		headerBg: "bg-zinc-800/50",
		headerBorder: "border-zinc-600/30",
		headerText: "text-zinc-400",
		accentColor: "bg-zinc-500",
		icon: (
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			>
				<circle cx="12" cy="12" r="10" />
				<polyline points="8 12 11 15 16 9" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
		),
	},
	stopped: {
		headerBg: "bg-red-950/30",
		headerBorder: "border-red-500/30",
		headerText: "text-red-400",
		accentColor: "bg-red-500",
		icon: (
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			>
				<circle cx="12" cy="12" r="10" />
				<path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
			</svg>
		),
	},
};

export function RunColumn({
	id,
	title,
	workItems,
	selectedWorkItemId,
	isFocused,
	onSelectWorkItem,
	onOpenModal,
	selectionScrollBehavior = "smooth",
}: RunColumnProps) {
	const config = columnConfig[id];
	const itemCount = workItems.length;

	return (
		<div
			className={cn(
				"flex flex-col h-full min-w-[280px] max-w-[320px]",
				"border border-border/30 bg-background/50",
				// Focused column styling
				isFocused && "ring-1 ring-amber-500/30 border-amber-500/40",
			)}
		>
			{/* Column header - industrial style */}
			<div className={cn("relative px-3 py-2.5 border-b", config.headerBg, config.headerBorder)}>
				{/* Top accent line */}
				<div className={cn("absolute top-0 left-0 right-0 h-[3px]", config.accentColor)} />

				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						{/* Column icon */}
						<span className={config.headerText}>{config.icon}</span>

						{/* Column title */}
						<h3 className={cn("text-[11px] font-bold tracking-wider uppercase", config.headerText)}>
							{title}
						</h3>
					</div>

					{/* Item count badge */}
					<span
						className={cn(
							"min-w-[20px] px-1.5 py-0.5 text-center",
							"text-[10px] font-bold tabular-nums",
							"border",
							config.headerText,
							config.headerBorder,
						)}
					>
						{itemCount}
					</span>
				</div>

				{/* Subtle scan line effect for industrial feel */}
				<div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
					{[...Array(8)].map((_, i) => (
						<div
							key={i}
							className="absolute left-0 right-0 h-px bg-white"
							style={{ top: `${(i + 1) * 12.5}%` }}
						/>
					))}
				</div>
			</div>

			{/* Work item list */}
			<div className="flex-1 overflow-y-auto p-2 space-y-2">
				{workItems.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<div className={cn("mb-2 opacity-30", config.headerText)}>{config.icon}</div>
						<p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">
							No items
						</p>
					</div>
				) : (
					workItems.map((workItem) => (
						<RunCard
							key={workItem.workItemId}
							workItem={workItem}
							isSelected={selectedWorkItemId === workItem.workItemId}
							onClick={() => onSelectWorkItem(workItem.workItemId)}
							onDoubleClick={() => onOpenModal(workItem)}
							selectionScrollBehavior={selectionScrollBehavior}
						/>
					))
				)}
			</div>

			{/* Column footer - subtle grid pattern */}
			<div className="h-6 border-t border-border/20 bg-secondary/20 relative overflow-hidden">
				<div className="absolute inset-0 opacity-[0.02]">
					<svg width="100%" height="100%">
						<pattern id={`grid-${id}`} width="8" height="8" patternUnits="userSpaceOnUse">
							<path d="M 8 0 L 0 0 0 8" fill="none" stroke="white" strokeWidth="0.5" />
						</pattern>
						<rect width="100%" height="100%" fill={`url(#grid-${id})`} />
					</svg>
				</div>
			</div>
		</div>
	);
}
