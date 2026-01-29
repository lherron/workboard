import type { RexSessionEvent, SessionStreamEntry } from "@/hooks/useCpSessionStream";
import {
	extractAttachmentsFromContent,
	extractTextFromContent,
	extractToolAttachments,
	summarizeToolInput,
} from "./extract";
import { getEventCategory, getEventKind, getOccurredAt, safeStringifyCompact } from "./normalize";
import type { RenderableEvent } from "./types";

function titleCaseKind(kind: string): string {
	return kind.replace(/_/g, " ");
}

function ensureDetail(text?: string, format: "plain" | "markdown" | "json" = "plain") {
	if (!text) return undefined;
	const trimmed = text.trim();
	if (!trimmed) return undefined;
	return { format, text: trimmed } as const;
}

function getProp<T>(event: RexSessionEvent, key: string): T | undefined {
	return (event as Record<string, unknown>)[key] as T | undefined;
}

export function toRenderableEvent(entry: SessionStreamEntry): RenderableEvent | null {
	if (!entry?.event) return null;
	const event = entry.event;
	const kind = getEventKind(event);
	const category = getEventCategory(kind);
	const occurredAt = getOccurredAt(event, entry.timestamp);

	// Keep ids stable across re-renders.
	const id = entry.id;

	const base: Pick<
		RenderableEvent,
		"id" | "seq" | "runId" | "kind" | "category" | "occurredAt" | "attachments" | "rawEvent"
	> = {
		id,
		seq: entry.seq,
		runId: entry.runId,
		kind,
		category,
		occurredAt,
		attachments: [],
		rawEvent: event,
	};

	switch (kind) {
		case "run_queued": {
			const input = getProp<{ content?: string }>(event, "input");
			return {
				...base,
				title: "Run queued",
				detail: ensureDetail(input?.content, "plain"),
				status: "pending",
			};
		}
		case "run_started":
			return { ...base, title: "Run started", status: "start" };
		case "run_completed": {
			const finalOutput = getProp<string>(event, "finalOutput");
			return {
				...base,
				title: "Run completed",
				detail: ensureDetail(finalOutput, "plain"),
				status: "success",
			};
		}
		case "run_failed": {
			const error = getProp<{ message?: string }>(event, "error");
			return {
				...base,
				title: "Run failed",
				detail: ensureDetail(error?.message ?? "Execution failed", "plain"),
				status: "error",
			};
		}
		case "run_cancelled": {
			const reason = getProp<string>(event, "reason");
			return {
				...base,
				title: "Run cancelled",
				detail: ensureDetail(reason, "plain"),
				status: "success",
			};
		}

		case "tool_execution_start": {
			const toolName = getProp<string>(event, "toolName") ?? "Tool";
			const input = getProp<Record<string, unknown>>(event, "input") ?? {};
			return {
				...base,
				title: toolName,
				detail: ensureDetail(safeStringifyCompact(input), "json"),
				status: "start",
				meta: {
					toolName,
					toolUseId: getProp<string>(event, "toolUseId"),
					inputSummary: summarizeToolInput(input),
				},
			};
		}
		case "tool_execution_update": {
			const message = getProp<string>(event, "message");
			const partialOutput = getProp<string>(event, "partialOutput");
			return {
				...base,
				title: "Tool update",
				detail: ensureDetail(message ?? partialOutput, "plain"),
				status: "pending",
				meta: { toolUseId: getProp<string>(event, "toolUseId") },
			};
		}
		case "tool_execution_end": {
			const toolName = getProp<string>(event, "toolName") ?? "Tool";
			const result = getProp<{ content?: unknown; details?: Record<string, unknown> }>(
				event,
				"result",
			);
			const isError = Boolean(getProp<boolean>(event, "isError"));
			const durationMs = getProp<number>(event, "durationMs");
			const input = getProp<Record<string, unknown>>(event, "input");
			const attachments = extractToolAttachments({ toolName, input, result, isError });
			const text = extractTextFromContent(result?.content);
			return {
				...base,
				title: toolName,
				detail: ensureDetail(text, "plain"),
				status: isError ? "error" : "success",
				attachments,
				meta: {
					toolName,
					toolUseId: getProp<string>(event, "toolUseId"),
					isError,
					durationMs,
					inputSummary: summarizeToolInput(input),
				},
			};
		}

		case "message_start": {
			const message = getProp<{ role?: string; content?: unknown }>(event, "message");
			const role = message?.role ?? "assistant";
			const contentText = extractTextFromContent(message?.content);
			const attachments = extractAttachmentsFromContent(message?.content);
			return {
				...base,
				title: `${role} message start`,
				detail: ensureDetail(contentText, "markdown"),
				status: "start",
				attachments,
				meta: {
					role,
					phase: "start",
					messageId: getProp<string>(event, "messageId"),
				},
			};
		}
		case "message_update": {
			const textDelta = getProp<string>(event, "textDelta");
			const contentBlocks = getProp<unknown[]>(event, "contentBlocks");
			const contentText = textDelta ?? extractTextFromContent(contentBlocks);
			const attachments = extractAttachmentsFromContent(contentBlocks);
			return {
				...base,
				title: "Message update",
				detail: ensureDetail(contentText, "markdown"),
				status: "pending",
				attachments,
				meta: {
					role: "assistant",
					phase: "update",
					messageId: getProp<string>(event, "messageId"),
				},
			};
		}
		case "message_end": {
			const message = getProp<{ role?: string; content?: unknown }>(event, "message");
			const role = message?.role ?? "assistant";
			const contentText = extractTextFromContent(message?.content);
			const attachments = extractAttachmentsFromContent(message?.content);
			return {
				...base,
				title: `${role} message end`,
				detail: ensureDetail(contentText, "markdown"),
				status: "success",
				attachments,
				meta: {
					role,
					phase: "end",
					messageId: getProp<string>(event, "messageId"),
				},
			};
		}

		case "permission_request": {
			const toolName = getProp<string>(event, "toolName");
			const toolInput = getProp<Record<string, unknown>>(event, "toolInput");
			return {
				...base,
				title: `Permission requested${toolName ? `: ${toolName}` : ""}`,
				detail: ensureDetail(safeStringifyCompact(toolInput), "json"),
				status: "pending",
				meta: { toolName },
			};
		}
		case "permission_decision": {
			const decision = getProp<"allow" | "deny" | "always_allow">(event, "decision");
			const approved = decision === "allow" || decision === "always_allow";
			return {
				...base,
				title: `Permission ${decision ?? "decision"}`,
				status: approved ? "success" : "error",
				meta: { permissionDecision: decision },
			};
		}

		case "notice": {
			const level = getProp<"info" | "warn" | "error">(event, "level") ?? "info";
			const message = getProp<string>(event, "message") ?? "";
			return {
				...base,
				title: "Notice",
				detail: ensureDetail(message, "plain"),
				status: level === "error" ? "error" : level === "warn" ? "pending" : "success",
				meta: { noticeLevel: level },
			};
		}

		// Agent lifecycle events (pi-compatible)
		case "agent_start": {
			const sessionId = getProp<string>(event, "sessionId");
			return {
				...base,
				title: "Agent started",
				detail: sessionId ? ensureDetail(`Session: ${sessionId}`, "plain") : undefined,
				status: "start",
			};
		}
		case "agent_end": {
			const reason = getProp<string>(event, "reason");
			return {
				...base,
				title: "Agent ended",
				detail: ensureDetail(reason, "plain"),
				status: "success",
			};
		}

		// Turn lifecycle events
		case "turn_start": {
			const turnId = getProp<string>(event, "turnId");
			return {
				...base,
				title: "Turn started",
				detail: turnId ? ensureDetail(`Turn: ${turnId}`, "plain") : undefined,
				status: "start",
			};
		}
		case "turn_end": {
			const turnId = getProp<string>(event, "turnId");
			return {
				...base,
				title: "Turn ended",
				detail: turnId ? ensureDetail(`Turn: ${turnId}`, "plain") : undefined,
				status: "success",
			};
		}

		// Session runtime events (new in CP migration 029)
		case "continuation_key_observed": {
			const provider = getProp<string>(event, "provider");
			return {
				...base,
				title: "Continuation key observed",
				detail: ensureDetail(`Provider: ${provider ?? "unknown"}`, "plain"),
				status: "success",
				meta: { provider },
			};
		}
		case "harness_process_started": {
			const processId = getProp<string>(event, "harnessProcessId");
			const provider = getProp<string>(event, "provider");
			const frontend = getProp<string>(event, "frontend");
			return {
				...base,
				title: "Harness process started",
				detail: ensureDetail(`${frontend ?? "harness"} (${provider ?? "unknown"})`, "plain"),
				status: "start",
				meta: { processId, provider, frontend },
			};
		}
		case "harness_process_exited": {
			const processId = getProp<string>(event, "harnessProcessId");
			const exitCode = getProp<number>(event, "exitCode");
			return {
				...base,
				title: "Harness process exited",
				detail:
					exitCode !== undefined ? ensureDetail(`Exit code: ${exitCode}`, "plain") : undefined,
				status: exitCode === 0 ? "success" : "error",
				meta: { processId, exitCode },
			};
		}
		case "tmux_pane_bound": {
			const pane = getProp<{ paneId?: string }>(event, "tmuxPane");
			return {
				...base,
				title: "Terminal attached",
				detail: pane?.paneId ? ensureDetail(`Pane: ${pane.paneId}`, "plain") : undefined,
				status: "success",
			};
		}
		case "tmux_pane_unbound": {
			return {
				...base,
				title: "Terminal detached",
				status: "success",
			};
		}
		case "ghostty_surface_bound": {
			const surfaceId = getProp<string>(event, "ghosttySurfaceId");
			return {
				...base,
				title: "Ghostty surface bound",
				detail: surfaceId
					? ensureDetail(`Surface: ${surfaceId.slice(0, 8)}...`, "plain")
					: undefined,
				status: "success",
			};
		}
		case "ghostty_surface_unbound": {
			return {
				...base,
				title: "Ghostty surface unbound",
				status: "success",
			};
		}

		default: {
			// Generic, non-crashy fallback. Include a compact JSON payload when possible.
			const compact = safeStringifyCompact(event as unknown as Record<string, unknown>);
			return {
				...base,
				title: titleCaseKind(kind),
				detail: ensureDetail(compact, "json"),
				status: category === "other" ? undefined : "success",
			};
		}
	}
}
