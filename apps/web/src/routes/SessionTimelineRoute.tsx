/**
 * SessionTimelineRoute - Timeline view for session events.
 *
 * Displays events in chronological order using SessionStreamPanel.
 * Route: /sessions/:sessionId/timeline
 */

import { SessionStreamPanel } from "@/components/SessionStreamPanel";
import { MessageSquare } from "lucide-react";
import { Link, useRoute } from "wouter";

export function SessionTimelineRoute() {
	const [, params] = useRoute("/sessions/:sessionId/timeline");
	const sessionId = params?.sessionId ?? null;

	if (!sessionId) {
		return (
			<div className="flex items-center justify-center h-screen text-muted-foreground">
				No session ID provided
			</div>
		);
	}

	return (
		<div className="h-screen flex flex-col bg-background">
			{/* Header */}
			<div className="shrink-0 px-6 py-4 border-b border-border/40">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<h1 className="text-lg font-semibold text-foreground">Session Timeline</h1>
						<span className="text-xs font-mono text-muted-foreground/60 bg-muted/30 px-2 py-1 rounded">
							{sessionId}
						</span>
					</div>

					{/* View switcher */}
					<Link
						href={`/sessions/${sessionId}/chat`}
						className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border/40 rounded hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
					>
						<MessageSquare className="h-3.5 w-3.5" />
						Chat View
					</Link>
				</div>
			</div>

			{/* Timeline Panel - fills remaining space */}
			<div className="flex-1 min-h-0 p-4">
				<SessionStreamPanel sessionId={sessionId} isOpen={true} showToggle={false} fill={true} />
			</div>
		</div>
	);
}
