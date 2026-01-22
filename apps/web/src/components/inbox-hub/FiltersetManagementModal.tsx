import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FilterSet } from "./filtersets";

type FiltersetManagementModalProps = {
	isOpen: boolean;
	filtersets: FilterSet[];
	defaultId: string | null;
	onClose: () => void;
	onRename: (id: string, newName: string) => void;
	onDelete: (id: string) => void;
	onSetDefault: (id: string | null) => void;
};

type EditingState = {
	id: string;
	name: string;
} | null;

type DeleteConfirmState = {
	id: string;
	name: string;
} | null;

export function FiltersetManagementModal({
	isOpen,
	filtersets,
	defaultId,
	onClose,
	onRename,
	onDelete,
	onSetDefault,
}: FiltersetManagementModalProps) {
	const [editing, setEditing] = useState<EditingState>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
	const editInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			setEditing(null);
			setDeleteConfirm(null);
		}
	}, [isOpen]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Only trigger on editing.id change, not name changes
	useEffect(() => {
		if (editing) {
			editInputRef.current?.focus();
			editInputRef.current?.select();
		}
	}, [editing?.id]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (editing) {
					setEditing(null);
				} else if (deleteConfirm) {
					setDeleteConfirm(null);
				} else {
					onClose();
				}
			}
		},
		[editing, deleteConfirm, onClose],
	);

	useEffect(() => {
		if (!isOpen) return;
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, handleKeyDown]);

	const handleRenameSubmit = () => {
		if (!editing) return;
		const trimmed = editing.name.trim();
		if (trimmed && trimmed.length <= 32) {
			onRename(editing.id, trimmed);
		}
		setEditing(null);
	};

	const handleDeleteConfirm = () => {
		if (!deleteConfirm) return;
		onDelete(deleteConfirm.id);
		setDeleteConfirm(null);
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[4px]">
			<div
				className="relative w-full max-w-md overflow-hidden border border-border/60 bg-background/95 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
				role="dialog"
				aria-modal="true"
				aria-labelledby="manage-filtersets-title"
			>
				{/* Scanline overlay */}
				<div
					className="absolute inset-0 pointer-events-none opacity-[0.04]"
					style={{
						backgroundImage:
							"repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(80 60% 55% / 0.2) 2px, hsl(80 60% 55% / 0.2) 4px)",
					}}
				/>

				<div className="relative">
					{/* Header */}
					<div className="flex items-center justify-between border-b border-border/50 px-4 py-3 bg-secondary/40">
						<div className="flex items-center gap-2">
							<div className="h-6 w-6 border border-primary/40 bg-primary/10 flex items-center justify-center">
								<svg
									width="12"
									height="12"
									viewBox="0 0 12 12"
									fill="none"
									className="text-primary"
								>
									<path
										d="M2 3h8M2 6h8M2 9h8"
										stroke="currentColor"
										strokeWidth="1.3"
										strokeLinecap="round"
									/>
								</svg>
							</div>
							<h2
								id="manage-filtersets-title"
								className="text-[12px] font-mono uppercase tracking-[0.15em] text-foreground"
							>
								Manage Filtersets
							</h2>
						</div>
						<button
							onClick={onClose}
							className="text-[10px] font-mono text-muted-foreground/60 hover:text-foreground transition-colors"
						>
							esc
						</button>
					</div>

					{/* Content */}
					<div className="p-4">
						{filtersets.length === 0 ? (
							<div className="py-8 text-center">
								<span className="text-[11px] font-mono text-muted-foreground/50">
									No saved presets to manage
								</span>
							</div>
						) : (
							<div className="space-y-2 max-h-[320px] overflow-y-auto">
								{filtersets.map((fs) => (
									<div
										key={fs.id}
										className={cn(
											"border px-3 py-2.5 transition-colors",
											defaultId === fs.id
												? "border-primary/40 bg-primary/5"
												: "border-border/40 bg-secondary/20 hover:border-border/60",
										)}
									>
										{editing?.id === fs.id ? (
											<div className="flex items-center gap-2">
												<input
													ref={editInputRef}
													type="text"
													value={editing.name}
													onChange={(e) => setEditing({ ...editing, name: e.target.value })}
													onKeyDown={(e) => {
														if (e.key === "Enter") handleRenameSubmit();
														if (e.key === "Escape") {
															e.stopPropagation();
															setEditing(null);
														}
													}}
													onBlur={handleRenameSubmit}
													maxLength={32}
													className="flex-1 px-2 py-1 text-[11px] font-mono bg-black/40 border border-primary/50 focus:outline-none focus:border-primary/70"
												/>
											</div>
										) : (
											<div className="flex items-center gap-3">
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span className="text-[11px] font-mono text-foreground truncate">
															{fs.name}
														</span>
														{defaultId === fs.id && (
															<span className="text-[8px] font-mono uppercase tracking-[0.15em] text-primary/70 px-1.5 py-0.5 border border-primary/30 bg-primary/10">
																default
															</span>
														)}
													</div>
													<div className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">
														{fs.selected.length} project{fs.selected.length !== 1 ? "s" : ""}
													</div>
												</div>

												{/* Actions */}
												<div className="flex items-center gap-1">
													<button
														onClick={() => setEditing({ id: fs.id, name: fs.name })}
														className="p-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition-colors"
														title="Rename"
													>
														<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
															<path
																d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z"
																stroke="currentColor"
																strokeWidth="1.2"
																strokeLinecap="round"
																strokeLinejoin="round"
															/>
														</svg>
													</button>
													<button
														onClick={() => onSetDefault(defaultId === fs.id ? null : fs.id)}
														className={cn(
															"p-1.5 transition-colors",
															defaultId === fs.id
																? "text-primary hover:text-primary/70"
																: "text-muted-foreground/50 hover:text-primary hover:bg-secondary/60",
														)}
														title={defaultId === fs.id ? "Remove as default" : "Set as default"}
													>
														<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
															<path
																d="M6 1l1.5 3h3l-2.5 2 1 3-3-2-3 2 1-3-2.5-2h3z"
																stroke="currentColor"
																strokeWidth="1.2"
																strokeLinecap="round"
																strokeLinejoin="round"
																fill={defaultId === fs.id ? "currentColor" : "none"}
															/>
														</svg>
													</button>
													<button
														onClick={() => setDeleteConfirm({ id: fs.id, name: fs.name })}
														className="p-1.5 text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
														title="Delete"
													>
														<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
															<path
																d="M2 3h8M4 3V2h4v1M3 3v7h6V3"
																stroke="currentColor"
																strokeWidth="1.2"
																strokeLinecap="round"
																strokeLinejoin="round"
															/>
														</svg>
													</button>
												</div>
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</div>

					{/* Footer */}
					<div className="flex items-center justify-between border-t border-border/50 px-4 py-3 bg-secondary/40">
						<div className="text-[10px] font-mono text-muted-foreground/40">
							{filtersets.length} preset{filtersets.length !== 1 ? "s" : ""}
						</div>
						<button
							onClick={onClose}
							className="text-[11px] font-mono text-primary border border-primary/40 px-3 py-1.5 hover:bg-primary/10 transition-colors"
						>
							done
						</button>
					</div>
				</div>
			</div>

			{/* Delete confirmation overlay */}
			{deleteConfirm && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
					<div className="w-full max-w-xs border border-red-500/30 bg-background/98 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100">
						{/* Scanline overlay */}
						<div
							className="absolute inset-0 pointer-events-none opacity-[0.03]"
							style={{
								backgroundImage:
									"repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(0 70% 50% / 0.2) 2px, hsl(0 70% 50% / 0.2) 4px)",
							}}
						/>

						<div className="relative p-4 space-y-4">
							<div className="flex items-center gap-2">
								<div className="h-6 w-6 border border-red-500/40 bg-red-500/10 flex items-center justify-center">
									<span className="text-[11px] text-red-400">!</span>
								</div>
								<span className="text-[11px] font-mono uppercase tracking-[0.15em] text-foreground">
									Delete Preset
								</span>
							</div>

							<p className="text-[11px] font-mono text-muted-foreground/70 leading-relaxed">
								Delete <span className="text-foreground">"{deleteConfirm.name}"</span>? This cannot
								be undone.
							</p>

							<div className="flex items-center justify-end gap-3">
								<button
									onClick={() => setDeleteConfirm(null)}
									className="text-[11px] font-mono text-muted-foreground/70 hover:text-foreground transition-colors"
								>
									cancel
								</button>
								<button
									onClick={handleDeleteConfirm}
									className="text-[11px] font-mono text-red-400 border border-red-500/40 px-3 py-1.5 hover:bg-red-500/10 transition-colors"
								>
									delete
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
