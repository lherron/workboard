import { type ApiClientError, createTask } from "@/api/client";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useState } from "react";

type CreateTaskModalProps = {
	isOpen: boolean;
	onClose: () => void;
	workspaceId: string;
	containerId: string;
	onSuccess: () => void;
};

export function CreateTaskModal({
	isOpen,
	onClose,
	workspaceId,
	containerId,
	onSuccess,
}: CreateTaskModalProps) {
	const [title, setTitle] = useState("");
	const [slug, setSlug] = useState("");
	const [priority, setPriority] = useState("1");
	const [dueAt, setDueAt] = useState("");
	const [description, setDescription] = useState("");
	const [labels, setLabels] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<ApiClientError | null>(null);

	if (!isOpen) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			if (!workspaceId || !containerId) {
				throw { message: "Select a workspace and project first." } as ApiClientError;
			}

			await createTask(workspaceId, containerId, {
				title,
				slug: slug || undefined,
				priority: Number.parseInt(priority, 10),
				due_at: dueAt || null,
				description: description || undefined,
				labels: labels
					.split(",")
					.map((l) => l.trim())
					.filter(Boolean),
			});
			onSuccess();
			onClose();
			// Reset form
			setTitle("");
			setSlug("");
			setPriority("1");
			setDueAt("");
			setDescription("");
			setLabels("");
		} catch (err) {
			setError(err as ApiClientError);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]">
			<div className="w-full max-w-lg border border-border bg-background shadow-2xl font-mono">
				<div className="flex items-center justify-between border-b border-border px-4 py-3 bg-secondary/50">
					<h2 className="text-[13px] font-medium tracking-wide text-foreground">› new task</h2>
					<button
						onClick={onClose}
						className="text-[11px] text-muted-foreground hover:text-foreground"
					>
						esc
					</button>
				</div>

				<form onSubmit={handleSubmit} className="p-5 space-y-5">
					{error && (
						<ErrorBanner
							title="Failed to create task"
							message={error.message}
							detail={typeof error.details === "string" ? error.details : undefined}
						/>
					)}

					<div className="space-y-1.5">
						<label className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
							title
						</label>
						<input
							type="text"
							required
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							className="w-full border-b border-border/50 bg-transparent px-0 py-1.5 text-[13px] placeholder:text-muted-foreground/30 focus-visible:outline-none focus-visible:border-primary"
							placeholder="task title"
							autoFocus
						/>
					</div>

					<div className="grid grid-cols-2 gap-6">
						<div className="space-y-1.5">
							<label className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
								slug (opt)
							</label>
							<input
								type="text"
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
								className="w-full border-b border-border/50 bg-transparent px-0 py-1.5 text-[12px] placeholder:text-muted-foreground/30 focus-visible:outline-none focus-visible:border-primary"
								placeholder="auto-generated"
							/>
						</div>
						<div className="space-y-1.5">
							<label className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
								priority
							</label>
							<select
								value={priority}
								onChange={(e) => setPriority(e.target.value)}
								className="w-full border-b border-border/50 bg-transparent px-0 py-1.5 text-[12px] focus-visible:outline-none focus-visible:border-primary cursor-pointer"
							>
								<option value="1">priority 1</option>
								<option value="2">priority 2</option>
								<option value="3">priority 3</option>
								<option value="4">priority 4</option>
							</select>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-6">
						<div className="space-y-1.5">
							<label className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
								due date
							</label>
							<input
								type="date"
								value={dueAt}
								onChange={(e) => setDueAt(e.target.value)}
								className="w-full border-b border-border/50 bg-transparent px-0 py-1.5 text-[12px] focus-visible:outline-none focus-visible:border-primary text-muted-foreground/80"
							/>
						</div>
						<div className="space-y-1.5">
							<label className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
								labels
							</label>
							<input
								type="text"
								value={labels}
								onChange={(e) => setLabels(e.target.value)}
								className="w-full border-b border-border/50 bg-transparent px-0 py-1.5 text-[12px] placeholder:text-muted-foreground/30 focus-visible:outline-none focus-visible:border-primary"
								placeholder="bug, feature..."
							/>
						</div>
					</div>

					<div className="space-y-1.5">
						<label className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
							description
						</label>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={5}
							className="w-full resize-y border border-border/50 bg-muted/20 px-3 py-2 text-[12px] placeholder:text-muted-foreground/30 focus-visible:outline-none focus-visible:border-primary"
							placeholder="# markdown supported..."
						/>
					</div>

					<div className="flex justify-end gap-4 pt-4 border-t border-border/30">
						<button
							type="button"
							onClick={onClose}
							disabled={loading}
							className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
						>
							cancel
						</button>
						<button
							type="submit"
							disabled={loading}
							className="text-[11px] text-primary hover:underline disabled:opacity-50 font-medium"
						>
							{loading ? "creating..." : "create task"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
