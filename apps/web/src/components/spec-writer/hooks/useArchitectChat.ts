import { startDetachedRun, updateWorkspaceSpec } from "@/api/client";
import { type SessionStreamEntry, useCpSessionStream } from "@/hooks/useCpSessionStream";
import type { RunLike } from "@/lib/chat";
import { debugLog } from "@/lib/utils";
import { buildStreamingAssistantText, buildTranscript } from "@/session-events";
import {
	type SpecDocument,
	type SpecMutation,
	type SpecMutationsBlock,
	specMutationsBlockSchema,
} from "@workboard/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyMutations } from "../lib/patch";

export type MutationStatus = {
	state: "pending" | "discarded" | "applying" | "saved" | "error";
	error?: string;
	isConflict?: boolean;
};

export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	/** Content intended for display (mutations JSON stripped) */
	content: string;
	timestamp: number;
	runId?: string;

	/** Parsed mutations (if any) */
	mutations?: SpecMutation[];

	/** Stable key for this mutation batch (runId + message id) */
	mutationKey?: string;

	/** Per-message mutation lifecycle */
	mutationStatus?: MutationStatus;
};

export type UseArchitectChatOptions = {
	workspaceId: string;
	spec: SpecDocument | null;
	onSpecUpdate: (spec: SpecDocument) => void;
	onSaveComplete: (spec: SpecDocument) => void;
	onConflict?: () => void;

	/**
	 * When true, mutations are applied & saved automatically as soon as they arrive.
	 * When false, mutations are surfaced as \"pending\" and require explicit user action.
	 */
	autoApplyMutations?: boolean;
};

export type MutationSaveError = {
	message: string;
	status?: number;
	isConflict: boolean;
	mutationKey?: string;
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

	/** Most recent mutation save error (also reflected per-message in mutationStatus) */
	mutationError: MutationSaveError | null;

	sendMessage: (prompt: string) => Promise<void>;
	isSending: boolean;

	/** Review/controls */
	applyMutationsForKey: (mutationKey: string) => Promise<void>;
	discardMutationsForKey: (mutationKey: string) => void;
	canUndo: boolean;
	undoLastApplied: () => Promise<void>;

	clearMutationError: () => void;

	/** Map of mutationKey -> mutations for the UI */
	getMutationsForRun: (runId: string) => {
		mutations: SpecMutation[];
		mutationKey: string;
		status: MutationStatus;
	} | null;
};

/**
 * Extract mutations from assistant message content.
 * Returns validated block + content with the mutation block removed (for display).
 */
function extractMutationsWithCleanup(
	content: string,
): { block: SpecMutationsBlock; cleanedContent: string } | null {
	// Match ```json blocks or generic ``` blocks, plus a bare JSON object at end.
	const patterns: RegExp[] = [
		/```json\s*\n?([\s\S]*?)\n?```/g,
		/```\s*\n?([\s\S]*?)\n?```/g,
		/(\{[\s\S]*?"mutations"[\s\S]*?\})\s*$/g,
	];

	let best: { block: SpecMutationsBlock; start: number; end: number; raw: string } | null = null;

	for (const pattern of patterns) {
		const matches = content.matchAll(pattern);
		for (const match of matches) {
			const jsonStr = match[1];
			const matchIndex = (match as unknown as { index?: number }).index ?? 0;
			const raw = match[0];

			try {
				const parsed = JSON.parse(jsonStr);
				const validated = specMutationsBlockSchema.safeParse(parsed);
				if (validated.success && validated.data.mutations.length > 0) {
					const start = matchIndex;
					const end = matchIndex + raw.length;

					if (!best || end > best.end) {
						best = { block: validated.data, start, end, raw };
					}
				}
			} catch {
				// Not valid JSON, continue
			}
		}
	}

	if (!best) return null;

	const cleanedContent = (content.slice(0, best.start) + content.slice(best.end)).trim();
	return { block: best.block, cleanedContent };
}

