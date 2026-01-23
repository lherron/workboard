import { startDetachedRun, updateWorkspaceSpec } from "@/api/client";
import { type SessionStreamEntry, useCpSessionStream } from "@/hooks/useCpSessionStream";
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

export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: number;
	runId?: string;
	mutations?: SpecMutation[];
	mutationsApplied?: boolean;
};

export type UseArchitectChatOptions = {
	workspaceId: string;
	spec: SpecDocument | null;
	onSpecUpdate: (spec: SpecDocument) => void;
	onSaveComplete: (spec: SpecDocument) => void;
	onConflict?: () => void;
};

export type MutationSaveError = {
	message: string;
	status?: number;
	isConflict: boolean;
};

export type UseArchitectChatResult = {
	messages: ChatMessage[];
	isConnected: boolean;
	isConnecting: boolean;
	isStreaming: boolean;
	currentStreamText: string;
	error: Error | null;
	mutationError: MutationSaveError | null;
	sendMessage: (prompt: string) => Promise<void>;
	isSending: boolean;
	clearMutationError: () => void;
};

/**
 * Extract mutations from assistant message content.
 * Looks for a JSON block containing a "mutations" array.
 */
function extractMutations(content: string): SpecMutationsBlock | null {
	// Look for JSON blocks with mutations
	// Match ```json blocks or bare JSON objects with mutations key
	const patterns = [
		/```json\s*\n?([\s\S]*?)\n?```/g,
		/```\s*\n?([\s\S]*?)\n?```/g,
		/(\{[\s\S]*?"mutations"[\s\S]*?\})\s*$/,
	];

	for (const pattern of patterns) {
		const matches = content.matchAll(pattern);
		for (const match of matches) {
			const jsonStr = match[1];
			try {
				const parsed = JSON.parse(jsonStr);
				const validated = specMutationsBlockSchema.safeParse(parsed);
				if (validated.success && validated.data.mutations.length > 0) {
					return validated.data;
				}
			} catch {
				// Not valid JSON, continue
			}
		}
	}

	return null;
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

			const mutations = extractMutations(item.content);
			return {
				id: item.id,
				role: "assistant" as const,
				content: item.content,
				timestamp: item.occurredAt,
				runId: item.runId,
				mutations: mutations?.mutations,
			};
		})
		.sort((a, b) => a.timestamp - b.timestamp);
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
}: UseArchitectChatOptions): UseArchitectChatResult {
	const [isSending, setIsSending] = useState(false);
	const [currentStreamText, setCurrentStreamText] = useState("");
	const [sendError, setSendError] = useState<Error | null>(null);
	const [mutationError, setMutationError] = useState<MutationSaveError | null>(null);

	// Track which mutations have been applied
	const appliedMutationsRef = useRef<Set<string>>(new Set());
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

	// Build messages from entries
	const messages = useMemo(() => {
		const msgs = buildMessagesFromEntries(entries);
		// Mark messages with applied mutations
		return msgs.map((msg) => {
			if (msg.mutations && msg.runId) {
				const mutationKey = `${msg.runId}-${msg.id}`;
				msg.mutationsApplied = appliedMutationsRef.current.has(mutationKey);
			}
			return msg;
		});
	}, [entries]);

	// Check if currently streaming (has active run)
	const isStreaming = useMemo(() => {
		const lastEntry = entries[entries.length - 1];
		if (!lastEntry) return false;
		const _event = lastEntry.event;
		// Streaming if we've seen run_started but not run_completed/failed/cancelled
		const runEvents = entries.filter((e) => e.runId === lastEntry.runId);
		const hasStarted = runEvents.some((e) => e.event.type === "run_started");
		const hasEnded = runEvents.some((e) =>
			["run_completed", "run_failed", "run_cancelled"].includes(e.event.type),
		);
		return hasStarted && !hasEnded;
	}, [entries]);

	// Track streaming text for live display
	useEffect(() => {
		if (!isStreaming) {
			setCurrentStreamText("");
			return;
		}

		// Build current stream text from latest run using the shared pipeline.
		const lastEntry = entries[entries.length - 1];
		if (!lastEntry?.runId) return;
		setCurrentStreamText(buildStreamingAssistantText(entries, lastEntry.runId));
	}, [entries, isStreaming]);

	// Apply mutations when new assistant messages arrive
	useEffect(() => {
		const currentSpec = specRef.current;
		if (!currentSpec) return;

		for (const msg of messages) {
			if (msg.role === "assistant" && msg.mutations && msg.runId) {
				const mutationKey = `${msg.runId}-${msg.id}`;
				if (!appliedMutationsRef.current.has(mutationKey)) {
					// Mark as applied immediately to prevent re-processing
					appliedMutationsRef.current.add(mutationKey);
					const mutations = msg.mutations;

					// Apply mutations to current spec and update UI immediately
					debugLog("[ArchitectChat]", "Applying mutations:", mutations);
					const updatedSpec = applyMutations(currentSpec, mutations);
					onSpecUpdate(updatedSpec);

					// Trigger autosave with a microtask to get the latest state
					// This fixes the race condition where user edits may have changed the rev
					queueMicrotask(() => {
						// Get the latest spec state right before saving
						const latestSpec = specRef.current;
						if (!latestSpec) return;

						// Re-apply mutations to the latest spec to include any concurrent user edits
						const specToSave = applyMutations(latestSpec, mutations);
						const revToUse = latestSpec.rev;

						updateWorkspaceSpec(workspaceId, specToSave.slug, specToSave, revToUse)
							.then((response) => {
								setMutationError(null);
								onSaveComplete(response.spec);
							})
							.catch((err) => {
								console.error("[ArchitectChat] Failed to save after mutation:", err);
								const apiError = err as { message?: string; status?: number };
								const isConflict = apiError.status === 409;
								setMutationError({
									message: apiError.message || "Failed to save changes",
									status: apiError.status,
									isConflict,
								});
								// Notify parent of conflict so they can offer reload
								if (isConflict && onConflict) {
									onConflict();
								}
							});
					});
				}
			}
		}
	}, [messages, workspaceId, onSpecUpdate, onSaveComplete, onConflict]);

	// Send a message to the architect
	const sendMessage = useCallback(
		async (prompt: string) => {
			const currentSpec = specRef.current;
			if (!currentSpec || !workspaceId) return;

			setIsSending(true);
			setSendError(null);

			try {
				// Create system context for the architect
				const systemContext = `You are an architect helping to create a technical design specification.

Current spec state:
- Title: ${currentSpec.title}
- Sections: ${currentSpec.sections.map((s) => s.label).join(", ")}
- Total items: ${currentSpec.sections.reduce((acc, s) => acc + s.items.length, 0)}

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

Item statuses: draft, approved, deferred`;

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

					// Save the updated spec with the new sessionId
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

	return {
		messages,
		isConnected,
		isConnecting,
		isStreaming,
		currentStreamText,
		error: streamError || sendError,
		mutationError,
		sendMessage,
		isSending,
		clearMutationError,
	};
}
