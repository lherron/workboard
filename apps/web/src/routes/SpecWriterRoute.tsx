import { SpecWriterLayout } from "@/components/spec-writer/SpecWriterLayout";
import { useParams } from "wouter";

/**
 * Route wrapper for Spec Writer views.
 * Handles /projects/:projectId/spec-writer and /projects/:projectId/spec-writer/:specSlug routes.
 */
export function SpecWriterRoute() {
	const params = useParams<{ projectId?: string; specSlug?: string }>();
	const { projectId, specSlug } = params;

	if (!projectId) {
		return (
			<div className="flex items-center justify-center h-screen bg-background text-foreground">
				<p className="text-muted-foreground font-mono">Missing project ID</p>
			</div>
		);
	}

	return <SpecWriterLayout workspaceId={projectId} specSlug={specSlug || null} />;
}
