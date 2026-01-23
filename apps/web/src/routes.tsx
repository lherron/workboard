import { ConciergePanel, ConciergeToggle, useConcierge } from "@/components/concierge";
import { ActorsRoute } from "@/routes/ActorsRoute";
import { ContainerViewRoute } from "@/routes/ContainerViewRoute";
import { PlanModeRoute } from "@/routes/PlanModeRoute";
import { ProjectDetailRoute } from "@/routes/ProjectDetailRoute";
import { ProjectRosterRoute } from "@/routes/ProjectRosterRoute";
import { ProjectsIndexRoute } from "@/routes/ProjectsIndexRoute";
import { PromptShapingRoute } from "@/routes/PromptShapingRoute";
import { SessionChatRoute } from "@/routes/SessionChatRoute";
import { SessionTimelineRoute } from "@/routes/SessionTimelineRoute";
import { SpecWriterRoute } from "@/routes/SpecWriterRoute";
import { WorkItemRosterRoute } from "@/routes/WorkItemRosterRoute";
import { WorkItemsRoute } from "@/routes/WorkItemsRoute";
import { WorkspaceRoute } from "@/routes/WorkspaceRoute";
import { Redirect, Route, Switch } from "wouter";

/**
 * Route structure:
 *
 * /                                              → Redirect to /projects
 * /projects                                      → ProjectsIndex (all projects with rosters)
 * /projects/:projectId                           → ProjectDetail (project hub: roster, tasks, specs, runs)
 * /projects/:projectId/work-items                → WorkItemsView (run status dashboard, project-scoped)
 * /projects/:projectId/work-items/:workItemId/roster → RosterDetailView (agent roster + run history)
 * /projects/:projectId/roster                    → ProjectRosterView (project-level agent roster)
 * /projects/:projectId/roster/:roleName          → ProjectRosterView with role selected
 * /projects/:projectId/roster/:roleName/:sessionId → ProjectRosterView with role and session selected
 * /plan                                          → PlanModeView
 * /actors                                        → ActorManagement
 * /workspace/:workspaceId                        → ProjectDashboard
 * /workspace/:workspaceId/spec-writer            → SpecWriter (spec list, auto-select newest)
 * /workspace/:workspaceId/spec-writer/:specSlug  → SpecWriter with specific spec open
 * /workspace/:workspaceId/:containerId           → TaskList (auto-select first task)
 * /workspace/:workspaceId/:containerId/:taskId   → TaskList + TaskDetail
 * /prompt-shaping/:workspaceId/:taskId           → PromptShapingPage
 * /sessions/:sessionId/timeline                  → SessionTimeline (event-by-event view)
 * /sessions/:sessionId/chat                      → SessionChat (run-grouped view)
 * /container/:workspaceId/:containerId           → ContainerView (focused container navigator)
 * /container/:workspaceId/:containerId/:taskRef  → ContainerDetail (deep-dive view)
 *                                                  taskRef: T-xxxxx (ID) or slug-name (slug)
 *
 * Query params (retained for view state):
 * ?filter=open|all
 * ?sort=priority|due|updated_at
 */
const PANEL_WIDTH = 380;

export function AppRoutes() {
	const { isOpen, isPinned } = useConcierge();
	const showEmbedded = isOpen && isPinned;

	return (
		<>
			{/* Global UI Concierge - available on all routes */}
			<ConciergeToggle />
			<ConciergePanel />

			{/* Main content area - shrinks when panel is pinned */}
			<div
				className="transition-[margin] duration-300 ease-out"
				style={{ marginRight: showEmbedded ? PANEL_WIDTH : 0 }}
			>
				<Switch>
					<Route
						path="/container/:workspaceId/:containerId/:taskRef"
						component={ContainerViewRoute}
					/>
					<Route path="/container/:workspaceId/:containerId" component={ContainerViewRoute} />
					<Route
						path="/projects/:projectId/work-items/:workItemId/roster"
						component={WorkItemRosterRoute}
					/>
					<Route path="/projects/:projectId/work-items" component={WorkItemsRoute} />
					<Route
						path="/projects/:projectId/roster/:roleName/:sessionId"
						component={ProjectRosterRoute}
					/>
					<Route path="/projects/:projectId/roster/:roleName" component={ProjectRosterRoute} />
					<Route path="/projects/:projectId/roster" component={ProjectRosterRoute} />
					<Route path="/projects/:projectId" component={ProjectDetailRoute} />
					<Route path="/projects" component={ProjectsIndexRoute} />
					<Route path="/plan" component={PlanModeRoute} />
					<Route path="/actors" component={ActorsRoute} />
					<Route path="/sessions/:sessionId/timeline" component={SessionTimelineRoute} />
					<Route path="/sessions/:sessionId/chat" component={SessionChatRoute} />
					<Route path="/prompt-shaping/:workspaceId/:taskId" component={PromptShapingRoute} />
					{/* Spec Writer routes - must be before greedy :containerId routes */}
					<Route path="/workspace/:workspaceId/spec-writer/:specSlug" component={SpecWriterRoute} />
					<Route path="/workspace/:workspaceId/spec-writer" component={SpecWriterRoute} />
					<Route path="/workspace/:workspaceId/:containerId/:taskId" component={WorkspaceRoute} />
					<Route path="/workspace/:workspaceId/:containerId" component={WorkspaceRoute} />
					<Route path="/workspace/:workspaceId" component={WorkspaceRoute} />
					<Route path="/">
						<Redirect to="/projects" />
					</Route>
				</Switch>
			</div>
		</>
	);
}
