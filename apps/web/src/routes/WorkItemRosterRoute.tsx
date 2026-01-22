import { RosterDetailView } from "@/components/work-items/RosterDetailView";
import { useParams } from "wouter";

/**
 * Route wrapper for RosterDetailView.
 * Displays roster members and their run history for a specific work item.
 */
export function WorkItemRosterRoute() {
	const params = useParams<{ workItemId: string }>();
	const workItemId = params.workItemId;

	if (!workItemId) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-[13px] text-muted-foreground">No work item ID provided</p>
			</div>
		);
	}

	return <RosterDetailView workItemId={workItemId} />;
}
