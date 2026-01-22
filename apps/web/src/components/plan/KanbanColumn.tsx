import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { CrossProjectTaskListItem } from "@webwrkq/shared";
import { KanbanCard } from "./KanbanCard";

type KanbanColumnProps = {
	id: string;
	title: string;
	subtitle: string;
	tasks: CrossProjectTaskListItem[];
	color: string;
	glow: string;
	isOver?: boolean;
	compactMode?: boolean;
	onTaskComplete?: (taskId: string) => void;
	onTaskArchive?: (taskId: string) => void;
	onTaskReopen?: (taskId: string) => void;
	onTaskStart?: (taskId: string) => void;
	onTaskBlock?: (taskId: string) => void;
};

export function KanbanColumn({
	id,
	title,
	subtitle,
	tasks,
	color,
	glow,
	isOver = false,
	compactMode = false,
	onTaskComplete,
	onTaskArchive,
	onTaskReopen,
	onTaskStart,
	onTaskBlock,
}: KanbanColumnProps) {
	const { setNodeRef } = useDroppable({ id });

	const isDone = id === "done";
	const isEmpty = tasks.length === 0;

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"flex flex-col h-full transition-all duration-200",
				compactMode ? "w-[240px]" : "w-[280px]",
			)}
			style={{
				// Column glow effect when dragging over
				boxShadow: isOver ? `0 0 30px ${glow}, inset 0 0 20px ${glow}` : "none",
			}}
		>
			{/* Column header - distinctive data panel look */}
			<div
				className="relative px-3 py-3 flex-shrink-0"
				style={{
					background: "linear-gradient(180deg, hsl(0 0% 12%) 0%, hsl(0 0% 9%) 100%)",
					borderTop: `2px solid ${color}`,
				}}
			>
				{/* Top accent line glow */}
				<div
					className="absolute top-0 left-0 right-0 h-px"
					style={{
						background: `linear-gradient(90deg, transparent 0%, ${color} 20%, ${color} 80%, transparent 100%)`,
						boxShadow: `0 0 10px ${glow}`,
					}}
				/>

				{/* Corner decorations */}
				<div
					className="absolute top-2 left-2 w-2 h-2 border-t border-l"
					style={{ borderColor: color }}
				/>
				<div
					className="absolute top-2 right-2 w-2 h-2 border-t border-r"
					style={{ borderColor: color }}
				/>

				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						{/* Column indicator dot */}
						<div
							className={cn("w-2 h-2 rounded-full", isOver && "animate-pulse")}
							style={{
								backgroundColor: color,
								boxShadow: `0 0 8px ${glow}`,
							}}
						/>
						<span
							className="text-[12px] font-mono font-semibold tracking-[0.15em]"
							style={{ color }}
						>
							{title}
						</span>
					</div>

					{/* Task count badge */}
					<div
						className="flex items-center gap-1.5 px-2 py-0.5"
						style={{
							background: `${color}10`,
							border: `1px solid ${color}30`,
						}}
					>
						<span className="text-[11px] font-mono font-bold tabular-nums" style={{ color }}>
							{tasks.length}
						</span>
					</div>
				</div>

				{/* Subtitle */}
				<div className="text-[9px] font-mono text-muted-foreground/40 tracking-[0.2em] mt-1 ml-4">
					{subtitle}
				</div>
			</div>

			{/* Cards container */}
			<div
				className={cn(
					"flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2",
					isOver && "bg-primary/5",
				)}
				style={{
					background: isOver
						? `linear-gradient(180deg, ${glow} 0%, transparent 30%)`
						: "linear-gradient(180deg, hsl(0 0% 8%) 0%, hsl(0 0% 7%) 100%)",
				}}
			>
				<SortableContext items={tasks.map((t) => t.uuid)} strategy={verticalListSortingStrategy}>
					{tasks.map((task, index) => (
						<div
							key={task.uuid}
							className="animate-fade-in"
							style={{ animationDelay: `${index * 30}ms` }}
						>
							<KanbanCard
								task={task}
								columnColor={color}
								compactMode={compactMode}
								onComplete={onTaskComplete ? () => onTaskComplete(task.id) : undefined}
								onArchive={onTaskArchive ? () => onTaskArchive(task.id) : undefined}
								onReopen={onTaskReopen ? () => onTaskReopen(task.id) : undefined}
								onStart={onTaskStart ? () => onTaskStart(task.id) : undefined}
								onBlock={onTaskBlock ? () => onTaskBlock(task.id) : undefined}
							/>
						</div>
					))}
				</SortableContext>

				{/* Empty state */}
				{isEmpty && (
					<div
						className={cn(
							"h-full min-h-[120px] flex items-center justify-center",
							isOver && "border-2 border-dashed rounded-sm",
						)}
						style={{
							borderColor: isOver ? color : "transparent",
						}}
					>
						<div className="text-center py-8">
							<div className="text-3xl mb-3 opacity-20" style={{ color }}>
								{isDone ? "✓" : id === "blocked" ? "⊘" : "◇"}
							</div>
							<div className="text-[10px] font-mono text-muted-foreground/30 tracking-wider">
								{isOver ? (
									<span style={{ color }} className="font-semibold">
										DROP HERE
									</span>
								) : isDone ? (
									"No completed tasks"
								) : (
									"Drag tasks here"
								)}
							</div>
						</div>
					</div>
				)}

				{/* Drop indicator when hovering with items */}
				{isOver && !isEmpty && (
					<div
						className="h-12 border-2 border-dashed rounded-sm flex items-center justify-center mt-2"
						style={{ borderColor: color }}
					>
						<span className="text-[10px] font-mono font-semibold tracking-wider" style={{ color }}>
							DROP HERE
						</span>
					</div>
				)}
			</div>

			{/* Column footer - status bar style */}
			<div
				className="px-3 py-2 flex-shrink-0 border-t"
				style={{
					background: "hsl(0 0% 8%)",
					borderColor: `${color}20`,
				}}
			>
				<div className="flex items-center justify-between">
					<div className="text-[9px] font-mono text-muted-foreground/30 tracking-wider">
						{id.toUpperCase()}
					</div>
					{tasks.length > 0 && (
						<div className="flex items-center gap-1">
							{/* Priority breakdown mini-viz */}
							{[1, 2, 3, 4].map((p) => {
								const count = tasks.filter((t) => t.priority === p).length;
								if (count === 0) return null;
								return (
									<div
										key={p}
										className="text-[8px] font-mono px-1 py-0.5"
										style={{
											color: p <= 2 ? color : "hsl(0 0% 40%)",
											opacity: p <= 2 ? 1 : 0.5,
										}}
									>
										P{p}:{count}
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
