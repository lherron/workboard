import { fetchWorkspaces } from "@/api/client";
import { cn } from "@/lib/utils";
import type { Workspace } from "@webwrkq/shared";
import { useCallback, useEffect, useState } from "react";

type SettingsPanelProps = {
	open: boolean;
	onClose: () => void;
};

// Blueprint grid pattern for the schematic aesthetic
function BlueprintGrid() {
	return (
		<div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
			<svg width="100%" height="100%">
				<defs>
					<pattern id="smallGrid" width="16" height="16" patternUnits="userSpaceOnUse">
						<path d="M 16 0 L 0 0 0 16" fill="none" stroke="currentColor" strokeWidth="0.5" />
					</pattern>
					<pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
						<rect width="64" height="64" fill="url(#smallGrid)" />
						<path d="M 64 0 L 0 0 0 64" fill="none" stroke="currentColor" strokeWidth="1" />
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill="url(#grid)" className="text-primary" />
			</svg>
		</div>
	);
}

// Section header with horizontal rule extending to edges
function SectionHeader({ label, count }: { label: string; count?: number }) {
	return (
		<div className="flex items-center gap-3 mb-4">
			<div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/20 to-primary/40" />
			<span className="text-[9px] font-mono uppercase tracking-[0.3em] text-primary/60">
				{label}
				{count !== undefined && <span className="ml-2 text-primary/40">[{count}]</span>}
			</span>
			<div className="h-px flex-1 bg-gradient-to-l from-transparent via-primary/20 to-primary/40" />
		</div>
	);
}

// Single workspace config row
function WorkspaceRow({ workspace, index }: { workspace: Workspace; index: number }) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div
			className={cn(
				"group relative border-l-2 pl-4 py-3 transition-all duration-200",
				workspace.enabled
					? "border-primary/30 hover:border-primary/60"
					: "border-zinc-600/20 hover:border-zinc-500/40",
				expanded && "bg-primary/[0.02]",
			)}
		>
			{/* Row index marker */}
			<div className="absolute -left-[1px] top-3 -translate-x-full pr-2">
				<span className="text-[8px] font-mono tabular-nums text-muted-foreground/30">
					{String(index + 1).padStart(2, "0")}
				</span>
			</div>

			{/* Main row content */}
			<button
				onClick={() => setExpanded(!expanded)}
				className="w-full text-left flex items-center gap-4"
			>
				{/* Project ID */}
				<div className="min-w-[100px]">
					<span
						className={cn(
							"text-[11px] font-mono font-medium",
							workspace.enabled ? "text-foreground/90" : "text-muted-foreground/50",
						)}
					>
						{workspace.id}
					</span>
				</div>

				{/* Name */}
				<div className="flex-1 min-w-0">
					<span
						className={cn(
							"text-[11px] font-mono truncate block",
							workspace.enabled ? "text-foreground/70" : "text-muted-foreground/40",
						)}
					>
						{workspace.name}
					</span>
				</div>

				{/* Status indicators */}
				<div className="flex items-center gap-2">
					{/* Enabled status */}
					<span
						className={cn(
							"text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 border",
							workspace.enabled
								? "text-emerald-400/80 border-emerald-400/20 bg-emerald-400/5"
								: "text-zinc-500/60 border-zinc-500/20 bg-zinc-500/5",
						)}
					>
						{workspace.enabled ? "ON" : "OFF"}
					</span>

					{/* DB exists indicator */}
					{workspace.dbExists !== undefined && (
						<span
							className={cn(
								"text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 border",
								workspace.dbExists
									? "text-sky-400/60 border-sky-400/20 bg-sky-400/5"
									: "text-amber-400/60 border-amber-400/20 bg-amber-400/5",
							)}
						>
							{workspace.dbExists ? "DB" : "NO DB"}
						</span>
					)}

					{/* Expand chevron */}
					<svg
						width="10"
						height="10"
						viewBox="0 0 16 16"
						fill="none"
						className={cn(
							"text-muted-foreground/30 transition-transform duration-200",
							expanded && "rotate-90",
						)}
					>
						<path
							d="M6 4l4 4-4 4"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</div>
			</button>

			{/* Expanded details */}
			{expanded && (
				<div className="mt-3 pt-3 border-t border-dashed border-border/30 space-y-2 animate-fade-in">
					<DetailRow label="root" value={workspace.root} mono />
					<DetailRow label="dbPath" value={workspace.dbPath} mono />
					<DetailRow label="enabled" value={workspace.enabled ? "true" : "false"} />
					{workspace.dbExists !== undefined && (
						<DetailRow label="dbExists" value={workspace.dbExists ? "true" : "false"} />
					)}
				</div>
			)}
		</div>
	);
}

