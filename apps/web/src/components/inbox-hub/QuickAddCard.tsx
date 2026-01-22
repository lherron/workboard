import { getSessionLaunch, getShortcutForScope, matchesShortcut } from "@/lib/sessionLaunches";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import type { TaskCreateResult } from "./InboxColumn";

type TerminalLaunchParams = {
	taskId: string;
	taskSlug: string;
	taskTitle: string;
};

type QuickAddCardProps = {
	workspaceName: string;
	containerTitle: string;
	onSubmit: (title: string, description?: string) => Promise<TaskCreateResult>;
	onCancel: () => void;
	onOpenTriageTerminal: (params: TerminalLaunchParams) => Promise<void>;
	onOpenImplementTerminal: (params: TerminalLaunchParams) => Promise<void>;
};

export function QuickAddCard({
	workspaceName,
	containerTitle,
	onSubmit,
	onCancel,
	onOpenTriageTerminal,
	onOpenImplementTerminal,
}: QuickAddCardProps) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [priority, setPriority] = useState(4);
	const [submitting, setSubmitting] = useState(false);
	const [showPriorityMenu, setShowPriorityMenu] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const titleRef = useRef<HTMLTextAreaElement>(null);
	const descriptionRef = useRef<HTMLTextAreaElement>(null);

	const TITLE_MAX_HEIGHT = 72; // ~3 lines
	const DESC_MAX_HEIGHT = 150; // ~6 lines

	const autoResize = (el: HTMLTextAreaElement | null, maxHeight: number) => {
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
	};

	const resetHeights = () => {
		if (titleRef.current) {
			titleRef.current.style.height = "auto";
		}
		if (descriptionRef.current) {
			descriptionRef.current.style.height = "auto";
		}
	};

	useEffect(() => {
		titleRef.current?.focus();
	}, []);

	const handleSubmit = async (terminalAction: "none" | "triage" | "implement" = "none") => {
		if (!title.trim()) return;

		setSubmitting(true);
		setError(null);
		try {
			const result = await onSubmit(title.trim(), description.trim() || undefined);

			if (result.success) {
				const { taskId, taskSlug, taskTitle } = result;
				setTitle("");
				setDescription("");
				setPriority(4);
				setError(null);
				resetHeights();

				if (terminalAction !== "none") {
					try {
						const params = { taskId, taskSlug, taskTitle };
						if (terminalAction === "triage") {
							await onOpenTriageTerminal(params);
						} else if (terminalAction === "implement") {
							await onOpenImplementTerminal(params);
						}
					} catch (err) {
						console.error(`Failed to open ${terminalAction} terminal:`, err);
					}
				}
			} else {
				setError(result.error);
			}
		} catch (err) {
			console.error("Failed to create task:", err);
			const errorMessage =
				err && typeof err === "object" && "message" in err
					? (err as { message: string }).message
					: "Failed to create task";
			setError(errorMessage);
		} finally {
			setSubmitting(false);
		}
	};

	const handleTitleKeyDown = (e: React.KeyboardEvent) => {
		const implementShortcut = getShortcutForScope(getSessionLaunch("implement-clod"), "quick-add");
		if (implementShortcut && matchesShortcut(e, implementShortcut)) {
			e.preventDefault();
			handleSubmit("implement");
			return;
		}

		if (e.key === "Enter") {
			const hasModifier = e.ctrlKey || e.metaKey;
			if (hasModifier && e.shiftKey) {
				// Cmd/Ctrl+Shift+Enter: create task and open implement terminal
				e.preventDefault();
				handleSubmit("implement");
			} else if (e.shiftKey) {
				// Shift+Enter: allow newline in title
				return;
			} else {
				// Plain Enter or Cmd/Ctrl+Enter: create task only
				e.preventDefault();
				handleSubmit("none");
			}
		} else if (e.key === "Escape") {
			onCancel();
		}
	};

	const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
		const implementShortcut = getShortcutForScope(getSessionLaunch("implement-clod"), "quick-add");
		if (implementShortcut && matchesShortcut(e, implementShortcut)) {
			e.preventDefault();
			handleSubmit("implement");
			return;
		}

		const hasModifier = e.ctrlKey || e.metaKey;
		if (e.key === "Enter" && hasModifier) {
			e.preventDefault();
			if (e.shiftKey) {
				// Cmd/Ctrl+Shift+Enter: create task and open implement terminal
				handleSubmit("implement");
			} else {
				// Cmd/Ctrl+Enter: create task only
				handleSubmit("none");
			}
		} else if (e.key === "Escape") {
			onCancel();
		}
		// Plain Enter allows newlines in description
	};

	const priorityLabels: Record<number, { label: string; color: string }> = {
		1: { label: "P1", color: "text-error/80 border-error/50" },
		2: { label: "P2", color: "text-warning/80 border-warning/50" },
		3: { label: "P3", color: "text-primary/80 border-primary/50" },
		4: { label: "P4", color: "text-muted-foreground/60 border-muted-foreground/30" },
	};

	return (
		<div
			className={cn(
				"rounded-lg border border-border/50 bg-secondary/60 overflow-hidden",
				"shadow-lg shadow-black/20",
				"animate-fade-in",
			)}
		>
			{/* Input Area */}
			<div className="p-3 space-y-2">
				<textarea
					ref={titleRef}
					value={title}
					onChange={(e) => {
						setTitle(e.target.value);
						autoResize(e.target, TITLE_MAX_HEIGHT);
					}}
					onKeyDown={handleTitleKeyDown}
					placeholder="Task name"
					rows={1}
					className={cn(
						"w-full bg-transparent text-[14px] text-foreground/90 placeholder:text-muted-foreground/40",
						"outline-none border-none resize-none overflow-hidden",
						"transition-[height] duration-100 ease-out",
					)}
					disabled={submitting}
				/>

				<textarea
					ref={descriptionRef}
					value={description}
					onChange={(e) => {
						setDescription(e.target.value);
						autoResize(e.target, DESC_MAX_HEIGHT);
					}}
					onKeyDown={handleDescriptionKeyDown}
					placeholder="Description"
					rows={1}
					className={cn(
						"w-full bg-transparent text-[12px] text-muted-foreground/70 placeholder:text-muted-foreground/30",
						"outline-none border-none resize-none",
						"transition-[height] duration-100 ease-out",
					)}
					style={{ overflow: description.split("\n").length > 6 ? "auto" : "hidden" }}
					disabled={submitting}
				/>

				{/* Error Banner */}
				{error && (
					<div className="flex items-start gap-2 px-2 py-1.5 rounded bg-red-500/15 border border-red-500/30 animate-fade-in">
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="none"
							className="text-red-400 flex-shrink-0 mt-0.5"
						>
							<circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
							<path
								d="M8 5v3.5M8 10.5v.5"
								stroke="currentColor"
								strokeWidth="1.3"
								strokeLinecap="round"
							/>
						</svg>
						<p className="text-[11px] text-red-400/90 break-words flex-1">{error}</p>
						<button
							onClick={() => setError(null)}
							className="text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0"
						>
							<svg width="10" height="10" viewBox="0 0 12 12" fill="none">
								<path
									d="M2 2l8 8M10 2l-8 8"
									stroke="currentColor"
									strokeWidth="1.3"
									strokeLinecap="round"
								/>
							</svg>
						</button>
					</div>
				)}

				{/* Action Icons */}
				<div className="flex items-center gap-1 pt-1">
					{/* Due Date */}
					<button
						type="button"
						className="p-2 text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/40 rounded transition-colors"
						title="Due date"
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<rect
								x="2"
								y="3"
								width="12"
								height="11"
								rx="2"
								stroke="currentColor"
								strokeWidth="1.2"
							/>
							<path d="M2 7h12" stroke="currentColor" strokeWidth="1.2" />
							<path
								d="M5 1v3M11 1v3"
								stroke="currentColor"
								strokeWidth="1.2"
								strokeLinecap="round"
							/>
						</svg>
					</button>

					{/* Priority */}
					<div className="relative">
						<button
							type="button"
							onClick={() => setShowPriorityMenu(!showPriorityMenu)}
							className={cn(
								"p-2 rounded transition-colors",
								"hover:bg-muted/40",
								priorityLabels[priority].color,
							)}
							title="Priority"
						>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
								<path
									d="M3 2v12M3 2l10 4-10 4"
									stroke="currentColor"
									strokeWidth="1.2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</button>

						{showPriorityMenu && (
							<>
								<div className="fixed inset-0 z-10" onClick={() => setShowPriorityMenu(false)} />
								<div className="absolute left-0 top-full mt-1 z-20 bg-popover border border-border/50 rounded shadow-xl py-1 min-w-[100px]">
									{[1, 2, 3, 4].map((p) => (
										<button
											key={p}
											onClick={() => {
												setPriority(p);
												setShowPriorityMenu(false);
											}}
											className={cn(
												"w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary/60 flex items-center gap-2",
												priorityLabels[p].color,
											)}
										>
											<svg width="12" height="12" viewBox="0 0 16 16" fill="none">
												<path
													d="M3 2v12M3 2l10 4-10 4"
													stroke="currentColor"
													strokeWidth="1.5"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
											Priority {p}
										</button>
									))}
								</div>
							</>
						)}
					</div>

					{/* Labels */}
					<button
						type="button"
						className="p-2 text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/40 rounded transition-colors"
						title="Labels"
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<path
								d="M2 4.5A2.5 2.5 0 014.5 2h4.086a2 2 0 011.414.586l4.414 4.414a2 2 0 010 2.828l-4.086 4.086a2 2 0 01-2.828 0L3.086 9.5A2 2 0 012.5 8.086V4.5z"
								stroke="currentColor"
								strokeWidth="1.2"
							/>
							<circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
						</svg>
					</button>

					{/* Link */}
					<button
						type="button"
						className="p-2 text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/40 rounded transition-colors"
						title="Add link"
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<path
								d="M6.5 9.5l3-3M7 12.5l-1.5 1.5a2.828 2.828 0 01-4-4L3 8.5M9 3.5l1.5-1.5a2.828 2.828 0 014 4L13 7.5"
								stroke="currentColor"
								strokeWidth="1.2"
								strokeLinecap="round"
							/>
						</svg>
					</button>

					{/* More */}
					<button
						type="button"
						className="p-2 text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/40 rounded transition-colors"
						title="More options"
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<circle cx="4" cy="8" r="1.5" fill="currentColor" />
							<circle cx="8" cy="8" r="1.5" fill="currentColor" />
							<circle cx="12" cy="8" r="1.5" fill="currentColor" />
						</svg>
					</button>
				</div>
			</div>

			{/* Footer */}
			<div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-border/30">
				{/* Project Selector */}
				<button
					type="button"
					className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground/80 transition-colors"
				>
					<span className="text-primary/60">#</span>
					<span>{workspaceName}</span>
					<span className="text-muted-foreground/40">/</span>
					<span>{containerTitle}</span>
					<svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-50">
						<path
							d="M2.5 4l2.5 2.5L7.5 4"
							stroke="currentColor"
							strokeWidth="1.2"
							strokeLinecap="round"
						/>
					</svg>
				</button>

				{/* Action Buttons */}
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={onCancel}
						disabled={submitting}
						className={cn(
							"w-8 h-8 flex items-center justify-center rounded",
							"bg-secondary/60 hover:bg-secondary/90 text-muted-foreground/60 hover:text-muted-foreground/80",
							"transition-colors",
							submitting && "opacity-50 pointer-events-none",
						)}
					>
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
							<path
								d="M3 3l8 8M11 3l-8 8"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
							/>
						</svg>
					</button>

					<button
						type="button"
						onClick={() => handleSubmit("triage")}
						disabled={submitting || !title.trim()}
						title="Create task and open triage terminal"
						className={cn(
							"w-8 h-8 flex items-center justify-center rounded",
							"bg-secondary/80 hover:bg-secondary text-muted-foreground/80",
							"transition-colors",
							(submitting || !title.trim()) && "opacity-40 pointer-events-none",
						)}
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<rect
								x="2"
								y="3"
								width="12"
								height="10"
								rx="1.5"
								stroke="currentColor"
								strokeWidth="1.2"
							/>
							<path
								d="M4.5 6.5l2 1.5-2 1.5"
								stroke="currentColor"
								strokeWidth="1.2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
							<path d="M8 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
						</svg>
					</button>

					<button
						type="button"
						onClick={() => handleSubmit("implement")}
						disabled={submitting || !title.trim()}
						title="Create task and open implement terminal (⌘⇧↵)"
						className={cn(
							"w-8 h-8 flex items-center justify-center rounded",
							"bg-primary/80 hover:bg-primary text-primary-foreground/90",
							"transition-colors",
							(submitting || !title.trim()) && "opacity-40 pointer-events-none",
						)}
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<rect
								x="2"
								y="3"
								width="12"
								height="10"
								rx="1.5"
								stroke="currentColor"
								strokeWidth="1.2"
							/>
							<path
								d="M5 8l2 2 4-4"
								stroke="currentColor"
								strokeWidth="1.2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>

					<button
						type="button"
						onClick={() => handleSubmit("none")}
						disabled={submitting || !title.trim()}
						title="Create task (Enter)"
						className={cn(
							"w-8 h-8 flex items-center justify-center rounded",
							"bg-[#8b4513]/80 hover:bg-[#8b4513] text-white/90",
							"transition-colors",
							(submitting || !title.trim()) && "opacity-40 pointer-events-none",
						)}
					>
						{submitting ? (
							<div className="w-3 h-3 border border-white/30 border-t-white/80 rounded-full animate-spin" />
						) : (
							<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
								<path
									d="M2 7l4 4L12 3"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
