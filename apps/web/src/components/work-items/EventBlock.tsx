import type { RexSessionEvent, SessionStreamEntry } from "@/hooks/useCpSessionStream";
import { cn } from "@/lib/utils";
import { useState } from "react";

type EventBlockProps = {
	entry: SessionStreamEntry;
	roleColor: string;
	isNew?: boolean;
};

// Event category colors (left border accent)
const categoryColors: Record<string, string> = {
	run: "border-l-emerald-400",
	tool: "border-l-amber-400",
	message: "border-l-cyan-400",
	permission: "border-l-rose-400",
	notice: "border-l-zinc-400",
};

// Tool status icons
const toolStatusIcons: Record<string, { icon: string; color: string }> = {
	success: { icon: "✓", color: "text-emerald-400" },
	error: { icon: "✗", color: "text-red-400" },
	pending: { icon: "⏳", color: "text-amber-400" },
	start: { icon: "▶", color: "text-cyan-400" },
};

function formatTime(timestamp: number): string {
	if (!timestamp) return "--:--";
	return new Date(timestamp).toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function truncate(str: string, maxLen: number): string {
	if (str.length <= maxLen) return str;
	return `${str.slice(0, maxLen)}...`;
}

// Get event type - handle both `type` and `kind` fields
function getEventType(event: RexSessionEvent): string {
	// Some APIs use `kind`, others use `type`
	const eventType = event.type ?? (event as Record<string, unknown>).kind;
	return typeof eventType === "string" ? eventType : "unknown";
}

function getEventCategory(event: RexSessionEvent): string {
	const eventType = getEventType(event);
	if (eventType.startsWith("run_")) return "run";
	if (eventType.startsWith("tool_")) return "tool";
	if (eventType.startsWith("message_")) return "message";
	if (eventType.startsWith("permission_")) return "permission";
	if (eventType === "notice") return "notice";
	return "notice";
}

// Type-safe property access helpers
function getEventProp<T>(event: RexSessionEvent, key: string): T | undefined {
	return (event as Record<string, unknown>)[key] as T | undefined;
}

// Extract content blocks from various event message formats
function extractTextContent(content: unknown): string | undefined {
	if (!content) return undefined;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return (
			content
				.map((block) => {
					if (typeof block === "object" && block !== null) {
						const b = block as Record<string, unknown>;
						if (b.type === "text" && typeof b.text === "string") return b.text;
						if (b.type === "media_ref" && typeof b.filename === "string") return `[${b.filename}]`;
					}
					return "";
				})
				.filter(Boolean)
				.join(" ")
				.trim() || undefined
		);
	}
	return undefined;
}

