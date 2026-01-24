import type { RexSessionEvent, SessionStreamEntry } from "@/hooks/useCpSessionStream";
import {
	extractAttachmentsFromContent,
	extractTextFromContent,
	extractToolAttachments,
} from "./extract";
import { getEventKind, getOccurredAt } from "./normalize";
import type {
	TranscriptAssistantMessage,
	TranscriptItem,
	TranscriptToolCall,
	TranscriptUserPrompt,
} from "./types";

export type BuildTranscriptOptions = {
	includeUserPrompts?: boolean;
	includeAssistantMessages?: boolean;
	includeToolCalls?: boolean;
	/** If set, only include messages whose role is in this set. */
	includeMessageRoles?: Array<"user" | "assistant" | "toolResult" | string>;
};

type ToolStartInfo = {
	input: Record<string, unknown>;
	startedAt: number;
	seq: number;
	runId?: string;
	parentToolUseId?: string;
};

type MessageStreamInfo = {
	role: string;
	parts: string[];
	attachments: ReturnType<typeof extractAttachmentsFromContent>;
	startSeq: number;
	runId?: string;
	startedAt: number;
};

function getProp<T>(event: RexSessionEvent, key: string): T | undefined {
	return (event as Record<string, unknown>)[key] as T | undefined;
}

function makeId(prefix: string, runId: string | undefined, seq: number, suffix?: string): string {
	const run = runId ? `-${runId}` : "";
	const extra = suffix ? `-${suffix}` : "";
	return `${prefix}${run}-${seq}${extra}`;
}

