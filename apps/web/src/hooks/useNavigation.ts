import { useLocation, useSearch } from "wouter";

/**
 * Navigation hook for programmatic route navigation.
 * Provides typed navigation helpers for all app routes.
 */
export function useAppNavigation() {
	const [, navigate] = useLocation();
	const searchString = useSearch();

	// Preserve current query params (filter, sort) during navigation
	const preserveQueryParams = () => {
		const params = new URLSearchParams(searchString);
		// Only keep filter/sort params, remove navigation-related ones
		const preserved = new URLSearchParams();
		if (params.get("filter")) preserved.set("filter", params.get("filter")!);
		if (params.get("sort")) preserved.set("sort", params.get("sort")!);
		const qs = preserved.toString();
		return qs ? `?${qs}` : "";
	};

	return {
		/** Navigate to the global dashboard (home) */
		goToGlobalDashboard: () => navigate("/"),

		/** Navigate to projects list */
		goToProjects: () => navigate("/projects"),

		/** Navigate to plan mode */
		goToPlan: () => navigate("/plan"),

		/** Navigate to a workspace dashboard */
		goToWorkspace: (workspaceId: string) => navigate(`/workspace/${workspaceId}`),

		/** Navigate to a container within a workspace */
		goToContainer: (workspaceId: string, containerId: string) =>
			navigate(`/workspace/${workspaceId}/${containerId}${preserveQueryParams()}`),

		/** Navigate to a specific task */
		goToTask: (workspaceId: string, containerId: string, taskId: string) =>
			navigate(`/workspace/${workspaceId}/${containerId}/${taskId}${preserveQueryParams()}`),

		/** Navigate to prompt shaping page */
		goToPromptShaping: (
			workspaceId: string,
			taskId: string,
			displayNames?: { workspaceName?: string; containerTitle?: string },
		) => {
			const params = new URLSearchParams();
			if (displayNames?.workspaceName) params.set("wn", displayNames.workspaceName);
			if (displayNames?.containerTitle) params.set("ct", displayNames.containerTitle);
			const qs = params.toString();
			navigate(`/prompt-shaping/${workspaceId}/${taskId}${qs ? `?${qs}` : ""}`);
		},

		/** Navigate to container navigator view (focused single-container view) */
		goToContainerView: (workspaceId: string, containerId: string) =>
			navigate(`/container/${workspaceId}/${containerId}`),

		/**
		 * Navigate to container task detail (deep-dive view).
		 * @param taskRef - Task ID (T-xxxxx) or slug (my-task-slug)
		 */
		goToContainerViewTask: (workspaceId: string, containerId: string, taskRef: string) =>
			navigate(`/container/${workspaceId}/${containerId}/${taskRef}`),

		/** Raw navigate function for custom paths */
		navigate,
	};
}

/**
 * Hook for reading/writing filter and sort query parameters.
 * These remain as query params since they're view state, not navigation state.
 */
export function useFilterParams() {
	const [location, navigate] = useLocation();
	const searchString = useSearch();

	const params = new URLSearchParams(searchString);
	const filter = (params.get("filter") as "open" | "all") || "open";
	const sort = (params.get("sort") as "priority" | "due" | "updated_at" | "state") || "priority";

	const setFilter = (newFilter: "open" | "all") => {
		const newParams = new URLSearchParams(searchString);
		if (newFilter === "open") {
			newParams.delete("filter");
		} else {
			newParams.set("filter", newFilter);
		}
		const qs = newParams.toString();
		navigate(`${location}${qs ? `?${qs}` : ""}`, { replace: true });
	};

	const setSort = (newSort: "priority" | "due" | "updated_at" | "state") => {
		const newParams = new URLSearchParams(searchString);
		if (newSort === "priority") {
			newParams.delete("sort");
		} else {
			newParams.set("sort", newSort);
		}
		const qs = newParams.toString();
		navigate(`${location}${qs ? `?${qs}` : ""}`, { replace: true });
	};

	return { filter, sort, setFilter, setSort };
}