export function EventBlock({ entry, roleColor: _roleColor, isNew = false }: EventBlockProps) {
	const [expanded, setExpanded] = useState(false);
	const { event, timestamp, seq } = entry;

	// Guard against undefined event
	if (!event) {
		return null;
	}

	const eventType = getEventType(event);

	// Skip unknown events silently
	if (eventType === "unknown") {
		console.warn("EventBlock received event without type/kind:", entry);
		return null;
	}

	const category = getEventCategory(event);
	const borderColor = categoryColors[category] ?? "border-l-zinc-500";

	// Render based on event type
	const renderContent = () => {
		switch (eventType) {
			// Run lifecycle events
			case "run_queued": {
				const input = getEventProp<{ content?: string }>(event, "input");
				const ts =
					getEventProp<number>(event, "ts") ?? getEventProp<number>(event, "queuedAt") ?? timestamp;
				return <RunLifecycleBlock label="RUN QUEUED" timestamp={ts} detail={input?.content} />;
			}

			case "run_started": {
				const ts =
					getEventProp<number>(event, "ts") ??
					getEventProp<number>(event, "startedAt") ??
					timestamp;
				return <RunLifecycleBlock label="RUN STARTED" timestamp={ts} />;
			}

			case "run_completed": {
				const finalOutput = getEventProp<string>(event, "finalOutput");
				const ts =
					getEventProp<number>(event, "ts") ??
					getEventProp<number>(event, "completedAt") ??
					timestamp;
				return (
					<RunLifecycleBlock label="RUN COMPLETED" timestamp={ts} detail={finalOutput} success />
				);
			}

			case "run_failed": {
				const error = getEventProp<{ message?: string }>(event, "error");
				const ts =
					getEventProp<number>(event, "ts") ?? getEventProp<number>(event, "failedAt") ?? timestamp;
				return (
					<RunLifecycleBlock label="RUN FAILED" timestamp={ts} detail={error?.message} error />
				);
			}

			case "run_cancelled": {
				const reason = getEventProp<string>(event, "reason");
				const ts =
					getEventProp<number>(event, "ts") ??
					getEventProp<number>(event, "cancelledAt") ??
					timestamp;
				return <RunLifecycleBlock label="RUN CANCELLED" timestamp={ts} detail={reason} />;
			}

			// Tool execution events
			case "tool_execution_start": {
				const toolName = getEventProp<string>(event, "toolName") ?? "Tool";
				const input = getEventProp<Record<string, unknown>>(event, "input");
				return (
					<ToolBlock
						toolName={toolName}
						status="start"
						input={input}
						expanded={expanded}
						onToggle={() => setExpanded(!expanded)}
					/>
				);
			}

			case "tool_execution_update": {
				const message = getEventProp<string>(event, "message");
				const partialOutput = getEventProp<string>(event, "partialOutput");
				return <ToolBlock toolName="Tool" status="pending" message={message ?? partialOutput} />;
			}

			case "tool_execution_end": {
				const toolName = getEventProp<string>(event, "toolName") ?? "Tool";
				const isError = getEventProp<boolean>(event, "isError");
				const result = getEventProp<{ content?: unknown; details?: Record<string, unknown> }>(
					event,
					"result",
				);
				const durationMs = getEventProp<number>(event, "durationMs");
				return (
					<ToolBlock
						toolName={toolName}
						status={isError ? "error" : "success"}
						result={result}
						durationMs={durationMs}
						expanded={expanded}
						onToggle={() => setExpanded(!expanded)}
					/>
				);
			}

			// Message events
			case "message_start": {
				const message = getEventProp<{ content?: unknown; role?: string }>(event, "message");
				const content = extractTextContent(message?.content);
				const role = message?.role ?? "assistant";
				return (
					<MessageBlock
						senderRole={role}
						phase="start"
						content={content}
						expanded={expanded}
						onToggle={() => setExpanded(!expanded)}
					/>
				);
			}

			case "message_update": {
				const textDelta = getEventProp<string>(event, "textDelta");
				const contentBlocks = getEventProp<unknown[]>(event, "contentBlocks");
				const content = textDelta ?? extractTextContent(contentBlocks);
				return <MessageBlock senderRole="assistant" phase="update" content={content} />;
			}

			case "message_end": {
				const message = getEventProp<{ content?: unknown; role?: string }>(event, "message");
				const content = extractTextContent(message?.content);
				const role = message?.role ?? "assistant";
				return (
					<MessageBlock
						senderRole={role}
						phase="end"
						content={content}
						expanded={expanded}
						onToggle={() => setExpanded(!expanded)}
					/>
				);
			}

			// Permission events
			case "permission_request": {
				const toolName = getEventProp<string>(event, "toolName");
				const toolInput = getEventProp<Record<string, unknown>>(event, "toolInput");
				return <PermissionBlock status="pending" toolName={toolName} input={toolInput} />;
			}

			case "permission_decision": {
				const decision = getEventProp<string>(event, "decision");
				const approved = decision === "allow" || decision === "always_allow";
				return <PermissionBlock status={approved ? "approved" : "denied"} />;
			}

			// Notice events
			case "notice": {
				const level = getEventProp<"info" | "warn" | "error">(event, "level") ?? "info";
				const message = getEventProp<string>(event, "message") ?? "";
				return <NoticeBlock level={level} message={message} />;
			}

			// Generic fallback
			default:
				return (
					<div className="text-[10px] text-muted-foreground/50">
						{event.type.replace(/_/g, " ")}
					</div>
				);
		}
	};

	return (
		<div
			className={cn(
				"relative border-l-2 pl-3 py-1.5",
				borderColor,
				isNew && "animate-event-slide-up",
			)}
		>
			{/* Sequence badge (very subtle) */}
			<div className="absolute right-0 top-1 text-[8px] font-mono text-muted-foreground/30">
				#{seq}
			</div>
			{renderContent()}
		</div>
	);
}

// Sub-components for different event types

function RunLifecycleBlock({
	label,
	timestamp,
	detail,
	success,
	error,
}: {
	label: string;
	timestamp: number;
	detail?: string;
	success?: boolean;
	error?: boolean;
}) {
	return (
		<div>
			<div className="flex items-center gap-2">
				<span
					className={cn(
						"text-[9px] font-bold uppercase tracking-wider",
						success && "text-emerald-400",
						error && "text-red-400",
						!success && !error && "text-muted-foreground/60",
					)}
				>
					─── {label} ───
				</span>
				<span className="text-[8px] font-mono text-muted-foreground/40">
					{formatTime(timestamp)}
				</span>
			</div>
			{detail && (
				<p className="mt-1 text-[10px] text-muted-foreground/60 leading-relaxed">
					{truncate(detail, 200)}
				</p>
			)}
		</div>
	);
}

