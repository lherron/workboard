import { cn } from "@/lib/utils";
import type { CrossProjectContainersTreeResponse } from "@workboard/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProjectTree = CrossProjectContainersTreeResponse["projects"][number];

export type FilterState = {
	selected: Set<string>;
	order: string[];
};

type InboxProjectFilterModalProps = {
	isOpen: boolean;
	workspaces: ProjectTree[];
	selectedProjects: Set<string>;
	projectOrder: string[];
	onClose: () => void;
	onSave: (state: FilterState) => void;
};

type ProjectToggleProps = {
	checked: boolean;
	label: string;
	count?: number;
	onToggle: () => void;
	isDragging?: boolean;
	onDragStart: () => void;
	onDragEnd: () => void;
	onDragOver: (e: React.DragEvent) => void;
	onDrop: () => void;
	dragOverPosition: "above" | "below" | null;
};

function ProjectToggle({
	checked,
	label,
	count,
	onToggle,
	isDragging,
	onDragStart,
	onDragEnd,
	onDragOver,
	onDrop,
	dragOverPosition,
}: ProjectToggleProps) {
	return (
		<div
			draggable
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			onDragOver={onDragOver}
			onDrop={onDrop}
			className={cn("relative transition-opacity", isDragging && "opacity-40")}
		>
			{dragOverPosition === "above" && (
				<div className="absolute -top-1 left-0 right-0 h-0.5 bg-primary rounded-full" />
			)}
			<div
				className={cn(
					"group w-full flex items-center gap-2 rounded-md border px-3 py-2 transition-all",
					checked
						? "border-primary/40 bg-primary/10 shadow-[0_0_18px_hsl(var(--primary)/0.15)]"
						: "border-border/50 bg-background/40 hover:border-primary/30 hover:bg-secondary/40",
				)}
			>
				<span className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground/70 select-none">
					<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
						<circle cx="2" cy="2" r="1.5" />
						<circle cx="8" cy="2" r="1.5" />
						<circle cx="2" cy="7" r="1.5" />
						<circle cx="8" cy="7" r="1.5" />
						<circle cx="2" cy="12" r="1.5" />
						<circle cx="8" cy="12" r="1.5" />
					</svg>
				</span>
				<button
					type="button"
					onClick={onToggle}
					className="flex items-center gap-3 flex-1 text-left"
				>
					<span
						className={cn(
							"flex h-4 w-4 items-center justify-center border text-[10px] font-bold",
							checked
								? "border-primary text-primary bg-primary/10"
								: "border-border/60 text-muted-foreground/40",
						)}
					>
						{checked ? "✓" : ""}
					</span>
					<span
						className={cn(
							"text-[12px] font-mono tracking-wide truncate flex-1",
							checked
								? "text-foreground"
								: "text-muted-foreground/70 group-hover:text-foreground/90",
						)}
					>
						{label}
					</span>
				</button>
				{count !== undefined && (
					<span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums">
						{count}
					</span>
				)}
			</div>
			{dragOverPosition === "below" && (
				<div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />
			)}
		</div>
	);
}

