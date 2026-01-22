import { WorkItemsView } from "@/components/work-items/WorkItemsView";

/**
 * Route wrapper for WorkItemsView.
 * Displays all tasks across projects organized by run_status in kanban columns.
 */
export function WorkItemsRoute() {
	return <WorkItemsView />;
}
