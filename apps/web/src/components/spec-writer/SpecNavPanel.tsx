import type { ApiClientError } from "@/api/client";
import type { SpecManifest } from "@workboard/shared";
import { Copy, FileText, Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SPEC_TEMPLATES, type SpecTemplateId } from "./lib/templates";

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

/**
 * Create spec dialog component.
 */
function CreateSpecDialog({
	isCreating,
	onConfirm,
	onCancel,
}: {
	isCreating: boolean;
	onConfirm: (title: string, templateId: SpecTemplateId) => void;
	onCancel: () => void;
}) {
	const [title, setTitle] = useState("");
	const [templateId, setTemplateId] = useState<SpecTemplateId>(SPEC_TEMPLATES[0].id);
	const [showTitleError, setShowTitleError] = useState(false);

	// Handle escape/enter keys
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onCancel();
			} else if (e.key === "Enter") {
				// Avoid grabbing Enter from other focused elements like textarea; this is fine for modal.
				e.preventDefault();
				if (title.trim()) {
					onConfirm(title.trim(), templateId);
				} else {
					setShowTitleError(true);
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onCancel, onConfirm, templateId, title]);

	const selected = useMemo(() => SPEC_TEMPLATES.find((t) => t.id === templateId), [templateId]);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[3px]">
			<div
				className="w-full max-w-lg border border-border bg-background font-mono animate-in fade-in zoom-in-95 duration-150"
				role="dialog"
				aria-labelledby="create-spec-title"
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-border px-4 py-3 bg-secondary/50">
					<h2
						id="create-spec-title"
						className="text-[13px] font-medium tracking-wide text-foreground"
					>
						<span className="text-primary/70">›</span> new spec
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
					{/* Title */}
					<div className="space-y-1">
						<div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
							title
						</div>
						<input
							type="text"
							value={title}
							onChange={(e) => {
								setTitle(e.target.value);
								if (e.target.value.trim()) {
									setShowTitleError(false);
								}
							}}
							placeholder="Spec title..."
							autoFocus
							className={`w-full px-3 py-2 text-[13px] font-mono bg-background/50 border rounded-none focus:outline-none placeholder:text-muted-foreground/40 transition-colors ${
								showTitleError
									? "border-error/70 focus:border-error bg-error/5"
									: "border-border/50 focus:border-primary/50"
							}`}
						/>
						{showTitleError && (
							<div className="flex items-center gap-1.5 text-[11px] text-error mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
								<span className="text-error/60">›</span>
								<span>title is required</span>
							</div>
						)}
					</div>

					{/* Templates */}
					<div className="space-y-2">
						<div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
							template
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
							{SPEC_TEMPLATES.map((t) => (
								<button
									key={t.id}
									type="button"
									onClick={() => setTemplateId(t.id)}
									className={[
										"px-3 py-2 text-left border transition-colors",
										templateId === t.id
											? "bg-primary/10 border-primary/40"
											: "bg-secondary/20 border-border/50 hover:bg-secondary/40 hover:border-border/70",
									].join(" ")}
								>
									<div className="text-[12px] text-foreground/90">{t.name}</div>
									<div className="text-[10px] text-muted-foreground/60 mt-0.5 leading-relaxed">
										{t.description}
									</div>
								</button>
							))}
						</div>

						{selected?.hint && (
							<div className="text-[11px] text-muted-foreground/60 bg-secondary/20 border border-border/50 px-3 py-2">
								{selected.hint}
							</div>
						)}
					</div>

					{/* Actions */}
					<div className="flex justify-end gap-2 pt-1">
						<button
							type="button"
							onClick={onCancel}
							className="px-3 py-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground border border-border/50 hover:bg-secondary/50 transition-colors"
						>
							cancel
						</button>
						<button
							type="button"
							onClick={() => {
								if (title.trim()) {
									onConfirm(title.trim(), templateId);
								} else {
									setShowTitleError(true);
								}
							}}
							disabled={isCreating}
							className="px-3 py-1.5 text-[11px] font-mono bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-50"
						>
							{isCreating ? "..." : "create"}
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
	onCreateSpec: (title: string, templateId: SpecTemplateId) => void;
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
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState<{ slug: string; title: string } | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	const handleCreate = useCallback(
		(title: string, templateId: SpecTemplateId) => {
			onCreateSpec(title, templateId);
			setShowCreateModal(false);
		},
		[onCreateSpec],
	);

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
			{/* Create modal */}
			{showCreateModal && (
				<CreateSpecDialog
					isCreating={isCreating}
					onConfirm={handleCreate}
					onCancel={() => setShowCreateModal(false)}
				/>
			)}

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
					<button
						type="button"
						onClick={() => setShowCreateModal(true)}
						className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
					>
						<Plus size={14} />
						<span>new spec</span>
					</button>

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
