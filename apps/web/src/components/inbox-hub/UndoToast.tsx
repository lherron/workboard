import type { UndoEntry } from "./types";

type UndoToastProps = {
	undoEntry: UndoEntry;
	undoInProgress: boolean;
	onUndo: () => void;
	onDismiss: () => void;
};

export function UndoToast({ undoEntry, undoInProgress, onUndo, onDismiss }: UndoToastProps) {
	return (
		<div className="fixed bottom-6 right-6 z-50 animate-slide-up">
			<div className="flex items-center gap-4 px-4 py-3 bg-secondary/95 backdrop-blur-sm border border-emerald-500/30 shadow-lg shadow-black/20">
				<div className="flex items-center gap-3">
					<div className="w-1.5 h-8 bg-emerald-500/60" />
					<div className="flex flex-col gap-0.5">
						<span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/60">
							{undoEntry.wasArchived ? "Archived" : "Completed"}
						</span>
						<span
							className="text-[12px] font-mono text-foreground/90 truncate max-w-[240px]"
							title={undoEntry.taskTitle}
						>
							{undoEntry.taskTitle}
						</span>
					</div>
				</div>
				<div className="flex items-center gap-2 ml-2">
					<button
						onClick={onUndo}
						disabled={undoInProgress}
						className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono border transition-all duration-150 ${
							undoInProgress
								? "opacity-50 cursor-not-allowed bg-emerald-500/5 text-emerald-400/50 border-emerald-500/20"
								: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25 hover:border-emerald-500/60"
						}`}
					>
						{undoInProgress ? (
							<span className="inline-block w-3 h-3 border border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
						) : (
							<>
								<svg width="12" height="12" viewBox="0 0 16 16" fill="none">
									<path
										d="M3 8c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
									/>
									<path
										d="M1 5l2 3 3-2"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
								Undo
							</>
						)}
					</button>
					<kbd className="text-[10px] font-mono px-2 py-1 bg-emerald-500/10 text-emerald-400/60 border border-emerald-500/25">
						z
					</kbd>
					<button
						onClick={onDismiss}
						className="p-1.5 text-muted-foreground/40 hover:text-foreground/70 transition-colors"
						title="Dismiss"
					>
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
							<path
								d="M2 2l8 8M10 2l-8 8"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	);
}
