import { fetchWorkspaceSpec, startDetachedRun, updateWorkspaceSpec } from "@/api/client";
import { type SessionStreamEntry, useCpSessionStream } from "@/hooks/useCpSessionStream";
import type { RunLike } from "@/lib/chat";
import { debugLog } from "@/lib/utils";
import { buildStreamingAssistantText, buildTranscript } from "@/session-events";
import type { SpecDocument } from "@workboard/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: number;
	runId?: string;
};

export type UseArchitectChatOptions = {
	workspaceId: string;
	spec: SpecDocument | null;
	onSpecUpdate: (spec: SpecDocument) => void;
	/** Polling interval in ms for detecting agent spec updates. Default: 2000 */
	pollIntervalMs?: number;
};

export type UseArchitectChatResult = {
	messages: ChatMessage[];
	/** Session stream entries (sorted by seq) */
	entries: SessionStreamEntry[];
	/** Runs derived from entries for grouping */
	runs: RunLike[];
	isConnected: boolean;
	isConnecting: boolean;
	isStreaming: boolean;
	currentStreamText: string;
	error: Error | null;
	/** Whether a continuation key is available for terminal resume */
	hasContinuationKey: boolean;

	sendMessage: (prompt: string) => Promise<void>;
	isSending: boolean;
};

/**
 * Build chat messages from session stream entries.
 * Agent now updates specs directly via API, so we don't parse mutations from messages.
 */
