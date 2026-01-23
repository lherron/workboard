export type EventCategory = "run" | "tool" | "message" | "permission" | "notice" | "other";

export type DetailFormat = "plain" | "markdown" | "json";

export type EventDetail = {
	format: DetailFormat;
	text: string;
};

export type MediaAttachment =
	| {
			kind: "image";
			src: string;
			alt?: string;
			filename?: string;
			mimeType?: string;
	  }
	| {
			kind: "file";
			href: string;
			filename?: string;
			mimeType?: string;
	  };

export type RenderableEventStatus = "start" | "pending" | "success" | "error";

/**
 * Canonical, UI-oriented shape for a single session/run event.
 * This is the shared rendering input across Work Items, Session Stream, etc.
 */
export type RenderableEvent = {
	/** Unique id for this renderable instance (should be stable for a given SSE entry). */
	id: string;
	seq: number;
	runId?: string;

	/** Canonical event kind (usually `type`, but supports legacy `kind`). */
	kind: string;
	category: EventCategory;
	occurredAt: number;

	title: string;
	detail?: EventDetail;
	status?: RenderableEventStatus;
	attachments: MediaAttachment[];

	/** Optional, structured metadata for richer renderers. */
	meta?: {
		role?: string;
		phase?: "start" | "update" | "end";
		toolName?: string;
		toolUseId?: string;
		isError?: boolean;
		durationMs?: number;
		permissionDecision?: "allow" | "deny" | "always_allow";
		noticeLevel?: "info" | "warn" | "error";
		[key: string]: unknown;
	};

	/** Kept for debugging/fallback UIs; avoid rendering directly from this. */
	rawEvent?: unknown;
};

export type TranscriptUserPrompt = {
	kind: "user";
	id: string;
	seq: number;
	runId?: string;
	occurredAt: number;
	content: string;
};

export type TranscriptAssistantMessage = {
	kind: "assistant";
	id: string;
	seq: number;
	runId?: string;
	occurredAt: number;
	content: string;
	attachments: MediaAttachment[];
};

export type TranscriptToolCall = {
	kind: "tool";
	id: string;
	seq: number;
	runId?: string;
	occurredAt: number;
	toolUseId: string;
	toolName: string;
	input: Record<string, unknown>;
	isError: boolean;
	durationMs?: number;
	outputText?: string;
	attachments: MediaAttachment[];
};

export type TranscriptItem = TranscriptUserPrompt | TranscriptAssistantMessage | TranscriptToolCall;
