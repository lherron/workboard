import { formatProjectPath } from "@/lib/taskPaths";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CrossProjectTaskListItem } from "@workboard/shared";
import {
	AlertTriangle,
	Archive,
	CheckCircle2,
	Clock,
	GripVertical,
	Loader2,
	Play,
	RotateCcw,
} from "lucide-react";
import { useState } from "react";

type KanbanCardProps = {
	task: CrossProjectTaskListItem;
	columnColor?: string;
	compactMode?: boolean;
	onComplete?: () => void;
	onArchive?: () => void;
	onReopen?: () => void;
	onStart?: () => void;
	onBlock?: () => void;
	isDragging?: boolean;
	isOverlay?: boolean;
};

type ActionState = "idle" | "completing" | "archiving" | "reopening" | "starting" | "blocking";

const stateConfig: Record<string, { symbol: string; label: string; color: string }> = {
	idea: { symbol: "✧", label: "IDEA", color: "hsl(190 70% 55%)" },
	draft: { symbol: "◇", label: "DRAFT", color: "hsl(305 65% 60%)" },
	open: { symbol: "○", label: "OPEN", color: "hsl(200 70% 55%)" },
	in_progress: { symbol: "◐", label: "ACTIVE", color: "hsl(80 60% 55%)" },
	completed: { symbol: "●", label: "DONE", color: "hsl(0 0% 45%)" },
	archived: { symbol: "◌", label: "ARCHIVED", color: "hsl(0 0% 35%)" },
	blocked: { symbol: "◈", label: "BLOCKED", color: "hsl(35 85% 55%)" },
	cancelled: { symbol: "⊘", label: "CANCELLED", color: "hsl(0 0% 30%)" },
};

const kindSymbols: Record<string, string> = {
	task: "□",
	subtask: "▫",
	bug: "●",
	spike: "◇",
	chore: "○",
};

const priorityConfig: Record<number, { color: string; glow: string }> = {
	1: { color: "hsl(0 70% 55%)", glow: "hsl(0 70% 55% / 0.3)" },
	2: { color: "hsl(35 85% 55%)", glow: "hsl(35 85% 55% / 0.2)" },
	3: { color: "hsl(0 0% 50%)", glow: "transparent" },
	4: { color: "hsl(0 0% 40%)", glow: "transparent" },
};