/**
 * Build chat messages from session stream entries.
 * This delegates all event parsing to the shared session-events pipeline.
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
		.map((item) => {
			if (item.kind === "user") {
				return {
					id: item.id,
					role: "user" as const,
					content: item.content,
					timestamp: item.occurredAt,
					runId: item.runId,
				};
			}

			const extracted = extractMutationsWithCleanup(item.content);
			return {
				id: item.id,
				role: "assistant" as const,
				content: extracted?.cleanedContent ?? item.content,
				timestamp: item.occurredAt,
				runId: item.runId,
				mutations: extracted?.block.mutations,
			};
		})
		.sort((a, b) => a.timestamp - b.timestamp);
}

function cloneSpec<T>(spec: T): T {
	// Spec documents are JSON-serializable; use JSON clone for maximum compatibility.
	return JSON.parse(JSON.stringify(spec)) as T;
}

function buildSpecOutline(spec: SpecDocument, maxItemsPerSection = 12): string {
	const sections = [...spec.sections].sort((a, b) => a.order - b.order);

	const lines: string[] = [];
	for (const section of sections) {
		const items = [...section.items].sort((a, b) => a.order - b.order).slice(0, maxItemsPerSection);

		if (items.length === 0) {
			lines.push(`- ${section.kind} (${section.label}): (empty)`);
			continue;
		}

		lines.push(
			`- ${section.kind} (${section.label}): ${items
				.map((i) => `${i.id} ${i.summary}`.trim())
				.join("; ")}`,
		);

		if (section.items.length > items.length) {
			lines.push(`  … ${section.items.length - items.length} more`);
		}
	}

	return lines.join("\n");
}

/**
 * Hook for managing architect chat session.
 * Handles session creation/resume, message streaming, and mutation parsing.
 */
