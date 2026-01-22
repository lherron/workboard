import { type ApiClientError, fetchWorkspaceContainersTree } from "@/api/client";
import { GlobalDashboard } from "@/components/GlobalDashboard";
import { Sidebar } from "@/components/Sidebar";
import { ModeToggle } from "@/components/plan";
import { useAppNavigation, useFilterParams } from "@/hooks/useNavigation";
import type { CrossProjectContainersTreeResponse } from "@webwrkq/shared";
import { useCallback, useEffect, useState } from "react";

type WorkspaceTree = CrossProjectContainersTreeResponse["projects"][number];

/**
 * Route wrapper for GlobalDashboard.
 * Handles loading workspace data and providing navigation callbacks.
 */
export function GlobalDashboardRoute() {
	const { goToWorkspace, goToTask, goToPlan, navigate } = useAppNavigation();
	const { filter: _filter, setFilter } = useFilterParams();

	const [workspaceTrees, setWorkspaceTrees] = useState<WorkspaceTree[]>([]);
	const [workspacesLoading, setWorkspacesLoading] = useState(true);
	const [workspacesError, setWorkspacesError] = useState<ApiClientError | null>(null);
	const [workspacesRequestId, setWorkspacesRequestId] = useState(0);

	// For sidebar expanded state
	const [expanded, setExpanded] = useState<Set<string>>(new Set());

	const loadWorkspaceTrees = useCallback((isRefresh = false) => {
		const controller = new AbortController();
		if (!isRefresh) {
			setWorkspacesLoading(true);
		}
		setWorkspacesError(null);

		fetchWorkspaceContainersTree(controller.signal)
			.then((resp) => {
				setWorkspaceTrees(resp.projects);
				setWorkspacesLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setWorkspacesError(err as ApiClientError);
				setWorkspacesLoading(false);
			});

		return () => controller.abort();
	}, []);

	useEffect(() => {
		const abort = loadWorkspaceTrees(workspacesRequestId > 0);
		return abort;
	}, [loadWorkspaceTrees, workspacesRequestId]);

	const expandedKey = (workspaceId: string, containerId: string) => `${workspaceId}:${containerId}`;

	const toggleExpanded = (workspaceId: string, containerId: string) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			const key = expandedKey(workspaceId, containerId);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	};

	const handleSelectTask = useCallback(
		(workspaceId: string, containerId: string, taskId: string, taskState?: string) => {
			// Switch to 'all' filter when navigating to a completed/archived task
			if (taskState === "completed" || taskState === "archived") {
				setFilter("all");
			}
			goToTask(workspaceId, containerId, taskId);
		},
		[goToTask, setFilter],
	);

	const handleModeChange = useCallback(
		(newMode: "execute" | "plan") => {
			if (newMode === "plan") {
				goToPlan();
			}
			// Already in execute mode if on this route
		},
		[goToPlan],
	);

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-background text-foreground noise-bg">
			{/* Header with mode toggle (mobile) */}
			<header className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-secondary/40 backdrop-blur-sm flex-shrink-0 md:hidden">
				<div className="flex items-center gap-3">
					<div className="w-6 h-6 border border-primary/50 flex items-center justify-center bg-primary/10">
						<span className="text-primary text-[10px] font-bold font-mono">wq</span>
					</div>
					<span className="text-[12px] font-mono text-foreground/60">webwrkq</span>
				</div>
				<ModeToggle mode="execute" onChange={handleModeChange} />
			</header>

			<div className="flex flex-1 overflow-hidden md:flex-row">
				<aside className="w-full bg-secondary/60 md:w-[320px] md:border-r md:border-border/50 flex-shrink-0">
					{/* Mode toggle in sidebar header for desktop */}
					<div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-border/30">
						<div className="flex items-center gap-2">
							<div className="w-5 h-5 border border-primary/50 flex items-center justify-center bg-primary/10">
								<span className="text-primary text-[9px] font-bold font-mono">wq</span>
							</div>
							<span className="text-[11px] font-mono text-foreground/50">webwrkq</span>
						</div>
						<ModeToggle mode="execute" onChange={handleModeChange} />
					</div>
					<Sidebar
						workspaces={workspaceTrees}
						loading={workspacesLoading}
						error={workspacesError}
						expanded={expanded}
						selectedWorkspaceId={null}
						selectedContainerId={null}
						showGlobalDashboard={true}
						onSelectWorkspace={(workspaceId) => goToWorkspace(workspaceId)}
						onSelect={(workspaceId, containerId) => {
							navigate(`/workspace/${workspaceId}/${containerId}`);
						}}
						onShowGlobalDashboard={() => {
							// Already on global dashboard
						}}
						onToggle={toggleExpanded}
						onRetry={loadWorkspaceTrees}
					/>
				</aside>

				<main className="flex-1 overflow-hidden">
					<GlobalDashboard
						workspaces={workspaceTrees}
						onSelectWorkspace={goToWorkspace}
						onSelectTask={handleSelectTask}
						onTasksChanged={() => {
							setWorkspacesRequestId((n) => n + 1);
						}}
					/>
				</main>
			</div>
		</div>
	);
}