export function InboxProjectFilterModal({
	isOpen,
	workspaces,
	selectedProjects,
	projectOrder,
	onClose,
	onSave,
}: InboxProjectFilterModalProps) {
	const [draft, setDraft] = useState<Set<string>>(new Set());
	const [order, setOrder] = useState<string[]>([]);
	const [draggedId, setDraggedId] = useState<string | null>(null);
	const [dragOverId, setDragOverId] = useState<string | null>(null);
	const [dragOverPosition, setDragOverPosition] = useState<"above" | "below" | null>(null);
	const _itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	useEffect(() => {
		if (isOpen) {
			setDraft(new Set(selectedProjects));
			// Initialize order: use provided order, add any missing projects at end
			const allIds = workspaces.map((w) => w.projectId);
			const orderedIds = projectOrder.filter((id) => allIds.includes(id));
			const missingIds = allIds.filter((id) => !orderedIds.includes(id));
			setOrder([...orderedIds, ...missingIds]);
		}
	}, [isOpen, selectedProjects, projectOrder, workspaces]);

	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
			if ((e.key === "Enter" || e.key === "NumpadEnter") && (e.metaKey || e.ctrlKey)) {
				onSave({ selected: new Set(draft), order });
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose, onSave, draft, order]);

	const orderedWorkspaces = useMemo(() => {
		const wsMap = new Map(workspaces.map((w) => [w.projectId, w]));
		return order.map((id) => wsMap.get(id)).filter((w): w is ProjectTree => w !== undefined);
	}, [workspaces, order]);

	const selectedCount = draft.size;
	const totalCount = workspaces.length;

	const hasChanges = useMemo(() => {
		if (selectedProjects.size !== draft.size) return true;
		for (const id of selectedProjects) {
			if (!draft.has(id)) return true;
		}
		// Check order changes
		const currentOrderFiltered = projectOrder.filter((id) =>
			workspaces.some((w) => w.projectId === id),
		);
		if (currentOrderFiltered.length !== order.length) return true;
		for (let i = 0; i < order.length; i++) {
			if (order[i] !== currentOrderFiltered[i]) return true;
		}
		return false;
	}, [selectedProjects, draft, projectOrder, order, workspaces]);

	const handleDragStart = useCallback((id: string) => {
		setDraggedId(id);
	}, []);

	const handleDragEnd = useCallback(() => {
		setDraggedId(null);
		setDragOverId(null);
		setDragOverPosition(null);
	}, []);

	const handleDragOver = useCallback(
		(e: React.DragEvent, id: string) => {
			e.preventDefault();
			if (!draggedId || draggedId === id) return;

			const rect = e.currentTarget.getBoundingClientRect();
			const midY = rect.top + rect.height / 2;
			const position = e.clientY < midY ? "above" : "below";

			setDragOverId(id);
			setDragOverPosition(position);
		},
		[draggedId],
	);

	const handleDrop = useCallback(
		(targetId: string) => {
			if (!draggedId || draggedId === targetId) return;

			setOrder((prev) => {
				const newOrder = prev.filter((id) => id !== draggedId);
				const targetIndex = newOrder.indexOf(targetId);
				const insertIndex = dragOverPosition === "below" ? targetIndex + 1 : targetIndex;
				newOrder.splice(insertIndex, 0, draggedId);
				return newOrder;
			});

			setDraggedId(null);
			setDragOverId(null);
			setDragOverPosition(null);
		},
		[draggedId, dragOverPosition],
	);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[4px]">
			<div
				className="relative w-full max-w-3xl overflow-hidden border border-border/60 bg-background/95 shadow-2xl"
				role="dialog"
				aria-modal="true"
				aria-labelledby="project-filter-title"
			>
				<div className="absolute inset-0 pointer-events-none">
					<div
						className="absolute inset-0 opacity-[0.08]"
						style={{
							backgroundImage:
								"linear-gradient(90deg, hsl(0 0% 100% / 0.08) 1px, transparent 1px), linear-gradient(hsl(0 0% 100% / 0.08) 1px, transparent 1px)",
							backgroundSize: "32px 32px",
						}}
					/>
					<div
						className="absolute inset-0 opacity-[0.06]"
						style={{
							backgroundImage:
								"repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(80 60% 55% / 0.15) 2px, hsl(80 60% 55% / 0.15) 4px)",
						}}
					/>
				</div>

				<div className="relative">
					<div className="flex items-center justify-between border-b border-border/50 px-5 py-4 bg-secondary/40">
						<div className="flex items-center gap-3">
							<div className="h-8 w-8 border border-primary/40 bg-primary/10 flex items-center justify-center">
								<span className="text-[11px] font-mono text-primary">/</span>
							</div>
							<div>
								<h2
									id="project-filter-title"
									className="text-[13px] font-mono uppercase tracking-[0.2em] text-foreground"
								>
									Project Display Filter
								</h2>
								<p className="text-[10px] font-mono text-muted-foreground/50 mt-1">
									Drag to reorder • {selectedCount}/{totalCount} visible
								</p>
							</div>
						</div>
						<button
							onClick={onClose}
							className="text-[10px] font-mono text-muted-foreground/60 hover:text-foreground transition-colors"
						>
							esc
						</button>
					</div>

					<div className="grid gap-4 p-5 md:grid-cols-[1fr_220px]">
						<div className="space-y-3">
							<div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
								Workspaces
							</div>
							<div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
								{orderedWorkspaces.map((ws) => {
									const openCount = ws.containers.reduce((s, c) => s + c.open_task_count, 0);
									return (
										<ProjectToggle
											key={ws.projectId}
											checked={draft.has(ws.projectId)}
											label={ws.projectName}
											count={openCount}
											isDragging={draggedId === ws.projectId}
											onToggle={() => {
												setDraft((prev) => {
													const next = new Set(prev);
													if (next.has(ws.projectId)) {
														next.delete(ws.projectId);
													} else {
														next.add(ws.projectId);
													}
													return next;
												});
											}}
											onDragStart={() => handleDragStart(ws.projectId)}
											onDragEnd={handleDragEnd}
											onDragOver={(e) => handleDragOver(e, ws.projectId)}
											onDrop={() => handleDrop(ws.projectId)}
											dragOverPosition={dragOverId === ws.projectId ? dragOverPosition : null}
										/>
									);
								})}
							</div>
						</div>

						<div className="space-y-4">
							<div className="border border-border/50 bg-secondary/30 px-3 py-3">
								<div className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
									Status
								</div>
								<div className="mt-2 text-[12px] font-mono text-foreground">
									Showing <span className="text-primary">{selectedCount}</span> of{" "}
									<span className="text-muted-foreground/80">{totalCount}</span>
								</div>
								<div className="mt-2 text-[10px] font-mono text-muted-foreground/50">
									Changes apply to Action + Completion views.
								</div>
							</div>

							<div className="border border-border/50 bg-secondary/30 px-3 py-3">
								<div className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
									Quick Select
								</div>
								<div className="mt-3 flex flex-col gap-2">
									<button
										type="button"
										onClick={() => setDraft(new Set(workspaces.map((w) => w.projectId)))}
										className="text-[10px] font-mono text-primary/80 border border-primary/40 px-2 py-1.5 hover:bg-primary/10 transition-colors"
									>
										select all
									</button>
									<button
										type="button"
										onClick={() => setDraft(new Set())}
										className="text-[10px] font-mono text-muted-foreground/60 border border-border/50 px-2 py-1.5 hover:text-foreground hover:border-border/80 transition-colors"
									>
										clear selection
									</button>
								</div>
							</div>

							<div className="border border-border/50 bg-secondary/30 px-3 py-3">
								<div className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
									Tips
								</div>
								<div className="mt-2 text-[10px] font-mono text-muted-foreground/50 leading-relaxed">
									Drag to reorder columns. ⌘/Ctrl+Enter to save.
								</div>
							</div>
						</div>
					</div>

					<div className="flex items-center justify-between border-t border-border/50 px-5 py-4 bg-secondary/40">
						<div className="text-[10px] font-mono text-muted-foreground/40">
							{hasChanges ? "Unsaved changes" : "No changes"}
						</div>
						<div className="flex gap-3">
							<button
								onClick={onClose}
								className="text-[11px] font-mono text-muted-foreground/70 hover:text-foreground transition-colors"
							>
								cancel
							</button>
							<button
								onClick={() => onSave({ selected: new Set(draft), order })}
								disabled={!hasChanges}
								className={cn(
									"text-[11px] font-mono px-3 py-1.5 border transition-colors",
									hasChanges
										? "text-primary border-primary/40 hover:bg-primary/10"
										: "text-muted-foreground/40 border-border/40 cursor-not-allowed",
								)}
							>
								save filter
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
