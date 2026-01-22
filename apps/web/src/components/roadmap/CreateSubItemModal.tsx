import { type ApiClientError, createTask } from "@/api/client";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useEffect, useState } from "react";

type CreateSubItemModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	workspaceId: string;
	containerId: string;
	parentTaskUuid: string;
};

export function CreateSubItemModal({
	isOpen,
	onClose,
	onSuccess,
	workspaceId,
	containerId,
	parentTaskUuid,
}: CreateSubItemModalProps) {
	const [title, setTitle] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<ApiClientError | null>(null);

	// Reset form when modal opens
	useEffect(() => {
		if (isOpen) {
			setTitle("");
			setError(null);
		}
	}, [isOpen]);

	// Handle escape key
	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !loading) onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, loading, onClose]);

	if (!isOpen) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			await createTask(workspaceId, containerId, {
				title: title.trim(),
				parent_task_uuid: parentTaskUuid,
			});
			onSuccess();
			onClose();
		} catch (err) {
			setError(err as ApiClientError);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[3px]">
			<div
				className="w-full max-w-md border border-border bg-background shadow-2xl font-mono animate-in fade-in zoom-in-95 duration-150"
				role="dialog"
				aria-labelledby="create-subitem-title"
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-border px-4 py-3 bg-secondary/50">
					<h2
						id="create-subitem-title"
						className="text-[13px] font-medium tracking-wide text-foreground"
					>
						<span className="text-primary/70">›</span> new sub-item
					</h2>
					<button
						onClick={onClose}
						disabled={loading}
						className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
					>
						esc
					</button>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="p-5 space-y-5">
					{error && (
						<ErrorBanner
							title="Failed to create sub-item"
							message={error.message}
							detail={typeof error.details === "string" ? error.details : undefined}
						/>
					)}

					{/* Title field */}
					<div className="space-y-1.5">
						<label className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
							title <span className="text-primary/50">*</span>
						</label>
						<input
							type="text"
							required
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							className="w-full border-b border-border/50 bg-transparent px-0 py-1.5 text-[13px] placeholder:text-muted-foreground/30 focus-visible:outline-none focus-visible:border-primary transition-colors"
							placeholder="What needs to be done?"
							autoFocus
						/>
					</div>

					{/* Actions */}
					<div className="flex justify-end gap-4 pt-4 border-t border-border/30">
						<button
							type="button"
							onClick={onClose}
							disabled={loading}
							className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
						>
							cancel
						</button>
						<button
							type="submit"
							disabled={loading || !title.trim()}
							className="text-[11px] text-primary hover:underline disabled:opacity-50 disabled:no-underline font-medium transition-colors"
						>
							{loading ? (
								<span className="inline-flex items-center gap-1.5">
									<span className="animate-pulse">●</span>
									creating...
								</span>
							) : (
								"create"
							)}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
