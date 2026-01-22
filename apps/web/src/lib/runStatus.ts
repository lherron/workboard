/**
 * Run status styling configuration for chat/session UIs.
 *
 * Provides consistent status labels and colors across all chat components.
 */

/**
 * Style configuration for a run status.
 */
export type RunStatusStyle = {
	/** Display label (uppercase) */
	label: string;
	/** Tailwind text color class */
	color: string;
};

/**
 * Default status styles for run states.
 * Uses amber for active states, sky for pending, and neutral for terminal states.
 */
export const runStatusStyles: Record<string, RunStatusStyle> = {
	queued: { label: "QUEUED", color: "text-sky-400" },
	running: { label: "RUNNING", color: "text-amber-400" },
	completed: { label: "COMPLETED", color: "text-slate-400" },
	failed: { label: "FAILED", color: "text-red-400" },
	cancelled: { label: "CANCELLED", color: "text-slate-500" },
	timed_out: { label: "TIMEOUT", color: "text-orange-400" },
};

/**
 * Get the style for a run status.
 * Falls back to a neutral style for unknown statuses.
 *
 * @param status - Run status string
 * @returns Status style with label and color
 */
export function getRunStatusStyle(status: string): RunStatusStyle {
	return (
		runStatusStyles[status] ?? {
			label: status.toUpperCase(),
			color: "text-slate-500",
		}
	);
}

/**
 * Check if a status represents a terminal state (run is finished).
 */
export function isTerminalStatus(status: string): boolean {
	return (
		status === "completed" ||
		status === "failed" ||
		status === "cancelled" ||
		status === "timed_out"
	);
}

/**
 * Check if a status represents an active state (run is in progress).
 */
export function isActiveStatus(status: string): boolean {
	return status === "running" || status === "queued";
}
