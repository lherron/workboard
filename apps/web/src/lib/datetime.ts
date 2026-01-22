/**
 * Parse an ISO datetime string, ensuring UTC timestamps are correctly interpreted.
 * Handles timestamps with or without 'Z' suffix.
 */
function parseDateTime(iso: string): Date | null {
	// If the string looks like an ISO datetime without timezone info, assume UTC
	// This handles cases where the API returns '2024-01-04T14:53:16' instead of '2024-01-04T14:53:16Z'
	const normalized =
		iso.includes("Z") || iso.includes("+") || iso.includes("-", 10) ? iso : `${iso}Z`;
	const date = new Date(normalized);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(iso: string | null | undefined) {
	if (!iso) return "—";
	const date = parseDateTime(iso);
	if (!date) return "—";

	const now = new Date();
	const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
	if (date.getFullYear() !== now.getFullYear()) {
		opts.year = "numeric";
	}

	return new Intl.DateTimeFormat("en-US", opts).format(date);
}

export function formatUpdated(iso: string | null | undefined) {
	if (!iso) return "—";
	const date = parseDateTime(iso);
	if (!date) return "—";

	const diffMs = Date.now() - date.getTime();
	const diffMinutes = Math.round(diffMs / 60000);

	if (diffMinutes < 60) return `${diffMinutes}m ago`;
	const diffHours = Math.round(diffMinutes / 60);
	if (diffHours < 48) return `${diffHours}h ago`;
	const diffDays = Math.round(diffHours / 24);
	return `${diffDays}d ago`;
}

export function isOverdue(iso: string | null | undefined) {
	if (!iso) return false;
	const date = parseDateTime(iso);
	if (!date) return false;
	return date.getTime() < Date.now();
}

export function formatDateTime(iso: string | null | undefined) {
	if (!iso) return "—";
	const date = parseDateTime(iso);
	if (!date) return "—";

	const opts: Intl.DateTimeFormatOptions = {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: false,
	};

	const now = new Date();
	if (date.getFullYear() !== now.getFullYear()) {
		opts.year = "numeric";
	}

	return new Intl.DateTimeFormat("en-US", opts).format(date);
}

/**
 * Format a date with full year, useful for metadata displays.
 * Always shows full year for explicit date tracking.
 */
export function formatDateFull(iso: string | null | undefined) {
	if (!iso) return "—";
	const date = parseDateTime(iso);
	if (!date) return "—";

	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

/**
 * Format datetime with full year, useful for metadata displays.
 * Always shows full year for explicit timestamp tracking.
 */
export function formatDateTimeFull(iso: string | null | undefined) {
	if (!iso) return "—";
	const date = parseDateTime(iso);
	if (!date) return "—";

	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

/**
 * Format a Unix timestamp (milliseconds) as HH:MM:SS.
 * Used for chat/session event timestamps.
 */
export function formatTimestamp(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

/**
 * Format a Unix timestamp (milliseconds) as HH:MM.
 * Shorter format for compact displays.
 */
export function formatTimestampShort(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
	});
}
