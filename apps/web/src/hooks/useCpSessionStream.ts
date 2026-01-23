import { debugLog } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

const CP_TOKEN = import.meta.env.VITE_CP_TOKEN || "dev";

export type ContentBlock =
	| { type: "text"; text: string }
	| { type: "media_ref"; url: string; mimeType?: string; filename?: string; alt?: string }
	| { type: string; [key: string]: unknown };

type Message = {
	role: "user" | "assistant" | "toolResult";
	content: ContentBlock[] | string;
};

type ToolResult = {
	content: ContentBlock[];
	details?: Record<string, unknown>;
};

// Known event types with proper typing
export type RexSessionEventKnown =
	| {
			type: "run_queued";
			runId: string;
			projectId: string;
			queuedAt: number;
			input: { content: string };
	  }
	| { type: "run_started"; runId: string; projectId: string; startedAt: number }
	| {
			type: "run_completed";
			runId: string;
			projectId: string;
			completedAt: number;
			finalOutput?: string;
	  }
	| {
			type: "run_failed";
			runId: string;
			projectId: string;
			failedAt: number;
			error: { code: string; message: string };
	  }
	| {
			type: "run_cancelled";
			runId: string;
			projectId: string;
			cancelledAt: number;
			reason?: string;
	  }
	| { type: "message_start"; messageId?: string; message: Message }
	| {
			type: "message_update";
			messageId?: string;
			textDelta?: string;
			contentBlocks?: ContentBlock[];
	  }
	| { type: "message_end"; messageId?: string; message?: Message }
	| {
			type: "tool_execution_start";
			toolUseId: string;
			toolName: string;
			input: Record<string, unknown>;
	  }
	| { type: "tool_execution_update"; toolUseId: string; message?: string; partialOutput?: string }
	| {
			type: "tool_execution_end";
			toolUseId: string;
			toolName: string;
			result: ToolResult;
			isError?: boolean;
			durationMs?: number;
	  }
	| {
			type: "permission_request";
			requestId: string;
			runId: string;
			toolUseId: string;
			toolName: string;
			toolInput: Record<string, unknown>;
			requestedAt: number;
			actions: Array<{ id: string; label: string }>;
	  }
	| {
			type: "permission_decision";
			requestId: string;
			runId: string;
			toolUseId: string;
			decision: "allow" | "deny" | "always_allow";
			decidedAt: number;
	  }
	| { type: "notice"; level: "info" | "warn" | "error"; message: string };

// Unknown event type for handling arbitrary events from the server
export type RexSessionEventUnknown = { type: string; [key: string]: unknown };

// Union of all event types - known events are properly discriminated
export type RexSessionEvent = RexSessionEventKnown | RexSessionEventUnknown;

export type SessionStreamEntry = {
	id: string;
	seq: number;
	runId?: string;
	event: RexSessionEvent;
	source: "history" | "live";
	timestamp: number;
};

type ControlPlaneSessionEvent = {
	seq: number;
	runId?: string;
	event: RexSessionEvent;
};

type SessionEventsSnapshot = {
	seq: number;
	replay?: Array<{ seq: number; runId?: string; event: RexSessionEvent }>;
};

type ControlPlaneSessionSubscribeAck = {
	snapshot?: SessionEventsSnapshot;
};

export type UseCpSessionStreamResult = {
	entries: SessionStreamEntry[];
	isConnected: boolean;
	isConnecting: boolean;
	error: Error | null;
	clear: () => void;
};

export type UseCpSessionStreamOptions = {
	sessionId: string | null;
	enabled?: boolean;
	maxEvents?: number;
	mode?: "watch" | "attach";
	runId?: string | null;
};