function buildMessagesFromEntries(entries: SessionStreamEntry[]): ChatMessage[] {
	const transcript = buildTranscript(entries, {
		includeUserPrompts: true,
		includeToolCalls: false,
		includeAssistantMessages: true,
		includeMessageRoles: ["assistant"],
	});

	return transcript
		.filter((item) => item.kind === "user" || item.kind === "assistant")
		.map((item) => ({
			id: item.id,
			role: item.kind as "user" | "assistant",
			content: item.content,
			timestamp: item.occurredAt,
			runId: item.runId,
		}))
		.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Hook for managing architect chat session.
 *
 * The architect agent updates specs directly via the Control Plane API.
 * This hook handles:
 * - Session creation/resume
 * - Message streaming
 * - Polling for spec updates made by the agent
 */
export function useArchitectChat({
	workspaceId,
	spec,
	onSpecUpdate,
	pollIntervalMs = 2000,
}: UseArchitectChatOptions): UseArchitectChatResult {
	const [isSending, setIsSending] = useState(false);
	const [currentStreamText, setCurrentStreamText] = useState("");
	const [sendError, setSendError] = useState<Error | null>(null);

	// Track current spec for polling comparison
	const specRef = useRef<SpecDocument | null>(null);
	specRef.current = spec;

	// Get session ID from spec metadata
	const sessionId = spec?.metadata.sessionId || null;

	// Connect to session stream
	const {
		entries,
		isConnected,
		isConnecting,
		error: streamError,
	} = useCpSessionStream({
		sessionId,
		enabled: !!sessionId,
		maxEvents: 2000,
		mode: "watch",
	});

	// Build messages from entries
	const messages = useMemo(() => buildMessagesFromEntries(entries), [entries]);

	// Sort entries by sequence for consistent display
	const sortedEntries = useMemo(() => [...entries].sort((a, b) => a.seq - b.seq), [entries]);

	// Derive runs from entries (extract from run_started events)
	const runs = useMemo<RunLike[]>(() => {
		const runMap = new Map<string, RunLike>();

		for (const entry of sortedEntries) {
			const runId = entry.runId;
			if (!runId) continue;

			const eventType = entry.event.type ?? (entry.event as Record<string, unknown>).kind;

			if (eventType === "run_started") {
				runMap.set(runId, {
					runId,
					status: "running",
					createdAt: entry.timestamp,
				});
			} else if (
				eventType === "run_completed" ||
				eventType === "run_failed" ||
				eventType === "run_cancelled"
			) {
				const existing = runMap.get(runId);
				if (existing) {
					runMap.set(runId, {
						...existing,
						status: eventType === "run_completed" ? "completed" : "failed",
						completedAt: entry.timestamp,
					});
				}
			}
		}

		return Array.from(runMap.values()).sort((a, b) => a.createdAt - b.createdAt);
	}, [sortedEntries]);

	// Check if currently streaming (has active run)
	const isStreaming = useMemo(() => {
		const lastEntry = sortedEntries[sortedEntries.length - 1];
		if (!lastEntry) return false;
		const runEvents = sortedEntries.filter((e) => e.runId === lastEntry.runId);
		const hasStarted = runEvents.some((e) => e.event.type === "run_started");
		const hasEnded = runEvents.some((e) =>
			["run_completed", "run_failed", "run_cancelled"].includes(e.event.type),
		);
		return hasStarted && !hasEnded;
	}, [sortedEntries]);

	// Track streaming text for live display
	useEffect(() => {
		if (!isStreaming) {
			setCurrentStreamText("");
			return;
		}

		const lastEntry = sortedEntries[sortedEntries.length - 1];
		if (!lastEntry?.runId) return;
		setCurrentStreamText(buildStreamingAssistantText(sortedEntries, lastEntry.runId));
	}, [sortedEntries, isStreaming]);

	// Check if continuation key is available (for terminal resume capability)
	// Look for continuation_key_observed event or check payload.session_id in events
	const hasContinuationKey = useMemo(() => {
		for (const entry of sortedEntries) {
			const event = entry.event as Record<string, unknown>;
			// Check for explicit continuation_key_observed event (new in migration 029)
			if (event.type === "continuation_key_observed") {
				debugLog("[ArchitectChat]", "Found continuation_key_observed event");
				return true;
			}
			// Fallback: check for session_id in payload (legacy support)
			const payload = event.payload as Record<string, unknown> | undefined;
			if (typeof payload?.session_id === "string") {
				debugLog("[ArchitectChat]", "Found session_id in payload");
				return true;
			}
		}
		return false;
	}, [sortedEntries]);

	// Poll for spec updates made by the agent
	useEffect(() => {
		const currentSpec = specRef.current;
		if (!sessionId || !currentSpec || !workspaceId) return;

		const pollSpec = async () => {
			try {
				const response = await fetchWorkspaceSpec(workspaceId, currentSpec.slug);
				const latestSpec = specRef.current;
				// Only update if rev has changed
				if (response.spec.rev > (latestSpec?.rev ?? 0)) {
					debugLog("[ArchitectChat]", "Spec updated by agent", {
						oldRev: latestSpec?.rev,
						newRev: response.spec.rev,
					});
					onSpecUpdate(response.spec);
				}
			} catch (err) {
				// Silently ignore polling errors - spec might be temporarily unavailable
				debugLog("[ArchitectChat]", "Polling error (ignored):", err);
			}
		};

		const interval = setInterval(pollSpec, pollIntervalMs);
		return () => clearInterval(interval);
	}, [sessionId, workspaceId, onSpecUpdate, pollIntervalMs]);

	// Send a message to the architect
	const sendMessage = useCallback(
		async (prompt: string) => {
			const currentSpec = specRef.current;
			debugLog("[ArchitectChat]", "sendMessage called", {
				prompt: prompt.slice(0, 50),
				workspaceId,
				hasSpec: !!currentSpec,
			});
			if (!currentSpec || !workspaceId) {
				debugLog("[ArchitectChat]", "Early return - missing spec or workspaceId");
				return;
			}

			setIsSending(true);
			setSendError(null);

			try {
				let currentSessionId = currentSpec.metadata.sessionId;
				const sessionPolicy = currentSessionId ? "resume" : "new";

				// Only include spec context on first message of a new session
				// Resumed sessions already have the context from previous messages
				let fullPrompt: string;
				if (sessionPolicy === "new") {
					// Provide spec context - the architect uses the spec-writing skill to update via API
					const specContext = `You are working on spec "${currentSpec.slug}" in project "${workspaceId}".
Use the spec-writing skill to read and update this spec directly via curl.

Current spec: "${currentSpec.title}" (rev ${currentSpec.rev})
`;
					fullPrompt = `${specContext}\nUser request: ${prompt}`;
				} else {
					// Resumed session - just send the user's message
					fullPrompt = prompt;
				}

				debugLog("[ArchitectChat]", "Calling startDetachedRun", {
					projectId: workspaceId,
					sessionPolicy,
					hasSessionId: !!currentSessionId,
				});

				const response = await startDetachedRun({
					projectId: workspaceId,
					prompt: fullPrompt,
					session: {
						policy: sessionPolicy,
						sessionId: currentSessionId || undefined,
						backendKind: "asp",
						model: "opus",
						aspTargetName: "architect",
					},
					maxTurns: 10, // Allow multiple turns for agent to use tools
				});

				debugLog("[ArchitectChat]", "startDetachedRun response", {
					runId: response.runId,
					sessionId: response.sessionId,
				});

				// If we created a new session, save the sessionId to spec metadata
				if (!currentSessionId && response.sessionId) {
					currentSessionId = response.sessionId;
					const updatedSpec: SpecDocument = {
						...currentSpec,
						metadata: {
							...currentSpec.metadata,
							sessionId: currentSessionId,
							updatedAt: Date.now(),
						},
					};
					onSpecUpdate(updatedSpec);

					try {
						const saveResponse = await updateWorkspaceSpec(
							workspaceId,
							updatedSpec.slug,
							updatedSpec,
							currentSpec.rev,
						);
						onSpecUpdate(saveResponse.spec);
					} catch (err) {
						console.error("[ArchitectChat] Failed to save sessionId:", err);
					}
				}
			} catch (err) {
				console.error("[ArchitectChat] Failed to send message:", err);
				setSendError(err as Error);
			} finally {
				setIsSending(false);
			}
		},
		[workspaceId, onSpecUpdate],
	);

	return {
		messages,
		entries: sortedEntries,
		runs,
		isConnected,
		isConnecting,
		isStreaming,
		currentStreamText,
		error: streamError || sendError,
		hasContinuationKey,
		sendMessage,
		isSending,
	};
}