export function buildTranscript(
	entries: SessionStreamEntry[],
	options: BuildTranscriptOptions = {},
): TranscriptItem[] {
	const {
		includeUserPrompts = false,
		includeAssistantMessages = true,
		includeToolCalls = true,
		includeMessageRoles,
	} = options;

	const sorted = [...entries].sort((a, b) => a.seq - b.seq);
	const items: TranscriptItem[] = [];

	const toolStartById = new Map<string, ToolStartInfo>();
	const msgStreamByKey = new Map<string, MessageStreamInfo>();
	const activeStreamKeyByRun = new Map<string, string>();
	let anonStreamCounter = 0;

	for (const entry of sorted) {
		const event = entry.event;
		const runId = entry.runId;
		const kind = getEventKind(event);
		const occurredAt = getOccurredAt(event, entry.timestamp);
		const e = event as Record<string, unknown>;

		if (kind === "run_queued" && includeUserPrompts) {
			const input = getProp<{ content?: string }>(event, "input");
			const content = input?.content;
			if (typeof content === "string" && content.trim()) {
				const item: TranscriptUserPrompt = {
					kind: "user",
					id: makeId("user", runId, entry.seq),
					seq: entry.seq,
					runId,
					occurredAt,
					content,
				};
				items.push(item);
			}
			continue;
		}

		if (kind === "tool_execution_start" && includeToolCalls) {
			const toolUseId = typeof e.toolUseId === "string" ? (e.toolUseId as string) : undefined;
			if (toolUseId) {
				// Extract parentToolUseId - check event level first (new format), then payload (legacy)
				const payload = e.payload as Record<string, unknown> | undefined;
				const parentToolUseId =
					typeof e.parentToolUseId === "string"
						? (e.parentToolUseId as string)
						: typeof payload?.parent_tool_use_id === "string"
							? (payload.parent_tool_use_id as string)
							: undefined;

				toolStartById.set(toolUseId, {
					input: (e.input as Record<string, unknown>) ?? {},
					startedAt: (e.ts as number | undefined) ?? occurredAt,
					seq: entry.seq,
					runId,
					parentToolUseId,
				});
			}
			continue;
		}

		if (kind === "tool_execution_end" && includeToolCalls) {
			const toolUseId = typeof e.toolUseId === "string" ? (e.toolUseId as string) : "";
			const toolName = (e.toolName as string) ?? "Tool";
			const isError = Boolean(e.isError);
			const startInfo = toolUseId ? toolStartById.get(toolUseId) : undefined;
			const inputFromStart = startInfo?.input;
			const inputFromEnd = (e.input as Record<string, unknown>) ?? {};
			const input =
				inputFromStart && Object.keys(inputFromStart).length > 0 ? inputFromStart : inputFromEnd;

			const endTs = (e.ts as number | undefined) ?? occurredAt;
			const durationMs =
				startInfo && endTs && startInfo.startedAt
					? endTs - startInfo.startedAt
					: (e.durationMs as number | undefined);

			const result = e.result as
				| { content?: unknown; details?: Record<string, unknown> }
				| undefined;
			const outputText = extractTextFromContent(result?.content);
			const attachments = extractToolAttachments({ toolName, input, result, isError });

			const item: TranscriptToolCall = {
				kind: "tool",
				id: toolUseId ? `tool-${toolUseId}` : makeId("tool", runId, startInfo?.seq ?? entry.seq),
				seq: startInfo?.seq ?? entry.seq,
				runId: startInfo?.runId ?? runId,
				occurredAt,
				toolUseId,
				toolName,
				input,
				isError,
				durationMs,
				outputText,
				attachments,
				parentToolUseId: startInfo?.parentToolUseId,
			};
			items.push(item);
			continue;
		}

		if (kind === "message_start" && includeAssistantMessages) {
			const msg = getProp<{ role?: string; content?: unknown }>(event, "message");
			const role = msg?.role ?? "assistant";
			if (includeMessageRoles && !includeMessageRoles.includes(role)) continue;

			const messageId = typeof e.messageId === "string" ? (e.messageId as string) : undefined;
			let key = messageId ? `mid:${messageId}` : undefined;
			if (!key) {
				if (runId) {
					key = `run:${runId}:seq:${entry.seq}`;
					activeStreamKeyByRun.set(runId, key);
				} else {
					anonStreamCounter += 1;
					key = `anon:${anonStreamCounter}`;
				}
			}

			// Even when a messageId is present, keep a per-run pointer so we can
			// gracefully finalize on run_completed if message_end is missing.
			if (runId) {
				activeStreamKeyByRun.set(runId, key);
			}

			const initialText = extractTextFromContent(msg?.content);
			const attachments = extractAttachmentsFromContent(msg?.content);
			msgStreamByKey.set(key, {
				role,
				parts: initialText ? [initialText] : [],
				attachments,
				startSeq: entry.seq,
				runId,
				startedAt: occurredAt,
			});
			continue;
		}

		if (kind === "message_update" && includeAssistantMessages) {
			const textDelta = typeof e.textDelta === "string" ? (e.textDelta as string) : undefined;
			const contentBlocks = e.contentBlocks as unknown;
			const role = "assistant";
			if (includeMessageRoles && !includeMessageRoles.includes(role)) continue;

			const messageId = typeof e.messageId === "string" ? (e.messageId as string) : undefined;
			let key = messageId ? `mid:${messageId}` : undefined;
			if (!key && runId) {
				key = activeStreamKeyByRun.get(runId);
			}
			if (!key) continue;

			const stream = msgStreamByKey.get(key);
			if (!stream) continue;

			if (textDelta) {
				stream.parts.push(textDelta);
			} else {
				const fallbackText = extractTextFromContent(contentBlocks);
				if (fallbackText) stream.parts.push(fallbackText);
			}

			// Merge any attachments.
			const newAttachments = extractAttachmentsFromContent(contentBlocks);
			if (newAttachments.length > 0) {
				stream.attachments = [...stream.attachments, ...newAttachments];
			}
			continue;
		}

		if ((kind === "message_end" || kind === "run_completed") && includeAssistantMessages) {
			const messageId = typeof e.messageId === "string" ? (e.messageId as string) : undefined;
			let key = messageId ? `mid:${messageId}` : undefined;
			if (!key && runId) {
				key = activeStreamKeyByRun.get(runId);
			}
			if (!key) continue;

			const stream = msgStreamByKey.get(key);
			if (!stream) continue;

			// message_end may include the complete message content; prefer it.
			let finalText: string | undefined;
			let finalAttachments = stream.attachments;
			if (kind === "message_end") {
				const msg = getProp<{ role?: string; content?: unknown }>(event, "message");
				const role = msg?.role ?? stream.role;
				if (includeMessageRoles && !includeMessageRoles.includes(role)) {
					msgStreamByKey.delete(key);
					if (runId) activeStreamKeyByRun.delete(runId);
					continue;
				}
				finalText = extractTextFromContent(msg?.content);
				finalAttachments = [...finalAttachments, ...extractAttachmentsFromContent(msg?.content)];
			}

			if (!finalText) {
				finalText = stream.parts.join("");
			}

			if (typeof finalText === "string" && finalText.trim()) {
				const item: TranscriptAssistantMessage = {
					kind: "assistant",
					id: makeId("assistant", stream.runId ?? runId, entry.seq, key),
					seq: stream.startSeq,
					runId: stream.runId ?? runId,
					occurredAt: occurredAt,
					content: finalText,
					attachments: finalAttachments,
				};
				items.push(item);
			}

			msgStreamByKey.delete(key);
			if (runId) activeStreamKeyByRun.delete(runId);
		}
	}

	// Preserve chronology.
	items.sort((a, b) => a.seq - b.seq);
	return items;
}

/**
 * Convenience helper for building the in-progress assistant text for a run.
 * This intentionally mirrors `buildTranscript`'s parsing logic.
 */
export function buildStreamingAssistantText(entries: SessionStreamEntry[], runId: string): string {
	const sorted = [...entries].sort((a, b) => a.seq - b.seq);
	const parts: string[] = [];
	let inRun = false;

	for (const entry of sorted) {
		if (entry.runId !== runId) continue;
		inRun = true;
		const kind = getEventKind(entry.event);
		const e = entry.event as Record<string, unknown>;

		if (kind === "message_start") {
			const msg = getProp<{ role?: string; content?: unknown }>(entry.event, "message");
			const role = msg?.role ?? "assistant";
			if (role !== "assistant") continue;
			const initial = extractTextFromContent(msg?.content);
			if (initial) parts.push(initial);
		} else if (kind === "message_update") {
			const textDelta = typeof e.textDelta === "string" ? (e.textDelta as string) : undefined;
			if (textDelta) {
				parts.push(textDelta);
			} else {
				const fallback = extractTextFromContent(e.contentBlocks);
				if (fallback) parts.push(fallback);
			}
		}
	}

	return inRun ? parts.join("") : "";
}