function ToolBlock({
	toolName,
	status,
	input,
	result,
	message,
	durationMs,
	expanded,
	onToggle,
}: {
	toolName: string;
	status: "start" | "pending" | "success" | "error";
	input?: Record<string, unknown>;
	result?: { content?: unknown; details?: Record<string, unknown> };
	message?: string;
	durationMs?: number;
	expanded?: boolean;
	onToggle?: () => void;
}) {
	const statusIcon = toolStatusIcons[status];

	// Extract tool input summary
	let inputSummary = "";
	if (input) {
		if (typeof input.file_path === "string") inputSummary = input.file_path;
		else if (typeof input.command === "string") inputSummary = truncate(input.command, 50);
		else if (typeof input.pattern === "string") inputSummary = input.pattern;
		else if (typeof input.url === "string") inputSummary = input.url;
	}

	// Extract result summary
	let resultSummary = "";
	if (result?.content) {
		const text = extractTextContent(result.content);
		if (text) resultSummary = truncate(text, 100);
	}

	return (
		<div
			className={cn(
				"rounded-sm border border-amber-500/20 bg-amber-500/5 px-2 py-1.5",
				onToggle && "cursor-pointer hover:bg-amber-500/10",
			)}
			onClick={onToggle}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className={cn("text-[11px]", statusIcon.color)}>{statusIcon.icon}</span>
					<span className="text-[11px] font-bold text-amber-300">{toolName}</span>
				</div>
				{durationMs !== undefined && (
					<span className="text-[8px] font-mono text-muted-foreground/40">{durationMs}ms</span>
				)}
			</div>

			{inputSummary && (
				<p className="mt-1 text-[9px] font-mono text-muted-foreground/50 truncate">
					{inputSummary}
				</p>
			)}

			{message && <p className="mt-1 text-[9px] text-muted-foreground/60">{message}</p>}

			{expanded && resultSummary && (
				<div className="mt-2 pt-2 border-t border-amber-500/20">
					<p className="text-[9px] text-muted-foreground/60 leading-relaxed whitespace-pre-wrap">
						{resultSummary}
					</p>
				</div>
			)}

			{status === "success" && !expanded && resultSummary && (
				<p className="mt-1 text-[8px] text-muted-foreground/40">Click to expand result</p>
			)}
		</div>
	);
}

function MessageBlock({
	senderRole,
	phase,
	content,
	expanded,
	onToggle,
}: {
	senderRole: string;
	phase: "start" | "update" | "end";
	content?: string;
	expanded?: boolean;
	onToggle?: () => void;
}) {
	const isAssistant = senderRole === "assistant";
	const showContent = content && (phase === "start" || phase === "end" || expanded);

	return (
		<div
			className={cn(
				"rounded-sm border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5",
				onToggle && content && "cursor-pointer hover:bg-cyan-500/10",
			)}
			onClick={onToggle}
		>
			<div className="flex items-center gap-2">
				<span className="text-[9px] font-bold uppercase tracking-wider text-cyan-400/70">
					{senderRole} {phase === "update" ? "..." : phase === "end" ? "complete" : ""}
				</span>
			</div>

			{showContent && (
				<p
					className={cn(
						"mt-1 text-[10px] leading-relaxed",
						isAssistant ? "text-foreground/70" : "text-muted-foreground/60",
					)}
				>
					{expanded ? content : truncate(content, 150)}
				</p>
			)}

			{!expanded && content && content.length > 150 && (
				<p className="mt-1 text-[8px] text-muted-foreground/40">Click to expand</p>
			)}
		</div>
	);
}

function PermissionBlock({
	status,
	toolName,
	input: _input,
}: {
	status: "pending" | "approved" | "denied";
	toolName?: string;
	input?: Record<string, unknown>;
}) {
	return (
		<div
			className={cn(
				"rounded-sm border px-2 py-1.5",
				status === "pending" && "border-rose-500/40 bg-rose-500/10 animate-pulse",
				status === "approved" && "border-emerald-500/30 bg-emerald-500/10",
				status === "denied" && "border-red-500/30 bg-red-500/10",
			)}
		>
			<div className="flex items-center gap-2">
				<span
					className={cn(
						"text-[9px] font-bold uppercase tracking-wider",
						status === "pending" && "text-rose-400",
						status === "approved" && "text-emerald-400",
						status === "denied" && "text-red-400",
					)}
				>
					{status === "pending" && "⚠ PERMISSION REQUIRED"}
					{status === "approved" && "✓ APPROVED"}
					{status === "denied" && "✗ DENIED"}
				</span>
			</div>

			{toolName && <p className="mt-1 text-[9px] text-muted-foreground/60">Tool: {toolName}</p>}
		</div>
	);
}

function NoticeBlock({ level, message }: { level: "info" | "warn" | "error"; message: string }) {
	return (
		<div
			className={cn(
				"text-[10px] py-1",
				level === "info" && "text-muted-foreground/60",
				level === "warn" && "text-amber-400/80",
				level === "error" && "text-red-400/80",
			)}
		>
			{level === "warn" && "⚠ "}
			{level === "error" && "✗ "}
			{message}
		</div>
	);
}
