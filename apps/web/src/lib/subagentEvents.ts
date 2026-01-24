/**
 * Utilities for grouping subagent events under their parent Task tool calls.
 *
 * Subagent events are identified by having a non-null `parent_tool_use_id`
 * that matches a Task tool's `toolUseId`.
 */

import type { SessionStreamEntry } from "@/hooks/useCpSessionStream";

/**
 * An event that may have subagent events attached to it.
 */
export type GroupedEvent = {
	entry: SessionStreamEntry;
	/** Subagent events belonging to this Task tool (if this is a Task tool_execution_start) */
	subagentEvents?: SessionStreamEntry[];
	/** Task metadata extracted from the tool input */
	taskMeta?: {
		description: string;
		subagentType: string;
		toolUseId: string;
	};
};

/**
 * Extract the tool use ID from an event (for tool_execution_start events).
 */
function getToolUseId(event: Record<string, unknown>): string | undefined {
	return event.toolUseId as string | undefined;
}

/**
 * Extract the tool name from an event.
 */
function getToolName(event: Record<string, unknown>): string | undefined {
	return event.toolName as string | undefined;
}

/**
 * Extract the parent tool use ID from an event.
 * Checks event level first (new format), then payload (legacy).
 */
function getParentToolUseId(event: Record<string, unknown>): string | undefined {
	// New format: parentToolUseId at event level
	if (typeof event.parentToolUseId === "string") {
		return event.parentToolUseId;
	}
	// Legacy format: parent_tool_use_id in payload
	const payload = event.payload as Record<string, unknown> | undefined;
	return payload?.parent_tool_use_id as string | undefined;
}

/**
 * Extract task metadata from a Task tool_execution_start event.
 */
function extractTaskMeta(
	event: Record<string, unknown>,
): { description: string; subagentType: string; toolUseId: string } | undefined {
	const toolName = getToolName(event);
	if (toolName !== "Task") return undefined;

	const toolUseId = getToolUseId(event);
	if (!toolUseId) return undefined;

	const input = event.input as Record<string, unknown> | undefined;
	if (!input) return undefined;

	return {
		description: (input.description as string) || (input.prompt as string)?.slice(0, 50) || "Task",
		subagentType: (input.subagent_type as string) || "Task",
		toolUseId,
	};
}

/**
 * Get the event kind/type.
 */
function getEventKind(event: Record<string, unknown>): string | undefined {
	return (event.kind ?? event.type) as string | undefined;
}

/**
 * Group subagent events under their parent Task tool calls.
 *
 * This function:
 * 1. Identifies Task tool_execution_start events
 * 2. Finds all events with matching parent_tool_use_id
 * 3. Attaches them as children of the Task tool event
 * 4. Removes subagent events from the top-level list
 *
 * @param entries - Session stream entries to group
 * @returns Array of grouped events with subagent events nested under Task tools
 */
export function groupSubagentEvents(entries: SessionStreamEntry[]): GroupedEvent[] {
	// First pass: identify Task tool_execution_start events and build lookup
	const taskToolMap = new Map<
		string,
		{
			index: number;
			meta: { description: string; subagentType: string; toolUseId: string };
		}
	>();

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		const event = entry.event as Record<string, unknown>;
		const kind = getEventKind(event);

		if (kind === "tool_execution_start") {
			const meta = extractTaskMeta(event);
			if (meta) {
				taskToolMap.set(meta.toolUseId, { index: i, meta });
			}
		}
	}

	// If no Task tools, return entries as-is
	if (taskToolMap.size === 0) {
		return entries.map((entry) => ({ entry }));
	}

	// Second pass: collect subagent events for each Task
	const subagentEventsMap = new Map<string, SessionStreamEntry[]>();
	const subagentEventIndices = new Set<number>();

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		const event = entry.event as Record<string, unknown>;
		const parentToolUseId = getParentToolUseId(event);

		if (parentToolUseId && taskToolMap.has(parentToolUseId)) {
			if (!subagentEventsMap.has(parentToolUseId)) {
				subagentEventsMap.set(parentToolUseId, []);
			}
			subagentEventsMap.get(parentToolUseId)!.push(entry);
			subagentEventIndices.add(i);
		}
	}

	// Third pass: build grouped events, filtering out subagent events from top level
	const result: GroupedEvent[] = [];

	for (let i = 0; i < entries.length; i++) {
		// Skip events that are nested under a Task
		if (subagentEventIndices.has(i)) {
			continue;
		}

		const entry = entries[i];
		const event = entry.event as Record<string, unknown>;
		const kind = getEventKind(event);

		// Check if this is a Task tool_execution_start
		if (kind === "tool_execution_start") {
			const meta = extractTaskMeta(event);
			if (meta) {
				const subagentEvents = subagentEventsMap.get(meta.toolUseId) || [];
				result.push({
					entry,
					taskMeta: meta,
					subagentEvents: subagentEvents.length > 0 ? subagentEvents : undefined,
				});
				continue;
			}
		}

		// Regular event
		result.push({ entry });
	}

	return result;
}

/**
 * Get the last meaningful event from a list of subagent events.
 * Prioritizes message events over tool events for the "hint" display.
 */
export function getLastSubagentHint(events: SessionStreamEntry[]): {
	kind: string;
	summary: string;
} | null {
	if (events.length === 0) return null;

	// Look backwards for the most recent meaningful event
	for (let i = events.length - 1; i >= 0; i--) {
		const event = events[i].event as Record<string, unknown>;
		const kind = getEventKind(event);

		// Prefer message events
		if (kind === "message_end" || kind === "message_start") {
			const payload = event.payload as Record<string, unknown> | undefined;
			const message = (event.message ?? payload?.message) as Record<string, unknown> | undefined;
			const content = message?.content;

			if (typeof content === "string" && content.trim()) {
				return {
					kind: "message",
					summary: content.slice(0, 80) + (content.length > 80 ? "..." : ""),
				};
			}
		}

		// Tool execution end
		if (kind === "tool_execution_end") {
			const toolName = getToolName(event);
			return {
				kind: "tool",
				summary: `${toolName || "Tool"} completed`,
			};
		}

		// Tool execution start
		if (kind === "tool_execution_start") {
			const toolName = getToolName(event);
			const input = event.input as Record<string, unknown> | undefined;
			let detail = "";

			if (toolName === "Read" && input?.file_path) {
				detail = `: ${(input.file_path as string).split("/").pop()}`;
			} else if (toolName === "Grep" && input?.pattern) {
				detail = `: "${input.pattern}"`;
			} else if (toolName === "Glob" && input?.pattern) {
				detail = `: ${input.pattern}`;
			}

			return {
				kind: "tool",
				summary: `${toolName || "Tool"}${detail}`,
			};
		}
	}

	return null;
}