export function useArchitectChat({
	workspaceId,
	spec,
	onSpecUpdate,
	onSaveComplete,
	onConflict,
	autoApplyMutations = false,
}: UseArchitectChatOptions): UseArchitectChatResult {
	const [isSending, setIsSending] = useState(false);
	const [currentStreamText, setCurrentStreamText] = useState("");
	const [sendError, setSendError] = useState<Error | null>(null);
	const [mutationError, setMutationError] = useState<MutationSaveError | null>(null);

	// Per-message status map (mutationKey -> status)
	const [mutationStatuses, setMutationStatuses] = useState<Record<string, MutationStatus>>({});

	// Undo stack for last applied mutation batches (LIFO)
	const [undoStack, setUndoStack] = useState<Array<{ mutationKey: string; before: SpecDocument }>>(
		[],
	);

	// Track current spec for mutation application
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
		maxEvents: 500,
		mode: "watch",
	});

	// Build base messages from entries (mutations parsed & cleaned)
	const baseMessages = useMemo(() => buildMessagesFromEntries(entries), [entries]);

	// Attach stable mutationKey + status to messages
	const messages = useMemo(() => {
		return baseMessages.map((msg) => {
			if (msg.role === "assistant" && msg.mutations && msg.runId) {
				const mutationKey = `${msg.runId}-${msg.id}`;
				const mutationStatus = mutationStatuses[mutationKey] || { state: "pending" };
				return { ...msg, mutationKey, mutationStatus };
			}
			return msg;
		});
	}, [baseMessages, mutationStatuses]);

	// Initialize statuses for newly seen mutation messages
	useEffect(() => {
		setMutationStatuses((prev) => {
			let changed = false;
			const next = { ...prev };

			for (const msg of baseMessages) {
				if (msg.role === "assistant" && msg.mutations && msg.runId) {
					const key = `${msg.runId}-${msg.id}`;
					if (!next[key]) {
						next[key] = { state: "pending" };
						changed = true;
					}
				}
			}

			return changed ? next : prev;
		});
	}, [baseMessages]);

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
		// Streaming if we've seen run_started but not run_completed/failed/cancelled
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

		// Build current stream text from latest run using the shared pipeline.
		const lastEntry = sortedEntries[sortedEntries.length - 1];
		if (!lastEntry?.runId) return;
		setCurrentStreamText(buildStreamingAssistantText(sortedEntries, lastEntry.runId));
	}, [sortedEntries, isStreaming]);

	const mutationByKey = useMemo(() => {
		const map = new Map<string, SpecMutation[]>();
		for (const msg of messages) {
			if (msg.mutationKey && msg.mutations) {
				map.set(msg.mutationKey, msg.mutations);
			}
		}
		return map;
	}, [messages]);

	const applyMutationsForKey = useCallback(
		async (mutationKey: string) => {
			const currentSpec = specRef.current;
			const mutations = mutationByKey.get(mutationKey);

			if (!currentSpec || !mutations || mutations.length === 0) return;

			// Don't re-apply if already in a terminal state
			const currentStatus = mutationStatuses[mutationKey];
			if (currentStatus?.state === "saved" || currentStatus?.state === "discarded") return;
			if (currentStatus?.state === "applying") return;

			setMutationStatuses((prev) => ({
				...prev,
				[mutationKey]: { state: "applying" },
			}));

			// Snapshot for undo
			setUndoStack((prev) => [...prev, { mutationKey, before: cloneSpec(currentSpec) }]);

			// Apply mutations locally
			debugLog("[ArchitectChat]", "Applying mutations:", mutations);
			const updatedSpec = applyMutations(currentSpec, mutations);
			onSpecUpdate(updatedSpec);

			try {
				const response = await updateWorkspaceSpec(
					workspaceId,
					updatedSpec.slug,
					updatedSpec,
					currentSpec.rev,
				);

				setMutationError(null);
				setMutationStatuses((prev) => ({
					...prev,
					[mutationKey]: { state: "saved" },
				}));
				onSaveComplete(response.spec);
			} catch (err) {
				console.error("[ArchitectChat] Failed to save after mutation:", err);
				const apiError = err as { message?: string; status?: number };
				const isConflict = apiError.status === 409;

				setMutationError({
					message: apiError.message || "Failed to save changes",
					status: apiError.status,
					isConflict,
					mutationKey,
				});

				setMutationStatuses((prev) => ({
					...prev,
					[mutationKey]: {
						state: "error",
						error: apiError.message || "Failed to save changes",
						isConflict,
					},
				}));

				// Notify parent of conflict so they can offer reload
				if (isConflict && onConflict) {
					onConflict();
				}
			}
		},
		[mutationByKey, mutationStatuses, onSpecUpdate, onSaveComplete, onConflict, workspaceId],
	);

	const discardMutationsForKey = useCallback((mutationKey: string) => {
		setMutationStatuses((prev) => ({
			...prev,
			[mutationKey]: { state: "discarded" },
		}));
	}, []);

	// Auto-apply pending mutations if enabled
	useEffect(() => {
		if (!autoApplyMutations) return;

		for (const msg of messages) {
			if (msg.mutationKey && msg.mutations && msg.mutationStatus?.state === "pending") {
				// Fire and forget; applyMutationsForKey handles dedupe via status checks.
				void applyMutationsForKey(msg.mutationKey);
			}
		}
	}, [autoApplyMutations, messages, applyMutationsForKey]);

	const canUndo = undoStack.length > 0;

	const undoLastApplied = useCallback(async () => {
		const currentSpec = specRef.current;
		if (!currentSpec) return;

		const last = undoStack[undoStack.length - 1];
		if (!last) return;

		// Pop optimistically
		setUndoStack((prev) => prev.slice(0, -1));

		const reverted: SpecDocument = {
			...last.before,
			// Keep latest revision/session metadata for concurrency; server will issue new rev.
			rev: currentSpec.rev,
			metadata: {
				...last.before.metadata,
				sessionId: currentSpec.metadata.sessionId,
				updatedAt: Date.now(),
			},
		};

		onSpecUpdate(reverted);

		try {
			const response = await updateWorkspaceSpec(
				workspaceId,
				reverted.slug,
				reverted,
				currentSpec.rev,
			);

			setMutationError(null);
			setMutationStatuses((prev) => ({
				...prev,
				[last.mutationKey]: { state: "pending" },
			}));
			onSaveComplete(response.spec);
		} catch (err) {
			console.error("[ArchitectChat] Failed to save undo:", err);
			const apiError = err as { message?: string; status?: number };
			const isConflict = apiError.status === 409;

			setMutationError({
				message: apiError.message || "Failed to undo changes",
				status: apiError.status,
				isConflict,
				mutationKey: last.mutationKey,
			});

			setMutationStatuses((prev) => ({
				...prev,
				[last.mutationKey]: {
					state: "error",
					error: apiError.message || "Failed to undo changes",
					isConflict,
				},
			}));

			if (isConflict && onConflict) {
				onConflict();
			}
		}
	}, [undoStack, onSpecUpdate, onSaveComplete, onConflict, workspaceId]);

	// Send a message to the architect
	const sendMessage = useCallback(
		async (prompt: string) => {
			const currentSpec = specRef.current;
			if (!currentSpec || !workspaceId) return;

			setIsSending(true);
			setSendError(null);

			try {
				const outline = buildSpecOutline(currentSpec);

				// Create system context for the architect
				const systemContext = `You are an architect helping to create a technical design specification.

Current spec state:
- Title: ${currentSpec.title}
- Overview (may be empty): ${currentSpec.overview ? "present" : "empty"}
- Total items: ${currentSpec.sections.reduce((acc, s) => acc + s.items.length, 0)}
- Outline:
${outline}

To modify the spec, include a JSON block at the end of your response with mutations:
\`\`\`json
{
  "mutations": [
    { "type": "add_item", "section": "features", "summary": "Feature summary", "body": "Feature details" },
    { "type": "update_item", "itemId": "F-001", "summary": "Updated summary", "status": "approved" },
    { "type": "delete_item", "itemId": "F-002" },
    { "type": "update_overview", "overview": "New overview text" },
    { "type": "set_title", "title": "New spec title" }
  ]
}
\`\`\`

Available section kinds: goals, non-goals, features, constraints, open-questions, data-models, integrations, dependencies, risks, testing
Item statuses: draft, approved, deferred

Important:
- Use existing item IDs when updating/deleting.
- If proposing multiple mutations, keep them minimal and well-scoped.`;

				const fullPrompt = `${systemContext}\n\nUser request: ${prompt}`;

				let currentSessionId = currentSpec.metadata.sessionId;

				// Create or resume session
				const sessionPolicy = currentSessionId ? "resume" : "new";

				const response = await startDetachedRun({
					projectId: workspaceId,
					prompt: fullPrompt,
					session: {
						policy: sessionPolicy,
						sessionId: currentSessionId || undefined,
						backendKind: "asp",
						model: "opus",
					},
					maxTurns: 1,
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
						onSaveComplete(saveResponse.spec);
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
		[workspaceId, onSpecUpdate, onSaveComplete],
	);

	// Clear mutation error (e.g., after user acknowledges it)
	const clearMutationError = useCallback(() => {
		setMutationError(null);
	}, []);

	// Get mutations for a specific run (for UI to display mutation actions below RunCard)
	const getMutationsForRun = useCallback(
		(runId: string) => {
			const msg = messages.find(
				(m) => m.runId === runId && m.role === "assistant" && m.mutations && m.mutations.length > 0,
			);
			if (!msg || !msg.mutationKey || !msg.mutations) return null;

			return {
				mutations: msg.mutations,
				mutationKey: msg.mutationKey,
				status: msg.mutationStatus || { state: "pending" as const },
			};
		},
		[messages],
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
		mutationError,
		sendMessage,
		isSending,
		applyMutationsForKey,
		discardMutationsForKey,
		canUndo,
		undoLastApplied,
		clearMutationError,
		getMutationsForRun,
	};
}
