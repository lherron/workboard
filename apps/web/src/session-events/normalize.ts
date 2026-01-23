import type { RexSessionEvent, SessionStreamEntry } from "@/hooks/useCpSessionStream";
import type { EventCategory } from "./types";

export function getEventKind(event: RexSessionEvent): string {
	const e = event as Record<string, unknown>;
	const type = typeof e.type === "string" ? (e.type as string) : undefined;
	const kind = typeof e.kind === "string" ? (e.kind as string) : undefined;
	return type ?? kind ?? "unknown";
}

export function getEventCategory(kind: string): EventCategory {
	if (kind.startsWith("run_")) return "run";
	if (kind.startsWith("tool_")) return "tool";
	if (kind.startsWith("message_")) return "message";
	if (kind.startsWith("permission_")) return "permission";
	if (kind === "notice") return "notice";
	return "other";
}

function getNumericProp(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Prefer server-provided timestamps (e.g. `ts`) when present; otherwise fall back
 * to the timestamp computed in the stream hook.
 */
export function getOccurredAt(event: RexSessionEvent, fallbackTimestamp: number): number {
	const e = event as Record<string, unknown>;

	// Some backends include a generic `ts`.
	const ts = getNumericProp(e.ts);
	if (ts !== undefined) return ts;

	// Known event-specific timestamps.
	const maybe =
		getNumericProp(e.queuedAt) ??
		getNumericProp(e.startedAt) ??
		getNumericProp(e.completedAt) ??
		getNumericProp(e.failedAt) ??
		getNumericProp(e.cancelledAt) ??
		getNumericProp(e.requestedAt) ??
		getNumericProp(e.decidedAt);
	if (maybe !== undefined) return maybe;

	return fallbackTimestamp;
}

export function safeStringifyCompact(value: unknown): string | undefined {
	if (value === undefined) return undefined;
	try {
		return JSON.stringify(value);
	} catch {
		return undefined;
	}
}

export function normalizeEntry(entry: SessionStreamEntry): {
	id: string;
	seq: number;
	runId?: string;
	kind: string;
	category: EventCategory;
	occurredAt: number;
	event: RexSessionEvent;
} {
	const kind = getEventKind(entry.event);
	return {
		id: entry.id,
		seq: entry.seq,
		runId: entry.runId,
		kind,
		category: getEventCategory(kind),
		occurredAt: getOccurredAt(entry.event, entry.timestamp),
		event: entry.event,
	};
}
