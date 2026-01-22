import { type ApiClientError, fetchWorkspaceContainersTree } from "@/api/client";
import { ModeToggle, PlanModeView } from "@/components/plan";
import { useAppNavigation } from "@/hooks/useNavigation";
import type { CrossProjectContainersTreeResponse } from "@webwrkq/shared";
import { useCallback, useEffect, useState } from "react";

type WorkspaceTree = CrossProjectContainersTreeResponse["projects"][number];

/**
 * Route wrapper for PlanModeView.
 * Handles loading workspace data and mode toggle navigation.
 */
export function PlanModeRoute() {
	const { goToGlobalDashboard } = useAppNavigation();

	const [workspaceTrees, setWorkspaceTrees] = useState<WorkspaceTree[]>([]);
	const [workspacesLoading, setWorkspacesLoading] = useState(true);
	const [_workspacesError, setWorkspacesError] = useState<ApiClientError | null>(null);

	const loadWorkspaceTrees = useCallback(() => {
		const controller = new AbortController();
		setWorkspacesLoading(true);
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
		const abort = loadWorkspaceTrees();
		return abort;
	}, [loadWorkspaceTrees]);

	const handleModeChange = useCallback(
		(newMode: "execute" | "plan") => {
			if (newMode === "execute") {
				goToGlobalDashboard();
			}
			// Already in plan mode if on this route
		},
		[goToGlobalDashboard],
	);

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-background text-foreground noise-bg">
			{/* Header with mode toggle */}
			<header className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-secondary/40 backdrop-blur-sm flex-shrink-0">
				<div className="flex items-center gap-3">
					<div className="w-6 h-6 border border-primary/50 flex items-center justify-center bg-primary/10">
						<span className="text-primary text-[10px] font-bold font-mono">wq</span>
					</div>
					<span className="text-[12px] font-mono text-foreground/60 hidden sm:inline">webwrkq</span>
				</div>
				<ModeToggle mode="plan" onChange={handleModeChange} />
			</header>

			{/* Plan Mode content */}
			<div className="flex-1 overflow-hidden">
				<PlanModeView workspaces={workspaceTrees} workspacesLoading={workspacesLoading} />
			</div>
		</div>
	);
}
