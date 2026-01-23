import type { ApiClientError } from "@/api/client";
import type { SpecManifest } from "@workboard/shared";
import { Copy, FileText, Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/**
 * Delete confirmation dialog component.
 */
function DeleteConfirmDialog({
	specTitle,
	onConfirm,
	onCancel,
}: {
	specTitle: string;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	// Handle escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onCancel();
			} else if (e.key === "Enter") {
				onConfirm();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onCancel, onConfirm]);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[3px]">
			<div
				className="w-full max-w-sm border border-border bg-background font-mono animate-in fade-in zoom-in-95 duration-150"
				role="dialog"
				aria-labelledby="delete-confirm-title"
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-border px-4 py-3 bg-secondary/50">
					<h2
						id="delete-confirm-title"
						className="text-[13px] font-medium tracking-wide text-foreground"
					>
						<span className="text-destructive/70">›</span> delete spec
					</h2>
					<button
						onClick={onCancel}
						className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
					>
						esc
					</button>
				</div>

				{/* Content */}
				<div className="p-5 space-y-4">
					<div className="text-[13px] text-foreground/80">
						Are you sure you want to delete this spec?
					</div>

					<div className="bg-secondary/30 border border-border/50 px-3 py-2">
						<div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">
							spec
						</div>
						<div className="text-[13px] text-destructive truncate">{specTitle}</div>
					</div>

					<div className="text-[11px] text-muted-foreground/60">This action cannot be undone.</div>

					{/* Actions */}
					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={onCancel}
							className="px-3 py-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground border border-border/50 hover:bg-secondary/50 transition-colors"
						>
							cancel
						</button>
						<button
							type="button"
							onClick={onConfirm}
							className="px-3 py-1.5 text-[11px] font-mono text-destructive-foreground bg-destructive/80 hover:bg-destructive border border-destructive/50 transition-colors"
						>
							delete
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

type Props = {
	workspaceId: string;
	specs: SpecManifest[];
	loading: boolean;
	error: ApiClientError | null;
	selectedSlug: string | null;
	isDirty: boolean;
	isCreating: boolean;
	onSelectSpec: (slug: string) => void;
	onCreateSpec: (title: string) => void;
	onDeleteSpec: (slug: string) => void;
	onCopyMarkdown: () => void;
	onRetry: () => void;
};

/**
 * Left navigation panel for the Spec Writer.
 * Shows list of specs with actions.
 */
export function SpecNavPanel({
	specs,
	loading,
	error,
	selectedSlug,
	isDirty,
	isCreating,
	onSelectSpec,
	onCreateSpec,
	onDeleteSpec,
	onCopyMarkdown,
	onRetry,
}: Props) {
	const [showCreateInput, setShowCreateInput] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const [deleteConfirm, setDeleteConfirm] = useState<{ slug: string; title: string } | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	const handleCreate = useCallback(() => {
		if (!newTitle.trim()) return;
		onCreateSpec(newTitle.trim());
		setNewTitle("");
		setShowCreateInput(false);
	}, [newTitle, onCreateSpec]);

	const handleDeleteClick = useCallback((slug: string, title: string) => {
		setDeleteConfirm({ slug, title });
	}, []);

	const handleDeleteConfirm = useCallback(() => {
		if (deleteConfirm) {
			onDeleteSpec(deleteConfirm.slug);
			setDeleteConfirm(null);
		}
	}, [deleteConfirm, onDeleteSpec]);

	const handleDeleteCancel = useCallback(() => {
		setDeleteConfirm(null);
	}, []);

	// Filter and sort specs - filter by title (case-insensitive)
	const filteredAndSortedSpecs = [...specs]
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.filter(
			(spec) =>
				!searchQuery.trim() || spec.title.toLowerCase().includes(searchQuery.toLowerCase().trim()),
		);

	return (
		<>
			{/* Delete confirmation dialog */}
			{deleteConfirm && (
				<DeleteConfirmDialog
					specTitle={deleteConfirm.title}
					onConfirm={handleDeleteConfirm}
					onCancel={handleDeleteCancel}
				/>
			)}

			<div className="flex flex-col h-full">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
					<div className="flex items-center gap-2">
						<div className="w-5 h-5 border border-primary/50 flex items-center justify-center bg-primary/10">
							<span className="text-primary text-[9px] font-bold font-mono">sp</span>
						</div>
						<span className="text-sm font-mono text-foreground/70">spec-writer</span>
					</div>
				</div>

				{/* Actions */}
				<div className="px-3 py-2 border-b border-border/20 space-y-1">
					{showCreateInput ? (
						<div className="flex items-center gap-1">
							<input
								type="text"
								value={newTitle}
								onChange={(e) => setNewTitle(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleCreate();
									if (e.key === "Escape") {
										setShowCreateInput(false);
										setNewTitle("");
									}
								}}
								placeholder="Spec title..."
								autoFocus
								className="flex-1 px-2 py-1 text-xs font-mono bg-background/50 border border-border/50 rounded-none focus:outline-none focus:border-primary/50"
							/>
							<button
								type="button"
								onClick={handleCreate}
								disabled={!newTitle.trim() || isCreating}
								className="px-2 py-1 text-xs font-mono bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-50"
							>
								{isCreating ? "..." : "add"}
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setShowCreateInput(true)}
							className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
						>
							<Plus size={14} />
							<span>new spec</span>
						</button>
					)}

					{selectedSlug && (
						<button
							type="button"
							onClick={onCopyMarkdown}
							className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
						>
							<Copy size={14} />
							<span>copy markdown</span>
						</button>
					)}
				</div>

				{/* Search/Filter */}
				{specs.length > 0 && (
					<div className="px-3 py-2 border-b border-border/20">
						<div className="relative">
							<Search
								size={12}
								className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50"
							/>
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Escape") {
										setSearchQuery("");
										(e.target as HTMLInputElement).blur();
									}
								}}
								placeholder="Filter specs..."
								className="w-full pl-7 pr-7 py-1 text-xs font-mono bg-background/50 border border-border/50 rounded-none focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
							/>
							{searchQuery && (
								<button
									type="button"
									onClick={() => setSearchQuery("")}
									className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
									title="Clear filter"
								>
									<X size={12} />
								</button>
							)}
						</div>
					</div>
				)}

				{/* Spec List */}
				<div className="flex-1 overflow-y-auto py-2">
					{loading ? (
						<div className="px-4 py-8 text-center">
							<p className="text-xs font-mono text-muted-foreground animate-pulse">
								Loading specs...
							</p>
						</div>
					) : error ? (
						<div className="px-4 py-8 text-center space-y-2">
							<p className="text-xs font-mono text-destructive">{error.message}</p>
							<button
								type="button"
								onClick={onRetry}
								className="text-xs font-mono text-primary hover:underline"
							>
								retry
							</button>
						</div>
					) : specs.length === 0 ? (
						<div className="px-4 py-8 text-center">
							<p className="text-xs font-mono text-muted-foreground">No specs yet</p>
						</div>
					) : filteredAndSortedSpecs.length === 0 ? (
						<div className="px-4 py-8 text-center space-y-2">
							<p className="text-xs font-mono text-muted-foreground">
								No specs match "{searchQuery}"
							</p>
							<button
								type="button"
								onClick={() => setSearchQuery("")}
								className="text-xs font-mono text-primary hover:underline"
							>
								clear filter
							</button>
						</div>
					) : (
						<ul className="space-y-0.5 px-2">
							{filteredAndSortedSpecs.map((spec) => {
								const isSelected = spec.slug === selectedSlug;

								return (
									<li key={spec.id}>
										<div
											className={`group flex items-center gap-2 px-2 py-1.5 rounded-none cursor-pointer transition-colors ${
												isSelected
													? "bg-primary/15 text-foreground border-l-2 border-primary"
													: "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
											}`}
										>
											<button
												type="button"
												onClick={() => onSelectSpec(spec.slug)}
												className="flex-1 flex items-center gap-2 min-w-0 text-left"
											>
												<FileText size={14} className="flex-shrink-0" />
												<span className="text-xs font-mono truncate">
													{isSelected && isDirty && (
														<span className="text-warning mr-1" title="Unsaved changes">
															*
														</span>
													)}
													{spec.title}
												</span>
											</button>

											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													handleDeleteClick(spec.slug, spec.title);
												}}
												className="p-1 transition-colors text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100"
												title="Delete spec"
											>
												<Trash2 size={12} />
											</button>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</div>

				{/* Footer */}
				<div className="px-4 py-2 border-t border-border/20 text-[10px] font-mono text-muted-foreground/50">
					{specs.length} spec{specs.length !== 1 ? "s" : ""}
				</div>
			</div>
		</>
	);
}