function parseJsonSafe<T>(value: string): T | null {
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

function getEventTimestamp(event: RexSessionEvent, receivedAt: number): number {
	// Type assertions needed because RexSessionEventUnknown overlaps with all known types
	if (event.type === "run_queued") return (event as { queuedAt: number }).queuedAt;
	if (event.type === "run_started") return (event as { startedAt: number }).startedAt;
	if (event.type === "run_completed") return (event as { completedAt: number }).completedAt;
	if (event.type === "run_failed") return (event as { failedAt: number }).failedAt;
	if (event.type === "run_cancelled") return (event as { cancelledAt: number }).cancelledAt;
	if (event.type === "permission_request") return (event as { requestedAt: number }).requestedAt;
	if (event.type === "permission_decision") return (event as { decidedAt: number }).decidedAt;
	return receivedAt;
}

function resolveRunId(event: RexSessionEvent, fallback?: string): string | undefined {
	if (fallback) return fallback;
	if ("runId" in event && typeof event.runId === "string") return event.runId;
	return undefined;
}

export function useCpSessionStream({
	sessionId,
	enabled = true,
	maxEvents = 300,
	mode = "watch",
	runId,
}: UseCpSessionStreamOptions): UseCpSessionStreamResult {
	const [entries, setEntries] = useState<SessionStreamEntry[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
	const lastSeqRef = useRef(0);
	// Track the currently connected sessionId to prevent spurious reconnections
	const connectedSessionIdRef = useRef<string | null>(null);

	const clear = useCallback(() => {
		setEntries([]);
		lastSeqRef.current = 0;
	}, []);

	useEffect(() => {
		if (!sessionId || !enabled) {
			// Only clear if we were previously connected
			if (connectedSessionIdRef.current) {
				debugLog(
					`[SSE ${connectedSessionIdRef.current.slice(0, 8)}]`,
					"Clearing due to disabled/no sessionId",
				);
				connectedSessionIdRef.current = null;
				setEntries([]);
				lastSeqRef.current = 0;
			}
			setIsConnected(false);
			setIsConnecting(false);
			setError(null);
			return;
		}

		// Skip if already connected to this session
		if (connectedSessionIdRef.current === sessionId && eventSourceRef.current) {
			debugLog(`[SSE ${sessionId.slice(0, 8)}]`, "Already connected, skipping reconnect");
			return;
		}

		debugLog(`[SSE ${sessionId.slice(0, 8)}]`, "Initializing connection...");
		connectedSessionIdRef.current = sessionId;
		setEntries([]);
		lastSeqRef.current = 0;
		setIsConnecting(true);
		setError(null);

		const url = new URL(
			`/admin/sessions/${encodeURIComponent(sessionId)}/events/stream`,
			window.location.origin,
		);
		url.searchParams.set("token", CP_TOKEN);
		if (mode === "attach") {
			url.searchParams.set("mode", "attach");
			if (runId) {
				url.searchParams.set("runId", runId);
			}
		}
		const eventSource = new EventSource(url.toString());
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			debugLog(`[SSE ${sessionId.slice(0, 8)}]`, "Connected");
			setIsConnected(true);
			setIsConnecting(false);
			setError(null);
		};

		eventSource.addEventListener("ack", (evt) => {
			const payload = parseJsonSafe<ControlPlaneSessionSubscribeAck>((evt as MessageEvent).data);
			debugLog(
				`[SSE ${sessionId.slice(0, 8)}]`,
				"Ack received, replay count:",
				payload?.snapshot?.replay?.length ?? 0,
			);
			if (!payload?.snapshot) return;

			const snapshotSeq = payload.snapshot.seq ?? 0;
			const replay = payload.snapshot.replay ?? [];
			const receivedAt = Date.now();

			const historyEntries = replay.map((entry) => {
				const runId = resolveRunId(entry.event, entry.runId);
				return {
					id: `history-${entry.seq}-${runId ?? "no-run"}`,
					seq: entry.seq,
					runId,
					event: entry.event,
					source: "history" as const,
					timestamp: getEventTimestamp(entry.event, receivedAt),
				};
			});

			const maxSeq = historyEntries.reduce(
				(acc, entry) => (entry.seq > acc ? entry.seq : acc),
				snapshotSeq,
			);
			lastSeqRef.current = maxSeq;

			setEntries(() => {
				const sorted = [...historyEntries].sort((a, b) => a.seq - b.seq);
				if (sorted.length <= maxEvents) return sorted;
				return sorted.slice(sorted.length - maxEvents);
			});
		});

		eventSource.onmessage = (evt) => {
			const payload = parseJsonSafe<ControlPlaneSessionEvent>(evt.data);
			if (!payload) return;

			if (payload.seq <= lastSeqRef.current) {
				debugLog(`[SSE ${sessionId.slice(0, 8)}]`, "Skipping duplicate seq", payload.seq);
				return;
			}
			debugLog(`[SSE ${sessionId.slice(0, 8)}]`, "Event:", payload.event.type, "seq:", payload.seq);
			lastSeqRef.current = payload.seq;

			const receivedAt = Date.now();
			const runId = resolveRunId(payload.event, payload.runId);
			const entry: SessionStreamEntry = {
				id: `live-${payload.seq}-${runId ?? "no-run"}`,
				seq: payload.seq,
				runId,
				event: payload.event,
				source: "live",
				timestamp: getEventTimestamp(payload.event, receivedAt),
			};

			setEntries((prev) => {
				const next = [...prev, entry];
				if (next.length <= maxEvents) return next;
				return next.slice(next.length - maxEvents);
			});
		};

		eventSource.onerror = () => {
			debugLog(`[SSE ${sessionId.slice(0, 8)}]`, "Error, readyState:", eventSource.readyState);
			setIsConnected(false);
			const connecting = eventSource.readyState === EventSource.CONNECTING;
			setIsConnecting(connecting);
			if (eventSource.readyState === EventSource.CLOSED) {
				setError(new Error("Connection closed"));
				// Reset ref so reconnection is possible
				connectedSessionIdRef.current = null;
			}
		};

		return () => {
			debugLog(`[SSE ${sessionId.slice(0, 8)}]`, "Closing connection");
			eventSource.close();
			eventSourceRef.current = null;
			connectedSessionIdRef.current = null;
			setIsConnected(false);
			setIsConnecting(false);
		};
	}, [sessionId, enabled, maxEvents, mode, runId]);

	return {
		entries,
		isConnected,
		isConnecting,
		error,
		clear,
	};
}