// Format relative time
function formatRelativeTime(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function KanbanCard({
	task,
	columnColor = "hsl(80 60% 55%)",
	compactMode = false,
	onComplete,
	onArchive,
	onReopen,
	onStart,
	onBlock,
	isDragging = false,
	isOverlay = false,
}: KanbanCardProps) {
	const [actionState, setActionState] = useState<ActionState>("idle");
	const [isHovered, setIsHovered] = useState(false);

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging: isSortableDragging,
	} = useSortable({
		id: task.uuid,
		data: { task },
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const state = stateConfig[task.state] || stateConfig.open;
	const priority = priorityConfig[task.priority] || priorityConfig[3];
	const isCompleted = task.state === "completed";
	const isArchived = task.state === "archived";
	const isBlocked = task.state === "blocked";
	const canReopen = isCompleted || isArchived;
	const actualDragging = isDragging || isSortableDragging;

	const handleAction = async (action: ActionState, handler?: () => void | Promise<void>) => {
		if (!handler || actionState !== "idle") return;
		setActionState(action);
		try {
			await handler();
		} finally {
			setActionState("idle");
		}
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"group relative transition-all duration-200",
				actualDragging && "opacity-40 scale-[0.98]",
				isOverlay && "shadow-2xl rotate-2",
				!actualDragging && !isOverlay && "hover:translate-x-1",
			)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			{/* Card container */}
			<div
				className={cn(
					"relative border-l-2 transition-all duration-200",
					isOverlay && "border-l-primary",
					canReopen && "opacity-60",
				)}
				style={{
					borderLeftColor: isOverlay ? columnColor : isHovered ? columnColor : `${columnColor}50`,
					background: isOverlay
						? "linear-gradient(135deg, hsl(0 0% 13%) 0%, hsl(0 0% 10%) 100%)"
						: "hsl(0 0% 10%)",
					boxShadow: isOverlay
						? "0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 hsl(0 0% 15%)"
						: isHovered
							? `inset 0 0 20px ${columnColor}10`
							: "none",
				}}
			>
				{/* Drag handle - always in top left */}
				<div
					{...attributes}
					{...listeners}
					className={cn(
						"absolute top-2 left-2 p-1 cursor-grab active:cursor-grabbing transition-opacity z-10",
						isHovered || actualDragging ? "opacity-100" : "opacity-0",
					)}
				>
					<GripVertical className="w-3 h-3 text-muted-foreground/50" />
				</div>

				<div className={cn("p-3", compactMode ? "pl-3" : "pl-6")}>
					{/* Header row: state, ID, priority */}
					<div className="flex items-center gap-2 mb-2">
						<span className="text-sm font-mono" style={{ color: state.color }}>
							{state.symbol}
						</span>

						<span className="text-[10px] font-mono text-muted-foreground/50">{task.id}</span>

						{/* Kind indicator */}
						{task.kind !== "task" && (
							<span className="text-[10px] font-mono text-muted-foreground/40">
								{kindSymbols[task.kind] || "○"}
							</span>
						)}

						<div className="flex-1" />

						{/* Priority badge */}
						<div
							className="px-1.5 py-0.5 text-[9px] font-mono font-bold"
							style={{
								color: priority.color,
								background: `${priority.color}15`,
								border: `1px solid ${priority.color}30`,
								boxShadow: task.priority <= 2 ? `0 0 8px ${priority.glow}` : "none",
							}}
						>
							P{task.priority}
						</div>
					</div>

					{/* Title */}
					<div
						className={cn(
							"text-[12px] font-medium leading-snug mb-2",
							compactMode ? "line-clamp-1" : "line-clamp-2",
							canReopen ? "text-muted-foreground/40 line-through" : "text-foreground/90",
						)}
					>
						{task.title}
					</div>

					{/* Project path */}
					<div className="text-[9px] font-mono text-muted-foreground/35 truncate mb-1.5 flex items-center gap-1.5">
						<span className="text-muted-foreground/20">→</span>
						<span>{formatProjectPath(task.project.path)}</span>
					</div>

					{/* Labels row */}
					{!compactMode && task.labels.length > 0 && (
						<div className="flex flex-wrap gap-1 mb-2">
							{task.labels.slice(0, 3).map((label) => (
								<span
									key={label}
									className="text-[9px] font-mono text-muted-foreground/50 px-1.5 py-0.5"
									style={{
										background: "hsl(0 0% 15%)",
										border: "1px solid hsl(0 0% 20%)",
									}}
								>
									{label}
								</span>
							))}
							{task.labels.length > 3 && (
								<span className="text-[9px] font-mono text-muted-foreground/30">
									+{task.labels.length - 3}
								</span>
							)}
						</div>
					)}

					{/* Metadata row - time and workspace */}
					<div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground/30">
						<div className="flex items-center gap-1">
							<Clock className="w-3 h-3" />
							<span>{formatRelativeTime(task.updated_at)}</span>
						</div>
						<span className="truncate max-w-[80px]">{task.projectName}</span>
					</div>

					{/* Actions bar - shows on hover */}
					{(isHovered || actionState !== "idle") && !actualDragging && (
						<div
							className="flex items-center gap-1 pt-2 mt-2 border-t animate-fade-in"
							style={{ borderColor: "hsl(0 0% 15%)" }}
						>
							{canReopen ? (
								<button
									onClick={(e) => {
										e.stopPropagation();
										handleAction("reopening", onReopen);
									}}
									disabled={actionState !== "idle"}
									className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono hover:bg-primary/10 transition-colors disabled:opacity-50"
									style={{ color: columnColor }}
								>
									{actionState === "reopening" ? (
										<Loader2 className="w-3 h-3 animate-spin" />
									) : (
										<RotateCcw className="w-3 h-3" />
									)}
									<span>reopen</span>
								</button>
							) : (
								<>
									{/* Start button - only for open tasks */}
									{task.state === "open" && onStart && (
										<button
											onClick={(e) => {
												e.stopPropagation();
												handleAction("starting", onStart);
											}}
											disabled={actionState !== "idle"}
											className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
										>
											{actionState === "starting" ? (
												<Loader2 className="w-3 h-3 animate-spin" />
											) : (
												<Play className="w-3 h-3" />
											)}
											<span>start</span>
										</button>
									)}

									{/* Block button - for active tasks */}
									{task.state === "in_progress" && onBlock && (
										<button
											onClick={(e) => {
												e.stopPropagation();
												handleAction("blocking", onBlock);
											}}
											disabled={actionState !== "idle"}
											className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-warning hover:bg-warning/10 transition-colors disabled:opacity-50"
										>
											{actionState === "blocking" ? (
												<Loader2 className="w-3 h-3 animate-spin" />
											) : (
												<AlertTriangle className="w-3 h-3" />
											)}
											<span>block</span>
										</button>
									)}

									{/* Complete button */}
									{!isBlocked && onComplete && (
										<button
											onClick={(e) => {
												e.stopPropagation();
												handleAction("completing", onComplete);
											}}
											disabled={actionState !== "idle"}
											className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
										>
											{actionState === "completing" ? (
												<Loader2 className="w-3 h-3 animate-spin" />
											) : (
												<CheckCircle2 className="w-3 h-3" />
											)}
											<span>done</span>
										</button>
									)}

									{/* Archive button */}
									{onArchive && (
										<button
											onClick={(e) => {
												e.stopPropagation();
												handleAction("archiving", onArchive);
											}}
											disabled={actionState !== "idle"}
											className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-muted-foreground/60 hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
										>
											{actionState === "archiving" ? (
												<Loader2 className="w-3 h-3 animate-spin" />
											) : (
												<Archive className="w-3 h-3" />
											)}
											<span>archive</span>
										</button>
									)}
								</>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
