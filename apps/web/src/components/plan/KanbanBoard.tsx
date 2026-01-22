import {
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	closestCorners,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { CrossProjectTaskListItem } from "@webwrkq/shared";
import { useCallback, useState } from "react";
import { KanbanCard } from "./KanbanCard";
import { KanbanColumn } from "./KanbanColumn";
import type { KanbanColumnDef } from "./PlanModeView";

type KanbanBoardProps = {
	columns: KanbanColumnDef[];
	onTaskStateChange: (
		taskId: string,
		newState: "idea" | "open" | "in_progress" | "blocked" | "completed" | "archived",
		newPriority?: number,
	) => void;
	compactMode?: boolean;
};

// Map column IDs to task states and priorities
const columnToState: Record<
	string,
	{ state: "idea" | "open" | "in_progress" | "blocked" | "completed"; priority?: number }
> = {
	ideas: { state: "idea" }, // Ideas column
	backlog: { state: "open", priority: 3 }, // Move to backlog = lower priority
	ready: { state: "open", priority: 2 }, // Move to ready = higher priority
	active: { state: "in_progress" },
	blocked: { state: "blocked" },
	done: { state: "completed" },
};

export function KanbanBoard({ columns, onTaskStateChange, compactMode = false }: KanbanBoardProps) {
	const [activeTask, setActiveTask] = useState<CrossProjectTaskListItem | null>(null);
	const [overId, setOverId] = useState<string | null>(null);

	// Configure sensors for better drag experience
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 5, // Start drag after 5px movement
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	// Find which column a task belongs to (by UUID)
	const findColumnByTaskUuid = useCallback(
		(taskUuid: string): string | null => {
			for (const col of columns) {
				if (col.tasks.some((t) => t.uuid === taskUuid)) {
					return col.id;
				}
			}
			return null;
		},
		[columns],
	);

	// Find task by UUID across all columns
	const findTaskByUuid = useCallback(
		(taskUuid: string): CrossProjectTaskListItem | null => {
			for (const col of columns) {
				const task = col.tasks.find((t) => t.uuid === taskUuid);
				if (task) return task;
			}
			return null;
		},
		[columns],
	);

	const handleDragStart = useCallback(
		(event: DragStartEvent) => {
			const taskUuid = event.active.id as string;
			const task = findTaskByUuid(taskUuid);
			if (task) {
				setActiveTask(task);
			}
		},
		[findTaskByUuid],
	);

	const handleDragOver = useCallback((event: DragOverEvent) => {
		const { over } = event;
		setOverId(over ? (over.id as string) : null);
	}, []);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			setActiveTask(null);
			setOverId(null);

			const { active, over } = event;
			if (!over) return;

			const taskUuid = active.id as string;
			const overIdStr = over.id as string;

			// Determine target column
			let targetColumnId: string | null = null;

			// Check if dropped directly on a column
			if (columns.some((col) => col.id === overIdStr)) {
				targetColumnId = overIdStr;
			} else {
				// Dropped on a task - find which column it belongs to
				targetColumnId = findColumnByTaskUuid(overIdStr);
			}

			if (!targetColumnId) return;

			// Check if it's a valid column we can drop on
			const targetConfig = columnToState[targetColumnId];
			if (!targetConfig) return;

			// Find source column
			const sourceColumnId = findColumnByTaskUuid(taskUuid);
			if (sourceColumnId === targetColumnId) {
				// Same column - no state change needed
				return;
			}

			// Find the task to get its ID for the API call
			const task = findTaskByUuid(taskUuid);
			if (!task) return;

			// Update the task state using the task ID (for API)
			onTaskStateChange(task.id, targetConfig.state, targetConfig.priority);
		},
		[columns, findColumnByTaskUuid, findTaskByUuid, onTaskStateChange],
	);

	const handleTaskComplete = useCallback(
		(taskId: string) => {
			onTaskStateChange(taskId, "completed");
		},
		[onTaskStateChange],
	);

	const handleTaskArchive = useCallback(
		(taskId: string) => {
			onTaskStateChange(taskId, "archived");
		},
		[onTaskStateChange],
	);

	const handleTaskReopen = useCallback(
		(taskId: string) => {
			onTaskStateChange(taskId, "open", 2); // Reopen to ready column (priority 2)
		},
		[onTaskStateChange],
	);

	const handleTaskStart = useCallback(
		(taskId: string) => {
			onTaskStateChange(taskId, "in_progress");
		},
		[onTaskStateChange],
	);

	const handleTaskBlock = useCallback(
		(taskId: string) => {
			onTaskStateChange(taskId, "blocked");
		},
		[onTaskStateChange],
	);

	// Determine which column is being hovered
	const getHoveredColumnId = (): string | null => {
		if (!overId) return null;
		// Check if hovering over a column directly
		if (columns.some((col) => col.id === overId)) {
			return overId;
		}
		// Check if hovering over a task in a column
		return findColumnByTaskUuid(overId);
	};

	const hoveredColumnId = getHoveredColumnId();

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCorners}
			onDragStart={handleDragStart}
			onDragOver={handleDragOver}
			onDragEnd={handleDragEnd}
		>
			<div className="h-full flex gap-3 overflow-x-auto pb-2">
				{columns.map((column, index) => (
					<div
						key={column.id}
						className="animate-fade-in flex-shrink-0"
						style={{ animationDelay: `${index * 60}ms` }}
					>
						<KanbanColumn
							id={column.id}
							title={column.title}
							subtitle={column.subtitle}
							tasks={column.tasks}
							color={column.color}
							glow={column.glow}
							isOver={hoveredColumnId === column.id && activeTask !== null}
							compactMode={compactMode}
							onTaskComplete={handleTaskComplete}
							onTaskArchive={handleTaskArchive}
							onTaskReopen={handleTaskReopen}
							onTaskStart={handleTaskStart}
							onTaskBlock={handleTaskBlock}
						/>
					</div>
				))}
			</div>

			{/* Drag overlay - shows a preview of the card being dragged */}
			<DragOverlay
				dropAnimation={{
					duration: 200,
					easing: "ease-out",
				}}
			>
				{activeTask && (
					<div className="w-[280px] opacity-95">
						<KanbanCard task={activeTask} isOverlay isDragging compactMode={compactMode} />
					</div>
				)}
			</DragOverlay>
		</DndContext>
	);
}
