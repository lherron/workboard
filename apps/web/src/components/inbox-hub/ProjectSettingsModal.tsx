import { fetchWorkspaces } from "@/api/client";
import { cn } from "@/lib/utils";
import type { Workspace } from "@webwrkq/shared";
import { useCallback, useEffect, useState } from "react";

type ProjectSettingsModalProps = {
	open: boolean;
	projectId: string;
	projectName: string;
	onClose: () => void;
};

// Config row with label and value
function ConfigRow({
	label,
	value,
	mono = false,
}: { label: string; value: string | boolean | undefined; mono?: boolean }) {
	const displayValue =
		value === undefined ? "—" : typeof value === "boolean" ? (value ? "true" : "false") : value;

	return (
		<div className="flex items-start gap-4 py-2 border-b border-dashed border-border/20 last:border-0">
			<span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50 min-w-[80px] pt-0.5">
				{label}
			</span>
			<span
				className={cn(
					"text-[11px] break-all",
					mono ? "font-mono text-foreground/80" : "text-foreground/70",
				)}
			>
				{displayValue}
			</span>
		</div>
	);
}

// Status badge component
function StatusBadge({ enabled, dbExists }: { enabled: boolean; dbExists?: boolean }) {
	return (
		<div className="flex items-center gap-2">
			<span
				className={cn(
					"text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 border",
					enabled
						? "text-emerald-400/90 border-emerald-400/30 bg-emerald-400/10"
						: "text-zinc-500/70 border-zinc-500/30 bg-zinc-500/10",
				)}
			>
				{enabled ? "Enabled" : "Disabled"}
			</span>
			{dbExists !== undefined && (
				<span
					className={cn(
						"text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 border",
						dbExists
							? "text-sky-400/80 border-sky-400/30 bg-sky-400/10"
							: "text-amber-400/80 border-amber-400/30 bg-amber-400/10",
					)}
				>
					{dbExists ? "DB OK" : "No DB"}
				</span>
			)}
		</div>
	);
}

export function ProjectSettingsModal({
	open,
	projectId,
	projectName,
	onClose,
}: ProjectSettingsModalProps) {
	const [workspace, setWorkspace] = useState<Workspace | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Fetch project config when modal opens
	useEffect(() => {
		if (!open) return;

		const controller = new AbortController();
		setLoading(true);
		setError(null);

		fetchWorkspaces(controller.signal)
			.then((resp) => {
				const found = resp.workspaces.find((w) => w.id === projectId);
				if (found) {
					setWorkspace(found);
				} else {
					setError(`Project "${projectId}" not found in registry`);
				}
				setLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setError(err?.message || "Failed to load project config");
				setLoading(false);
			});

		return () => controller.abort();
	}, [open, projectId]);

	// Handle escape key
	useEffect(() => {
		if (!open) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, [open, onClose]);

	// Handle backdrop click
	const handleBackdropClick = useCallback(
		(e: React.MouseEvent) => {
			if (e.target === e.currentTarget) {
				onClose();
			}
		},
		[onClose],
	);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
			onClick={handleBackdropClick}
		>
			{/* Modal */}
			<div
				className="relative w-full max-w-md bg-background border border-border/60 shadow-2xl overflow-hidden animate-slide-in"
				style={{
					boxShadow: "0 0 40px -10px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.02)",
				}}
			>
				{/* Header */}
				<header className="px-5 py-4 border-b border-border/40 bg-secondary/30">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							{/* Project icon */}
							<div className="w-7 h-7 flex items-center justify-center border border-primary/30 bg-primary/5">
								<svg
									width="12"
									height="12"
									viewBox="0 0 16 16"
									fill="none"
									className="text-primary/70"
								>
									<rect
										x="2"
										y="2"
										width="5"
										height="5"
										rx="0.5"
										stroke="currentColor"
										strokeWidth="1.2"
									/>
									<rect
										x="9"
										y="2"
										width="5"
										height="5"
										rx="0.5"
										stroke="currentColor"
										strokeWidth="1.2"
									/>
									<rect
										x="2"
										y="9"
										width="5"
										height="5"
										rx="0.5"
										stroke="currentColor"
										strokeWidth="1.2"
									/>
									<rect
										x="9"
										y="9"
										width="5"
										height="5"
										rx="0.5"
										stroke="currentColor"
										strokeWidth="1.2"
									/>
								</svg>
							</div>
							<div>
								<h2 className="text-[13px] font-mono font-medium text-foreground/90">
									{projectName}
								</h2>
								<p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-[0.1em]">
									Project Configuration
								</p>
							</div>
						</div>

						{/* Close button */}
						<button
							onClick={onClose}
							className="w-6 h-6 flex items-center justify-center text-muted-foreground/50 hover:text-foreground/80 hover:bg-secondary/60 transition-all"
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
				</header>

				{/* Content */}
				<div className="px-5 py-4">
					{loading ? (
						<div className="flex items-center justify-center py-8">
							<div className="text-center">
								<div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
								<p className="text-[10px] font-mono text-muted-foreground/50">Loading...</p>
							</div>
						</div>
					) : error ? (
						<div className="flex items-center justify-center py-8">
							<div className="text-center">
								<div className="w-8 h-8 border border-red-500/30 flex items-center justify-center mx-auto mb-2 bg-red-500/5">
									<span className="text-red-400/80 text-xs">!</span>
								</div>
								<p className="text-[10px] font-mono text-red-400/80">{error}</p>
							</div>
						</div>
					) : workspace ? (
						<div className="space-y-4">
							{/* Status badges */}
							<div className="pb-3 border-b border-border/30">
								<StatusBadge enabled={workspace.enabled} dbExists={workspace.dbExists} />
							</div>

							{/* Config details */}
							<div>
								<ConfigRow label="id" value={workspace.id} mono />
								<ConfigRow label="name" value={workspace.name} />
								<ConfigRow label="root" value={workspace.root} mono />
								<ConfigRow label="dbPath" value={workspace.dbPath} mono />
								<ConfigRow label="enabled" value={workspace.enabled} />
								{workspace.dbExists !== undefined && (
									<ConfigRow label="dbExists" value={workspace.dbExists} />
								)}
							</div>
						</div>
					) : null}
				</div>

				{/* Footer */}
				<footer className="px-5 py-2.5 border-t border-border/30 bg-secondary/20">
					<div className="flex items-center justify-between">
						<span className="text-[8px] font-mono text-muted-foreground/30 uppercase tracking-[0.15em]">
							control-plane registry
						</span>
						<div className="flex items-center gap-1.5 text-[8px] font-mono text-muted-foreground/30">
							<kbd className="px-1 py-0.5 border border-border/40 bg-secondary/40 text-muted-foreground/50">
								ESC
							</kbd>
							<span>close</span>
						</div>
					</div>
				</footer>
			</div>
		</div>
	);
}
