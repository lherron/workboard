import { createContainer, startAsyncTriage } from "@/api/client";
import { getSessionLaunch, getShortcutForScope, matchesShortcut } from "@/lib/sessionLaunches";
import type { ProjectTaskListItem, TaskListItem } from "@workboard/shared";
import { useCallback, useEffect, useRef } from "react";
import { groupTasksByContainer } from "./InboxColumn";
import { saveCardSize, saveSort } from "./preferences";
import type { CardSize, InboxData, UndoEntry } from "./types";
import { CARD_SIZES } from "./types";

type UseKeyboardNavigationOptions = {
	inboxes: InboxData[];
	keyboardModeActive: boolean;
	setKeyboardModeActive: React.Dispatch<React.SetStateAction<boolean>>;
	focusedColumnIndex: number;
	setFocusedColumnIndex: React.Dispatch<React.SetStateAction<number>>;
	selectedTaskByColumn: Record<string, string | null>;
	setSelectedTaskByColumn: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
	setSuppressSelectionScrollTaskByWorkspace: React.Dispatch<
		React.SetStateAction<Record<string, string | null>>
	>;
	quickAddColumnIndex: number | null;
	setQuickAddColumnIndex: React.Dispatch<React.SetStateAction<number | null>>;
	searchQuery: string;
	setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
	searchInputRef: React.RefObject<HTMLInputElement>;
	cardSize: CardSize;
	setCardSize: React.Dispatch<React.SetStateAction<CardSize>>;
	setCardSizeChanged: React.Dispatch<React.SetStateAction<boolean>>;
	sort: "priority" | "state";
	setSort: React.Dispatch<React.SetStateAction<"priority" | "state">>;
	setSortChanged: React.Dispatch<React.SetStateAction<boolean>>;
	scrollContainerRef: React.RefObject<HTMLDivElement | null>;
	// Modal state
	isModalOpen: boolean;
	// Undo
	undoEntry: UndoEntry | null;
	performUndo: () => Promise<void>;
	// Handlers
	handleTaskClick: (
		workspaceId: string,
		workspaceName: string,
		containerId: string,
		containerTitle: string,
		taskId: string,
	) => void;
	handleTaskComplete: (
		workspaceId: string,
		task: ProjectTaskListItem | TaskListItem,
	) => Promise<void>;
	handleTaskArchive: (
		workspaceId: string,
		task: ProjectTaskListItem | TaskListItem,
	) => Promise<void>;
	handleTaskDelete: (
		workspaceId: string,
		task: ProjectTaskListItem | TaskListItem,
	) => Promise<void>;
	handleImplementTask: (
		tool: "clod" | "codex",
		workspaceId: string,
		task: ProjectTaskListItem,
	) => Promise<void>;
	handleTriageTask: (
		tool: "clod" | "codex",
		workspaceId: string,
		task: ProjectTaskListItem,
	) => Promise<void>;
	applyTaskRunUpdate: (
		workspaceId: string,
		taskId: string,
		updates: {
			run_status?: TaskListItem["run_status"];
			cp_run_id?: TaskListItem["cp_run_id"];
			cp_session_id?: TaskListItem["cp_session_id"];
		},
	) => void;
	handleRefresh: () => void;
	goToContainerView: (workspaceId: string, containerSlug: string) => void;
};

