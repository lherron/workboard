import { restoreTask, updateTask } from "@/api/client";
import type { ProjectTaskListItem, TaskState } from "@workboard/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InboxData, UndoEntry } from "./types";
import { ACTION_STATES } from "./types";

type UseUndoOptions = {
	setInboxes: React.Dispatch<React.SetStateAction<InboxData[]>>;
};

type UseUndoReturn = {
	undoEntry: UndoEntry | null;
	undoInProgress: boolean;
	recordUndo: (entry: UndoEntry) => void;
	clearUndo: () => void;
	performUndo: () => Promise<void>;
};

export function useUndo({ setInboxes }: UseUndoOptions): UseUndoReturn {
	const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);
	const [undoInProgress, setUndoInProgress] = useState(false);
	const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Record an undo entry and set auto-dismiss timer
	const recordUndo = useCallback((entry: UndoEntry) => {
		// Clear any existing timer
		if (undoTimerRef.current) {
			clearTimeout(undoTimerRef.current);
			undoTimerRef.current = null;
		}
		setUndoEntry(entry);
		// Auto-dismiss after 6 seconds
		undoTimerRef.current = setTimeout(() => {
			setUndoEntry(null);
			undoTimerRef.current = null;
		}, 6000);
	}, []);

	// Clear undo entry (e.g., after successful undo or on new action)
	const clearUndo = useCallback(() => {
		if (undoTimerRef.current) {
			clearTimeout(undoTimerRef.current);
			undoTimerRef.current = null;
		}
		setUndoEntry(null);
	}, []);

	// Perform undo: restore task to previous state
	const performUndo = useCallback(async () => {
		if (!undoEntry || undoInProgress) return;

		setUndoInProgress(true);
		try {
			const { workspaceId, taskId, prev, wasArchived } = undoEntry;

			if (wasArchived) {
				// Task was archived - need to restore first, then patch state
				// prev.state is guaranteed to be a valid restore target (not archived/deleted)
				// since we only record undo when archiving from a valid action state
				const restored = await restoreTask(workspaceId, taskId, undoEntry.next.etag, {
					state: prev.state as Exclude<TaskState, "archived" | "deleted">,
				});
				// Update local state - add task back to inbox
				const restoredItem: ProjectTaskListItem = {
					uuid: restored.uuid,
					id: restored.id,
					slug: restored.slug,
					title: restored.title,
					state: restored.state,
					priority: restored.priority,
					kind: restored.kind,
					requested_by_project_id: restored.requested_by_project_id,
					assigned_project_id: restored.assigned_project_id,
					acknowledged_at: restored.acknowledged_at,
					resolution: restored.resolution,
					parent_task_uuid: restored.parent_task?.uuid ?? null,
					assignee: restored.assignee,
					due_at: restored.due_at,
					labels: restored.labels,
					meta: restored.meta,
					updated_at: restored.updated_at,
					etag: restored.etag,
					project: restored.project,
				};
				setInboxes((prevInboxes) =>
					prevInboxes.map((inbox) =>
						inbox.workspaceId === workspaceId
							? { ...inbox, tasks: [restoredItem, ...inbox.tasks] }
							: inbox,
					),
				);
			} else {
				// Simple state change - just patch back to previous state
				const updated = await updateTask(
					workspaceId,
					taskId,
					{ state: prev.state },
					undoEntry.next.etag,
				);
				// If state was 'completed' and now going back to action state, add to list
				if (!ACTION_STATES.has(undoEntry.next.state) && ACTION_STATES.has(prev.state)) {
					const restoredItem: ProjectTaskListItem = {
						uuid: updated.uuid,
						id: updated.id,
						slug: updated.slug,
						title: updated.title,
						state: updated.state,
						priority: updated.priority,
						kind: updated.kind,
						requested_by_project_id: updated.requested_by_project_id,
						assigned_project_id: updated.assigned_project_id,
						acknowledged_at: updated.acknowledged_at,
						resolution: updated.resolution,
						parent_task_uuid: updated.parent_task?.uuid ?? null,
						assignee: updated.assignee,
						due_at: updated.due_at,
						labels: updated.labels,
						meta: updated.meta,
						updated_at: updated.updated_at,
						etag: updated.etag,
						project: updated.project,
					};
					setInboxes((prevInboxes) =>
						prevInboxes.map((inbox) =>
							inbox.workspaceId === workspaceId
								? { ...inbox, tasks: [restoredItem, ...inbox.tasks] }
								: inbox,
						),
					);
				} else {
					// Just update in place
					setInboxes((prevInboxes) =>
						prevInboxes.map((inbox) =>
							inbox.workspaceId === workspaceId
								? {
										...inbox,
										tasks: inbox.tasks.map((t) =>
											t.id === taskId ? { ...t, state: updated.state, etag: updated.etag } : t,
										),
									}
								: inbox,
						),
					);
				}
			}
			clearUndo();
		} catch (err) {
			console.error("Failed to undo:", err);
			// Keep the undo entry visible on error for potential retry
		} finally {
			setUndoInProgress(false);
		}
	}, [undoEntry, undoInProgress, clearUndo, setInboxes]);

	// Cleanup undo timer on unmount
	useEffect(() => {
		return () => {
			if (undoTimerRef.current) {
				clearTimeout(undoTimerRef.current);
			}
		};
	}, []);

	return {
		undoEntry,
		undoInProgress,
		recordUndo,
		clearUndo,
		performUndo,
	};
}
