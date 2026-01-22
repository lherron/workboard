import { ContainerDetailView } from "@/components/roadmap/ContainerDetailView";
import { ContainerNavigator } from "@/components/roadmap/ContainerNavigator";
import { useParams } from "wouter";

/**
 * Route wrapper for ContainerNavigator and ContainerDetailView.
 * Handles /container/:workspaceId/:containerId route (navigator view)
 * and /container/:workspaceId/:containerId/:taskRef route (detail view).
 *
 * taskRef can be either:
 * - A task ID (e.g., "T-00528")
 * - A task slug (e.g., "my-task-slug")
 */
export function ContainerViewRoute() {
	const params = useParams<{ workspaceId: string; containerId: string; taskRef?: string }>();

	if (!params.workspaceId || !params.containerId) {
		return (
			<div className="h-screen flex items-center justify-center bg-background">
				<div className="text-center">
					<p className="text-muted-foreground">Missing workspace or container ID</p>
				</div>
			</div>
		);
	}

	// If taskRef is present, show the detail view
	if (params.taskRef) {
		return (
			<ContainerDetailView
				workspaceId={params.workspaceId}
				containerId={params.containerId}
				taskRef={params.taskRef}
			/>
		);
	}

	return <ContainerNavigator workspaceId={params.workspaceId} containerId={params.containerId} />;
}
