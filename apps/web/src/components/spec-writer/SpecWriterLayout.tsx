import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Network, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SpecChatPane } from "./SpecChatPane";
import { SpecEditorPane } from "./SpecEditorPane";
import { SpecGraphPane } from "./SpecGraphPane";
import { SpecNavPanel } from "./SpecNavPanel";
import { useSpecDocument } from "./hooks/useSpecDocument";
import { type ScrollTarget, specToMarkdown } from "./lib/markdown";

type Props = {
	workspaceId: string;
	specSlug: string | null;
};

/**
 * Main layout container for the Spec Writer.
 * Three-pane layout: Left nav (~20%) | Center editor (~50%) | Right chat (~30%)
 */
export function SpecWriterLayout({ workspaceId, specSlug }: Props) {
	// Use the useSpecDocument hook for all spec CRUD operations and state
	const {
		specListState,
		specState,
		isCreating,
		loadSpecList,
		handleSelectSpec,
		handleCreateSpec,
		handleDeleteSpec,
		handleSpecUpdate,
		handleSaveComplete,
		handleReload,
	} = useSpecDocument({ workspaceId, specSlug });

	// Graph pane visibility
	const [showGraph, setShowGraph] = useState(true);

	// Left nav pane collapsed state
	const [leftPaneCollapsed, setLeftPaneCollapsed] = useState(false);

	// Scroll target for graph-to-editor navigation
	const [scrollTarget, setScrollTarget] = useState<ScrollTarget | null>(null);

	// Toast notification state for clipboard and other actions
	const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
	const toastTimerRef = useRef<number | null>(null);

	// Auto-dismiss toast after 2 seconds
	useEffect(() => {
		if (toast) {
			if (toastTimerRef.current) {
				window.clearTimeout(toastTimerRef.current);
			}
			toastTimerRef.current = window.setTimeout(() => {
				setToast(null);
			}, 2000);
		}
		return () => {
			if (toastTimerRef.current) {
				window.clearTimeout(toastTimerRef.current);
			}
		};
	}, [toast]);

	// Handle copy markdown
	const handleCopyMarkdown = useCallback(() => {
		if (!specState.spec) return;

		const markdown = specToMarkdown(specState.spec);
		navigator.clipboard
			.writeText(markdown)
			.then(() => {
				setToast({ message: "Copied to clipboard", type: "success" });
			})
			.catch((err) => {
				console.error("Failed to copy to clipboard:", err);
				setToast({ message: "Failed to copy to clipboard", type: "error" });
			});
	}, [specState.spec]);

	// Handle graph node clicks for navigation
	const handleGraphNodeClick = useCallback((nodeId: string, type: "root" | "section" | "item") => {
		// Create a new scroll target object to trigger the effect
		// even if clicking the same node multiple times
		setScrollTarget({ type, id: nodeId });
	}, []);

	return (
		<div className="flex h-screen bg-background text-foreground noise-bg">
			{/* Toast notification */}
			{toast && (
				<div
					className={cn(
						"fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-none border font-mono text-xs",
						"animate-in slide-in-from-top-2 fade-in duration-200",
						toast.type === "success"
							? "bg-primary/20 border-primary/30 text-primary"
							: "bg-destructive/20 border-destructive/30 text-destructive",
					)}
				>
					{toast.type === "success" ? <Check size={14} /> : <X size={14} />}
					<span>{toast.message}</span>
				</div>
			)}

			{/* Left Nav Panel (collapsible) */}
			<aside
				className={cn(
					"border-r border-border/50 bg-secondary/40 flex-shrink-0 flex flex-col transition-all duration-200",
					leftPaneCollapsed ? "w-[40px]" : "w-[280px] min-w-[240px]",
				)}
			>
				{leftPaneCollapsed ? (
					// Collapsed state - just show expand button
					<div className="flex flex-col items-center pt-2">
						<button
							type="button"
							onClick={() => setLeftPaneCollapsed(false)}
							className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded transition-colors"
							title="Expand sidebar"
						>
							<ChevronRight size={16} />
						</button>
					</div>
				) : (
					// Expanded state - show full nav panel with collapse button
					<>
						<div className="flex items-center justify-end px-2 py-1 border-b border-border/30">
							<button
								type="button"
								onClick={() => setLeftPaneCollapsed(true)}
								className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded transition-colors"
								title="Collapse sidebar"
							>
								<ChevronLeft size={14} />
							</button>
						</div>
						<SpecNavPanel
							workspaceId={workspaceId}
							specs={specListState.specs}
							loading={specListState.loading}
							error={specListState.error}
							selectedSlug={specSlug}
							isDirty={specState.isDirty}
							isCreating={isCreating}
							onSelectSpec={handleSelectSpec}
							onCreateSpec={handleCreateSpec}
							onDeleteSpec={handleDeleteSpec}
							onCopyMarkdown={handleCopyMarkdown}
							onRetry={() => loadSpecList()}
						/>
					</>
				)}
			</aside>

			{/* Center Pane: Graph + Editor (~50%) */}
			<main className="flex-1 min-w-0 flex flex-col">
				{/* Graph pane toggle header */}
				{specState.spec && (
					<div className="flex items-center justify-between px-4 py-1.5 border-b border-border/30 bg-secondary/30 flex-shrink-0">
						<button
							type="button"
							onClick={() => setShowGraph(!showGraph)}
							className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
						>
							<Network size={12} />
							<span>graph</span>
							{showGraph ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
						</button>
					</div>
				)}

				{/* Graph pane (collapsible) */}
				{showGraph && specState.spec && (
					<div
						className={cn(
							"h-[200px] border-b border-border/30 bg-background/50 flex-shrink-0",
							"transition-all duration-200 ease-in-out",
						)}
					>
						<SpecGraphPane spec={specState.spec} onNodeClick={handleGraphNodeClick} />
					</div>
				)}

				{/* Editor pane */}
				<SpecEditorPane
					workspaceId={workspaceId}
					spec={specState.spec}
					loading={specState.loading}
					error={specState.error}
					isDirty={specState.isDirty}
					scrollTarget={scrollTarget}
					onSpecUpdate={handleSpecUpdate}
					onSaveComplete={handleSaveComplete}
					onReload={handleReload}
				/>
			</main>

			{/* Right Chat Pane (~30%) */}
			<aside className="w-[680px] min-w-[560px] border-l border-border/50 bg-secondary/20 flex-shrink-0 hidden xl:flex flex-col">
				<SpecChatPane
					workspaceId={workspaceId}
					spec={specState.spec}
					onSpecUpdate={handleSpecUpdate}
				/>
			</aside>
		</div>
	);
}