// Detail row for expanded view
function DetailRow({
	label,
	value,
	mono = false,
}: { label: string; value: string; mono?: boolean }) {
	return (
		<div className="flex items-start gap-3 text-[10px]">
			<span className="text-muted-foreground/40 font-mono min-w-[60px]">{label}:</span>
			<span className={cn("text-muted-foreground/70 break-all", mono && "font-mono")}>{value}</span>
		</div>
	);
}

// Environment info section
function EnvironmentInfo() {
	const envVars = [
		{ key: "VITE_CP_TOKEN", value: import.meta.env.VITE_CP_TOKEN ? "••••••••" : "(not set)" },
		{ key: "VITE_WRKQ_ACTOR", value: import.meta.env.VITE_WRKQ_ACTOR || "(default)" },
		{ key: "VITE_DISABLE_WEBHOOKS", value: import.meta.env.VITE_DISABLE_WEBHOOKS || "0" },
	];

	return (
		<div className="space-y-2">
			{envVars.map(({ key, value }) => (
				<div key={key} className="flex items-center gap-3 text-[10px] font-mono">
					<span className="text-muted-foreground/40 min-w-[160px]">{key}</span>
					<span className="text-muted-foreground/60">=</span>
					<span className="text-foreground/60">{value}</span>
				</div>
			))}
		</div>
	);
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Fetch workspaces when panel opens
	useEffect(() => {
		if (!open) return;

		const controller = new AbortController();
		setLoading(true);
		setError(null);

		fetchWorkspaces(controller.signal)
			.then((resp) => {
				setWorkspaces(resp.workspaces);
				setLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setError(err?.message || "Failed to load workspaces");
				setLoading(false);
			});

		return () => controller.abort();
	}, [open]);

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
			className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm animate-fade-in"
			onClick={handleBackdropClick}
		>
			{/* Panel */}
			<div
				className="relative w-full max-w-2xl max-h-[85vh] bg-background border border-border/60 shadow-2xl overflow-hidden flex flex-col animate-slide-in"
				style={{
					boxShadow: "0 0 60px -15px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)",
				}}
			>
				{/* Blueprint grid background */}
				<BlueprintGrid />

				{/* Header */}
				<header className="relative flex-shrink-0 px-6 py-4 border-b border-border/40 bg-secondary/30">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							{/* Settings icon */}
							<div className="w-8 h-8 flex items-center justify-center border border-primary/30 bg-primary/5">
								<svg
									width="14"
									height="14"
									viewBox="0 0 16 16"
									fill="none"
									className="text-primary/70"
								>
									<path
										d="M6.5 1.5h3v1.7a4.5 4.5 0 011.3.5l1.2-1.2 2.1 2.1-1.2 1.2c.2.4.4.8.5 1.3h1.7v3h-1.7a4.5 4.5 0 01-.5 1.3l1.2 1.2-2.1 2.1-1.2-1.2c-.4.2-.8.4-1.3.5v1.7h-3v-1.7a4.5 4.5 0 01-1.3-.5l-1.2 1.2-2.1-2.1 1.2-1.2a4.5 4.5 0 01-.5-1.3H1.5v-3h1.7c.1-.5.3-.9.5-1.3L2.5 4.6l2.1-2.1 1.2 1.2c.4-.2.8-.4 1.3-.5V1.5z"
										stroke="currentColor"
										strokeWidth="1.2"
										strokeLinejoin="round"
									/>
									<circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
								</svg>
							</div>
							<div>
								<h2 className="text-[13px] font-mono font-medium text-foreground/90 tracking-wide">
									SYSTEM CONFIGURATION
								</h2>
								<p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-[0.15em] mt-0.5">
									Control-Plane Registry
								</p>
							</div>
						</div>

						{/* Close button */}
						<button
							onClick={onClose}
							className="w-7 h-7 flex items-center justify-center text-muted-foreground/50 hover:text-foreground/80 hover:bg-secondary/60 border border-transparent hover:border-border/40 transition-all"
						>
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
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
				<div className="relative flex-1 overflow-y-auto px-6 py-5 scrollbar-gutter-stable">
					{loading ? (
						<div className="flex items-center justify-center py-12">
							<div className="text-center">
								<div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
								<p className="text-[10px] font-mono text-muted-foreground/50">
									Loading configuration...
								</p>
							</div>
						</div>
					) : error ? (
						<div className="flex items-center justify-center py-12">
							<div className="text-center max-w-sm">
								<div className="w-10 h-10 border border-red-500/30 flex items-center justify-center mx-auto mb-3 bg-red-500/5">
									<span className="text-red-400/80 text-sm">!</span>
								</div>
								<p className="text-[11px] font-mono text-red-400/80 mb-1">Configuration Error</p>
								<p className="text-[10px] text-muted-foreground/50">{error}</p>
							</div>
						</div>
					) : (
						<div className="space-y-8">
							{/* Workspaces Section */}
							<section>
								<SectionHeader label="Registered Workspaces" count={workspaces.length} />
								<div className="space-y-1 ml-6">
									{workspaces.length === 0 ? (
										<p className="text-[10px] font-mono text-muted-foreground/40 py-4">
											No workspaces registered in control-plane
										</p>
									) : (
										workspaces.map((workspace, index) => (
											<WorkspaceRow key={workspace.id} workspace={workspace} index={index} />
										))
									)}
								</div>
							</section>

							{/* Environment Section */}
							<section>
								<SectionHeader label="Environment" />
								<div className="ml-6 pl-4 border-l-2 border-border/20">
									<EnvironmentInfo />
								</div>
							</section>

							{/* API Endpoints Section */}
							<section>
								<SectionHeader label="API Endpoints" />
								<div className="ml-6 pl-4 border-l-2 border-border/20 space-y-2">
									<div className="flex items-center gap-3 text-[10px] font-mono">
										<span className="text-muted-foreground/40 min-w-[80px]">Base URL</span>
										<span className="text-muted-foreground/60">=</span>
										<span className="text-foreground/60">{window.location.origin}</span>
									</div>
									<div className="flex items-center gap-3 text-[10px] font-mono">
										<span className="text-muted-foreground/40 min-w-[80px]">Workspaces</span>
										<span className="text-muted-foreground/60">=</span>
										<span className="text-foreground/60">/admin/projects/wrkq</span>
									</div>
									<div className="flex items-center gap-3 text-[10px] font-mono">
										<span className="text-muted-foreground/40 min-w-[80px]">Tasks</span>
										<span className="text-muted-foreground/60">=</span>
										<span className="text-foreground/60">/admin/tasks/:projectId/tasks</span>
									</div>
									<div className="flex items-center gap-3 text-[10px] font-mono">
										<span className="text-muted-foreground/40 min-w-[80px]">Webhooks</span>
										<span className="text-muted-foreground/60">=</span>
										<span className="text-foreground/60">/api/webhooks/stream</span>
									</div>
								</div>
							</section>
						</div>
					)}
				</div>

				{/* Footer */}
				<footer className="relative flex-shrink-0 px-6 py-3 border-t border-border/30 bg-secondary/20">
					<div className="flex items-center justify-between">
						<span className="text-[8px] font-mono text-muted-foreground/30 uppercase tracking-[0.2em]">
							wrkq taskboard v0.1
						</span>
						<div className="flex items-center gap-2 text-[8px] font-mono text-muted-foreground/30">
							<span className="uppercase tracking-wider">Press</span>
							<kbd className="px-1.5 py-0.5 border border-border/40 bg-secondary/40 text-muted-foreground/50">
								ESC
							</kbd>
							<span className="uppercase tracking-wider">to close</span>
						</div>
					</div>
				</footer>
			</div>
		</div>
	);
}
