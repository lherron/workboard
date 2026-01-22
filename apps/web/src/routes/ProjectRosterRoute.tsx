import { ProjectRosterView } from "@/components/project-roster/ProjectRosterView";
import { useParams } from "wouter";

export function ProjectRosterRoute() {
	const params = useParams<{ projectId: string; roleName?: string }>();
	const { projectId, roleName } = params;

	if (!projectId) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-sm text-muted-foreground">No project specified</p>
			</div>
		);
	}

	return <ProjectRosterView projectId={projectId} initialRoleName={roleName} />;
}
