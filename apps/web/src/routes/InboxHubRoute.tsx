import { InboxHub } from "@/components/inbox-hub";
import { useParams } from "wouter";

/**
 * Route wrapper for InboxHub.
 * Handles both base route (/inbox-hub) and task detail route (/inbox-hub/:workspaceId/:taskId).
 * When task params are present, InboxHub will auto-open the task detail modal.
 */
export function InboxHubRoute() {
	const params = useParams<{ workspaceId?: string; taskId?: string }>();

	return <InboxHub initialWorkspaceId={params.workspaceId} initialTaskId={params.taskId} />;
}
