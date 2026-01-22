import { SpecWriterLayout } from "@/components/spec-writer/SpecWriterLayout";
import { useParams } from "wouter";

/**
 * Route wrapper for Spec Writer views.
 * Handles /workspace/:workspaceId/spec-writer and /workspace/:workspaceId/spec-writer/:specSlug routes.
 */
export function SpecWriterRoute() {
	const params = useParams<{ workspaceId?: string; specSlug?: string }>();
	const { workspaceId, specSlug } = params;

	if (!workspaceId) {
		return (
			<div className="flex items-center justify-center h-screen bg-background text-foreground">
				<p className="text-muted-foreground font-mono">Missing workspace ID</p>
			</div>
		);
	}

	return <SpecWriterLayout workspaceId={workspaceId} specSlug={specSlug || null} />;
}