export function useKeyboardNavigation({
	inboxes,
	keyboardModeActive,
	setKeyboardModeActive,
	focusedColumnIndex,
	setFocusedColumnIndex,
	selectedTaskByColumn,
	setSelectedTaskByColumn,
	setSuppressSelectionScrollTaskByWorkspace,
	quickAddColumnIndex: _quickAddColumnIndex,
	setQuickAddColumnIndex,
	searchQuery,
	setSearchQuery,
	searchInputRef,
	cardSize,
	setCardSize,
	setCardSizeChanged,
	sort,
	setSort,
	setSortChanged,
	scrollContainerRef,
	isModalOpen,
	undoEntry,
	performUndo,
	handleTaskClick,
	handleTaskComplete,
	handleTaskArchive,
	handleTaskDelete,
	handleImplementTask,
	handleTriageTask,
	applyTaskRunUpdate,
	handleRefresh,
	goToContainerView,
}: UseKeyboardNavigationOptions): void {
	const wrapScrollResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const forceInstantHorizontalScroll = useCallback(
		(targetLeft: number) => {
			const scroller = scrollContainerRef.current;
			if (!scroller) return;
			const prevScroller = scroller.style.scrollBehavior;
			const prevHtml = document.documentElement.style.scrollBehavior;
			const prevBody = document.body.style.scrollBehavior;
			scroller.style.scrollBehavior = "auto";
			document.documentElement.style.scrollBehavior = "auto";
			document.body.style.scrollBehavior = "auto";
			scroller.scrollLeft = targetLeft;
			requestAnimationFrame(() => {
				scroller.scrollLeft = targetLeft;
				requestAnimationFrame(() => {
					scroller.style.scrollBehavior = prevScroller;
					document.documentElement.style.scrollBehavior = prevHtml;
					document.body.style.scrollBehavior = prevBody;
				});
			});
		},
		[scrollContainerRef],
	);

	const isElementHorizontallyVisible = useCallback((element: Element, container: HTMLElement) => {
		const elementRect = element.getBoundingClientRect();
		const containerRect = container.getBoundingClientRect();
		return elementRect.left >= containerRect.left && elementRect.right <= containerRect.right;
	}, []);

	const scrollColumnIntoView = useCallback(
		(workspaceId: string, behavior: ScrollBehavior = "auto") => {
			const scroller = scrollContainerRef.current;
			if (!scroller) return;
			const column = document.querySelector(`[data-column-workspace-id="${workspaceId}"]`);
			if (!column) return;
			(column as HTMLElement).scrollIntoView({ behavior, block: "nearest", inline: "nearest" });
		},
		[scrollContainerRef],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: cardSize and sort are outer scope values used for keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ignore if modal is open
			if (isModalOpen) return;

			// Ignore if focus is in an input/textarea
			const target = e.target as HTMLElement;
			if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
				return;
			}

			if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
				e.preventDefault();
				searchInputRef.current?.focus();
				return;
			}

			if (e.key === "Escape" && searchQuery.trim().length > 0) {
				e.preventDefault();
				setSearchQuery("");
				return;
			}

			const navigationKeys = [
				"h",
				"j",
				"k",
				"l",
				"ArrowLeft",
				"ArrowRight",
				"ArrowUp",
				"ArrowDown",
			];
			const isNavigationKey = navigationKeys.includes(e.key);

			// Activate keyboard mode on first navigation key
			if (isNavigationKey && !keyboardModeActive) {
				setKeyboardModeActive(true);
			}

			// Handle navigation keys
			if (keyboardModeActive || isNavigationKey) {
				const columnCount = inboxes.length;
				if (columnCount === 0) return;

				// Ensure focusedColumnIndex is valid
				const currentColumnIndex = Math.min(focusedColumnIndex, columnCount - 1);
				const currentInbox = inboxes[currentColumnIndex];
				const currentTasks = currentInbox?.tasks || [];
				const currentWorkspaceId = currentInbox?.workspaceId || "";
				const currentSelectedTaskId = selectedTaskByColumn[currentWorkspaceId] || null;

				// Compute visual task order (after grouping by container)
				// This matches how tasks are rendered in InboxColumn
				const groupedTasks = groupTasksByContainer(
					currentTasks,
					currentInbox?.containerPath,
					currentInbox?.childContainers,
				);
				const visualTaskOrder = groupedTasks.flatMap((group) => group.tasks);

				// Find current task index in visual order
				let currentTaskIndex = -1;
				if (currentSelectedTaskId) {
					currentTaskIndex = visualTaskOrder.findIndex((t) => t.id === currentSelectedTaskId);
				}

				const asyncTriageShortcut = getShortcutForScope(getSessionLaunch("async-triage"), "inbox");
				if (asyncTriageShortcut && matchesShortcut(e, asyncTriageShortcut)) {
					e.preventDefault();
					// Run async triage on selected task
					if (currentSelectedTaskId && currentInbox) {
						const task = currentTasks.find((t) => t.id === currentSelectedTaskId);
						if (task) {
							(async () => {
								try {
									const resp = await startAsyncTriage(currentInbox.workspaceId, task.id);
									applyTaskRunUpdate(currentInbox.workspaceId, task.id, {
										run_status: resp.status,
										cp_run_id: resp.runId,
										cp_session_id: resp.sessionId,
									});
								} catch (err) {
									console.error("Failed to start async triage:", err);
								}
							})();
						}
					}
					return;
				}

				const triageCodexShortcut = getShortcutForScope(getSessionLaunch("triage-codex"), "inbox");
				if (triageCodexShortcut && matchesShortcut(e, triageCodexShortcut)) {
					e.preventDefault();
					// Triage task with Codex
					if (currentSelectedTaskId && currentInbox) {
						const task = currentTasks.find((t) => t.id === currentSelectedTaskId);
						if (task) {
							handleTriageTask("codex", currentInbox.workspaceId, task);
						}
					}
					return;
				}

				const implementClodShortcut = getShortcutForScope(
					getSessionLaunch("implement-clod"),
					"inbox",
				);
				if (implementClodShortcut && matchesShortcut(e, implementClodShortcut)) {
					e.preventDefault();
					// Implement task with Claude (clod)
					if (currentSelectedTaskId && currentInbox) {
						const task = currentTasks.find((t) => t.id === currentSelectedTaskId);
						if (task) {
							handleImplementTask("clod", currentInbox.workspaceId, task);
						}
					}
					return;
				}

				const implementCodexShortcut = getShortcutForScope(
					getSessionLaunch("implement-codex"),
					"inbox",
				);
				if (implementCodexShortcut && matchesShortcut(e, implementCodexShortcut)) {
					e.preventDefault();
					// Implement task with Codex
					if (currentSelectedTaskId && currentInbox) {
						const task = currentTasks.find((t) => t.id === currentSelectedTaskId);
						if (task) {
							handleImplementTask("codex", currentInbox.workspaceId, task);
						}
					}
					return;
				}

				switch (e.key) {
					case "h":
					case "ArrowLeft": {
						e.preventDefault();
						let newIndex = currentColumnIndex - 1;
						const willWrap = newIndex < 0;
						if (willWrap) {
							newIndex = columnCount - 1;
							const targetInbox = inboxes[newIndex];
							// Instantly scroll to end of container (rightmost column)
							// Don't trigger task selection yet - do it after scroll completes
							if (scrollContainerRef.current && targetInbox) {
								const targetColumn = document.querySelector(
									`[data-column-workspace-id="${targetInbox.workspaceId}"]`,
								);
								if (
									!targetColumn ||
									!isElementHorizontallyVisible(targetColumn, scrollContainerRef.current)
								) {
									const maxScrollLeft = Math.max(
										0,
										scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth,
									);
									forceInstantHorizontalScroll(maxScrollLeft);
								}
							}
							setFocusedColumnIndex(newIndex);
							// Find and select task after scroll (using requestAnimationFrame to ensure scroll is complete)
							if (targetInbox) {
								requestAnimationFrame(() => {
									const targetColumn = document.querySelector(
										`[data-column-workspace-id="${targetInbox.workspaceId}"]`,
									);
									if (targetColumn) {
										const targetCards = targetColumn.querySelectorAll("[data-task-id]");
										// Just select the first task in the column for wrap
										const firstCard = targetCards[0];
										if (firstCard) {
											const taskId = firstCard.getAttribute("data-task-id");
											if (taskId) {
												setSuppressSelectionScrollTaskByWorkspace((prev) => ({
													...prev,
													[targetInbox.workspaceId]: taskId,
												}));
												setSelectedTaskByColumn({ [targetInbox.workspaceId]: taskId });
											}
										}
									}
								});
							}
							break;
						}
						setFocusedColumnIndex(newIndex);
						const targetInbox = inboxes[newIndex];
						if (targetInbox) {
							scrollColumnIntoView(targetInbox.workspaceId);
						}

						// Find nearest task in target column based on vertical position
						if (targetInbox && currentSelectedTaskId) {
							const currentCard = document.querySelector(
								`[data-task-id="${currentSelectedTaskId}"]`,
							);
							if (currentCard) {
								const currentRect = currentCard.getBoundingClientRect();
								const currentCenter = currentRect.top + currentRect.height / 2;

								const targetColumn = document.querySelector(
									`[data-column-workspace-id="${targetInbox.workspaceId}"]`,
								);
								if (targetColumn) {
									const targetCards = targetColumn.querySelectorAll("[data-task-id]");
									let nearestTaskId: string | null = null;
									let minDistance = Number.POSITIVE_INFINITY;

									targetCards.forEach((card) => {
										const rect = card.getBoundingClientRect();
										const center = rect.top + rect.height / 2;
										const distance = Math.abs(currentCenter - center);
										if (distance < minDistance) {
											minDistance = distance;
											nearestTaskId = card.getAttribute("data-task-id");
										}
									});

									if (nearestTaskId) {
										setSelectedTaskByColumn({ [targetInbox.workspaceId]: nearestTaskId });
									} else {
										setSelectedTaskByColumn({});
									}
								} else {
									setSelectedTaskByColumn({});
								}
							} else {
								setSelectedTaskByColumn({});
							}
						} else {
							setSelectedTaskByColumn({});
						}
						break;
					}

					case "l":
					case "ArrowRight": {
						e.preventDefault();
						let newIndex = currentColumnIndex + 1;
						const willWrap = newIndex >= columnCount;
						if (willWrap) {
							newIndex = 0;
							const targetInbox = inboxes[newIndex];
							// Instantly scroll to start of container (leftmost column)
							// Don't trigger task selection yet - do it after scroll completes
							if (scrollContainerRef.current && targetInbox) {
								const targetColumn = document.querySelector(
									`[data-column-workspace-id="${targetInbox.workspaceId}"]`,
								);
								if (
									!targetColumn ||
									!isElementHorizontallyVisible(targetColumn, scrollContainerRef.current)
								) {
									forceInstantHorizontalScroll(0);
								}
							}
							setFocusedColumnIndex(newIndex);
							// Find and select task after scroll (using requestAnimationFrame to ensure scroll is complete)
							if (targetInbox) {
								requestAnimationFrame(() => {
									const targetColumn = document.querySelector(
										`[data-column-workspace-id="${targetInbox.workspaceId}"]`,
									);
									if (targetColumn) {
										const targetCards = targetColumn.querySelectorAll("[data-task-id]");
										// Just select the first task in the column for wrap
										const firstCard = targetCards[0];
										if (firstCard) {
											const taskId = firstCard.getAttribute("data-task-id");
											if (taskId) {
												setSuppressSelectionScrollTaskByWorkspace((prev) => ({
													...prev,
													[targetInbox.workspaceId]: taskId,
												}));
												setSelectedTaskByColumn({ [targetInbox.workspaceId]: taskId });
											}
										}
									}
								});
							}
							break;
						}
						setFocusedColumnIndex(newIndex);
						const targetInbox = inboxes[newIndex];
						if (targetInbox) {
							scrollColumnIntoView(targetInbox.workspaceId);
						}

						// Find nearest task in target column based on vertical position
						if (targetInbox && currentSelectedTaskId) {
							const currentCard = document.querySelector(
								`[data-task-id="${currentSelectedTaskId}"]`,
							);
							if (currentCard) {
								const currentRect = currentCard.getBoundingClientRect();
								const currentCenter = currentRect.top + currentRect.height / 2;

								const targetColumn = document.querySelector(
									`[data-column-workspace-id="${targetInbox.workspaceId}"]`,
								);
								if (targetColumn) {
									const targetCards = targetColumn.querySelectorAll("[data-task-id]");
									let nearestTaskId: string | null = null;
									let minDistance = Number.POSITIVE_INFINITY;

									targetCards.forEach((card) => {
										const rect = card.getBoundingClientRect();
										const center = rect.top + rect.height / 2;
										const distance = Math.abs(currentCenter - center);
										if (distance < minDistance) {
											minDistance = distance;
											nearestTaskId = card.getAttribute("data-task-id");
										}
									});

									if (nearestTaskId) {
										setSelectedTaskByColumn({ [targetInbox.workspaceId]: nearestTaskId });
									} else {
										setSelectedTaskByColumn({});
									}
								} else {
									setSelectedTaskByColumn({});
								}
							} else {
								setSelectedTaskByColumn({});
							}
						} else {
							setSelectedTaskByColumn({});
						}
						break;
					}

					case "j":
					case "ArrowDown": {
						e.preventDefault();
						if (visualTaskOrder.length === 0) return;
						let newTaskIndex = currentTaskIndex + 1;
						if (newTaskIndex >= visualTaskOrder.length) {
							newTaskIndex = 0; // Wrap to first task
						}
						const newTask = visualTaskOrder[newTaskIndex];
						if (newTask) {
							setSelectedTaskByColumn((prev) => ({
								...prev,
								[currentWorkspaceId]: newTask.id,
							}));
						}
						break;
					}

					case "k":
					case "ArrowUp": {
						e.preventDefault();
						if (visualTaskOrder.length === 0) return;
						let newTaskIndex = currentTaskIndex - 1;
						if (newTaskIndex < 0) {
							newTaskIndex = visualTaskOrder.length - 1; // Wrap to last task
						}
						const newTask = visualTaskOrder[newTaskIndex];
						if (newTask) {
							setSelectedTaskByColumn((prev) => ({
								...prev,
								[currentWorkspaceId]: newTask.id,
							}));
						}
						break;
					}

					case "n": {
						e.preventDefault();
						// Open quick-add in focused column
						setQuickAddColumnIndex(currentColumnIndex);
						break;
					}

					case "N": {
						e.preventDefault();
						// Create new container in focused column (shift+n)
						if (currentInbox) {
							const slug = window.prompt("Enter container slug (e.g., my-feature):");
							if (slug?.trim()) {
								const normalizedSlug = slug
									.trim()
									.toLowerCase()
									.replace(/[^a-z0-9-]/g, "-");
								createContainer(currentInbox.workspaceId, currentInbox.containerId, {
									slug: normalizedSlug,
									parents: true,
								})
									.then(() => {
										// Trigger refresh to show new container
										handleRefresh();
									})
									.catch((err) => {
										console.error("Failed to create container:", err);
									});
							}
						}
						break;
					}

					case "c": {
						e.preventDefault();
						// Complete selected task
						if (currentSelectedTaskId && currentInbox) {
							const task = currentTasks.find((t) => t.id === currentSelectedTaskId);
							if (task) {
								handleTaskComplete(currentInbox.workspaceId, task);
							}
						}
						break;
					}

					case "a": {
						e.preventDefault();
						// Archive selected task
						if (currentSelectedTaskId && currentInbox) {
							const task = currentTasks.find((t) => t.id === currentSelectedTaskId);
							if (task) {
								handleTaskArchive(currentInbox.workspaceId, task);
							}
						}
						break;
					}

					case "Delete":
					case "Backspace": {
						e.preventDefault();
						// Delete selected task (Delete on Windows/Linux, Backspace on macOS)
						if (currentSelectedTaskId && currentInbox) {
							const task = currentTasks.find((t) => t.id === currentSelectedTaskId);
							if (task) {
								// Find next task to select before deletion (use visual order for consistency with j/k)
								const taskIndex = visualTaskOrder.findIndex((t) => t.id === currentSelectedTaskId);
								let nextTaskId: string | null = null;
								if (taskIndex !== -1) {
									// Prefer next task, fall back to previous
									if (taskIndex < visualTaskOrder.length - 1) {
										nextTaskId = visualTaskOrder[taskIndex + 1].id;
									} else if (taskIndex > 0) {
										nextTaskId = visualTaskOrder[taskIndex - 1].id;
									}
								}

								// Delete the task
								handleTaskDelete(currentInbox.workspaceId, task)
									.then(() => {
										// Select next task in column after deletion
										if (nextTaskId) {
											setSelectedTaskByColumn((prev) => ({
												...prev,
												[currentWorkspaceId]: nextTaskId,
											}));
										} else {
											// No more tasks in column, clear selection
											setSelectedTaskByColumn((prev) => {
												const next = { ...prev };
												delete next[currentWorkspaceId];
												return next;
											});
										}
									})
									.catch((err) => {
										console.error("Failed to delete task:", err);
									});
							}
						}
						break;
					}

					case "Enter": {
						e.preventDefault();
						// Open selected task, or navigate to container view if no task selected
						if (currentSelectedTaskId && currentInbox) {
							handleTaskClick(
								currentInbox.workspaceId,
								currentInbox.workspaceName,
								currentInbox.containerId,
								currentInbox.containerTitle,
								currentSelectedTaskId,
							);
						} else if (currentInbox) {
							// No task selected but column is focused - navigate to container view
							goToContainerView(currentInbox.workspaceId, "inbox");
						}
						break;
					}

					case "Escape": {
						e.preventDefault();
						// Exit keyboard mode and clear selection
						setKeyboardModeActive(false);
						setSelectedTaskByColumn({});
						setQuickAddColumnIndex(null);
						break;
					}
				}
			}

			// Handle card size toggle (works regardless of keyboard navigation mode)
			if (e.key === "d") {
				e.preventDefault();
				setCardSize((prev) => {
					const currentIndex = CARD_SIZES.indexOf(prev);
					const nextIndex = (currentIndex + 1) % CARD_SIZES.length;
					const nextSize = CARD_SIZES[nextIndex];
					saveCardSize(nextSize);
					return nextSize;
				});
				// Trigger visual feedback
				setCardSizeChanged(true);
				setTimeout(() => setCardSizeChanged(false), 1500);
			}

			// Handle sort toggle (works regardless of keyboard navigation mode)
			if (e.key === "s") {
				e.preventDefault();
				setSort((prev) => {
					const nextSort = prev === "priority" ? "state" : "priority";
					saveSort(nextSort);
					return nextSort;
				});
				// Trigger visual feedback
				setSortChanged(true);
				setTimeout(() => setSortChanged(false), 1500);
			}

			// Handle undo (z key, no modifiers)
			if (e.key === "z" && !e.metaKey && !e.ctrlKey && !e.altKey && undoEntry) {
				e.preventDefault();
				performUndo();
			}
		};

		// Deactivate keyboard mode on click (but not if modal is open)
		// Also clear selection when clicking outside task cards
		const handleClick = (e: MouseEvent) => {
			// Check if the click was on a task card (don't clear selection for card clicks)
			const target = e.target as HTMLElement;
			const isTaskCardClick = target.closest("[data-task-id]") !== null;

			if (isTaskCardClick) {
				// Card click - keep selection (onSelect handler will update it)
				// Enable keyboard mode for immediate hotkey use
				if (!keyboardModeActive) {
					setKeyboardModeActive(true);
				}
			} else if (!isModalOpen) {
				// Click outside task cards - clear selection
				setKeyboardModeActive(false);
				setSelectedTaskByColumn({});
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("click", handleClick);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("click", handleClick);
		};
	}, [
		keyboardModeActive,
		setKeyboardModeActive,
		focusedColumnIndex,
		setFocusedColumnIndex,
		selectedTaskByColumn,
		setSelectedTaskByColumn,
		setSuppressSelectionScrollTaskByWorkspace,
		setQuickAddColumnIndex,
		inboxes,
		searchQuery,
		setSearchQuery,
		searchInputRef,
		cardSize,
		setCardSize,
		setCardSizeChanged,
		sort,
		setSort,
		setSortChanged,
		scrollContainerRef,
		isModalOpen,
		handleTaskClick,
		handleTaskComplete,
		handleTaskArchive,
		handleTaskDelete,
		handleImplementTask,
		handleTriageTask,
		applyTaskRunUpdate,
		handleRefresh,
		forceInstantHorizontalScroll,
		isElementHorizontallyVisible,
		scrollColumnIntoView,
		goToContainerView,
		undoEntry,
		performUndo,
	]);

	// Cleanup wrap scroll timer on unmount
	useEffect(() => {
		return () => {
			if (wrapScrollResetRef.current) {
				clearTimeout(wrapScrollResetRef.current);
			}
		};
	}, []);
}
