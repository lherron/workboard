import { MarkdownContent } from "@/components/MarkdownContent";
import { cn } from "@/lib/utils";
import type { RenderableEvent } from "@/session-events";
import { useState } from "react";
import { MediaAttachments } from "./MediaAttachments";

type Variant = "work-item" | "stream-panel";

export function SessionEventRow({
	event,
	variant,
	isNew,
}: {
	event: RenderableEvent;
	variant: Variant;
	isNew?: boolean;
}) {
	if (variant === "stream-panel") {
		return <StreamPanelEventRow event={event} />;
	}
	return <WorkItemEventRow event={event} isNew={isNew} />;
}

// -------- Work-item (chat-style) --------

const CATEGORY_COLORS: Record<string, string> = {
	run: "border-l-emerald-400",
	tool: "border-l-amber-400",
	message: "border-l-cyan-400",
	permission: "border-l-rose-400",
	notice: "border-l-zinc-400",
	other: "border-l-zinc-500",
};

const TOOL_STATUS_ICONS: Record<
	string,
	{
		icon: string;
		color: string;
	}
> = {
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

function WorkItemEventRow({ event, isNew }: { event: RenderableEvent; isNew?: boolean }) {
	const [expanded, setExpanded] = useState(false);
	const borderColor = CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.other;

	const kind = event.kind;
	const toolName = event.meta?.toolName ?? event.title;
	const phase = event.meta?.phase;
	const role = event.meta?.role ?? "assistant";

	const showToggle =
		(kind === "tool_execution_end" && Boolean(event.detail?.text)) ||
		(kind === "message_start" && Boolean(event.detail?.text)) ||
		(kind === "message_end" && Boolean(event.detail?.text));

	const onToggle = showToggle ? () => setExpanded((prev) => !prev) : undefined;

	return (
		<div
			className={cn(
				"relative border-l-2 pl-3 py-1.5",
				borderColor,
				isNew && "animate-event-slide-up",
			)}
		>
			<div className="absolute right-0 top-1 text-[8px] font-mono text-muted-foreground/30">
				#{event.seq}
			</div>

			{event.category === "run" && (
				<RunLifecycleBlock
					label={kind.replace(/_/g, " ").toUpperCase()}
					timestamp={event.occurredAt}
					detail={event.detail?.text}
					success={kind === "run_completed"}
					error={kind === "run_failed"}
				/>
			)}

			{event.category === "tool" && (
				<ToolBlock
					toolName={toolName}
					status={event.status ?? "pending"}
					inputSummary={
						typeof event.meta?.inputSummary === "string" ? event.meta.inputSummary : undefined
					}
					detail={event.detail?.text}
					attachments={event.attachments}
					durationMs={event.meta?.durationMs as number | undefined}
					expanded={expanded}
					onToggle={onToggle}
				/>
			)}

			{event.category === "message" && (
				<MessageBlock
					senderRole={role}
					phase={
						phase ??
						(kind === "message_start" ? "start" : kind === "message_end" ? "end" : "update")
					}
					content={event.detail?.text}
					attachments={event.attachments}
					expanded={expanded}
					onToggle={onToggle}
				/>
			)}

			{event.category === "permission" && (
				<PermissionBlock
					status={
						event.status === "pending"
							? "pending"
							: event.status === "error"
								? "denied"
								: "approved"
					}
					toolName={event.meta?.toolName as string | undefined}
				/>
			)}

			{event.category === "notice" && (
				<NoticeBlock
					level={(event.meta?.noticeLevel as "info" | "warn" | "error" | undefined) ?? "info"}
					message={event.detail?.text ?? event.title}
				/>
			)}

			{event.category === "other" && (
				<div className="text-[10px] text-muted-foreground/50">{event.title}</div>
			)}
		</div>
	);
}

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
	inputSummary,
	detail,
	attachments,
	durationMs,
	expanded,
	onToggle,
}: {
	toolName: string;
	status: "start" | "pending" | "success" | "error";
	inputSummary?: string;
	detail?: string;
	attachments: RenderableEvent["attachments"];
	durationMs?: number;
	expanded?: boolean;
	onToggle?: () => void;
}) {
	const statusIcon = TOOL_STATUS_ICONS[status] ?? TOOL_STATUS_ICONS.pending;
	const hasBody = Boolean(detail) || (attachments && attachments.length > 0);
	const showBody = expanded || status !== "success";

	return (
		<div
			className={cn(
				"rounded-sm border border-amber-500/20 bg-amber-500/5 px-2 py-1.5",
				onToggle && hasBody && "cursor-pointer hover:bg-amber-500/10",
			)}
			onClick={onToggle}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 min-w-0">
					<span className={cn("text-[11px]", statusIcon.color)}>{statusIcon.icon}</span>
					<span className="text-[11px] font-bold text-amber-300 shrink-0">{toolName}</span>
					{inputSummary && (
						<span className="text-[9px] font-mono text-muted-foreground/50 truncate min-w-0">
							{inputSummary}
						</span>
					)}
				</div>
				{durationMs !== undefined && (
					<span className="text-[8px] font-mono text-muted-foreground/40">{durationMs}ms</span>
				)}
			</div>

			{showBody && (
				<>
					{detail && (
						<div className="mt-2">
							<p className="text-[9px] text-muted-foreground/60 leading-relaxed whitespace-pre-wrap">
								{expanded ? detail : truncate(detail, 160)}
							</p>
						</div>
					)}
					<MediaAttachments attachments={attachments} className="mt-2" />
				</>
			)}

			{status === "success" && !expanded && hasBody && (
				<p className="mt-1 text-[8px] text-muted-foreground/40">Click to expand</p>
			)}
		</div>
	);
}

function MessageBlock({
	senderRole,
	phase,
	content,
	attachments,
	expanded,
	onToggle,
}: {
	senderRole: string;
	phase: "start" | "update" | "end";
	content?: string;
	attachments: RenderableEvent["attachments"];
	expanded?: boolean;
	onToggle?: () => void;
}) {
	const isAssistant = senderRole === "assistant";
	const showContent = content && (phase === "start" || phase === "end" || expanded);
	const hasAttachments = attachments && attachments.length > 0;
	const canToggle = Boolean(onToggle) && (Boolean(content) || hasAttachments);

	return (
		<div
			className={cn(
				"rounded-sm border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5",
				canToggle && "cursor-pointer hover:bg-cyan-500/10",
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

			<MediaAttachments attachments={attachments} className="mt-2" />

			{!expanded && content && content.length > 150 && (
				<p className="mt-1 text-[8px] text-muted-foreground/40">Click to expand</p>
			)}
		</div>
	);
}

function PermissionBlock({
	status,
	toolName,
}: {
	status: "pending" | "approved" | "denied";
	toolName?: string;
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

// -------- Session stream panel (timeline) --------

type EventTone = { dot: string; badge: string };

const TONES: Record<string, EventTone> = {
	run: { dot: "bg-emerald-400", badge: "border-emerald-400/30 text-emerald-300" },
	message: { dot: "bg-sky-400", badge: "border-sky-400/30 text-sky-300" },
	tool: { dot: "bg-amber-400", badge: "border-amber-400/30 text-amber-300" },
	permission: { dot: "bg-rose-400", badge: "border-rose-400/30 text-rose-300" },
	notice: { dot: "bg-slate-400", badge: "border-slate-400/30 text-slate-300" },
	other: {
		dot: "bg-muted-foreground/60",
		badge: "border-muted-foreground/30 text-muted-foreground/80",
	},
};

function StreamPanelEventRow({ event }: { event: RenderableEvent }) {
	const tone = TONES[event.category] ?? TONES.other;
	const time = formatTime(event.occurredAt);
	const runToken = event.runId ? event.runId.slice(-6) : null;
	const detail = event.detail?.text;
	const renderMarkdown = event.detail?.format === "markdown";

	return (
		<div className="relative">
			<span className={cn("absolute -left-[19px] top-2 h-2 w-2 rounded-full", tone.dot)} />
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<span
							className={cn(
								"rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-widest",
								tone.badge,
							)}
						>
							{event.category}
						</span>
						<span className="text-[11px] text-foreground/90">{event.title}</span>
						{runToken && (
							<span className="text-[9px] font-mono text-muted-foreground/60">run {runToken}</span>
						)}
					</div>
					{detail &&
						(renderMarkdown ? (
							<div className="mt-1 text-[11px] text-foreground/80 leading-relaxed">
								<MarkdownContent content={detail} />
							</div>
						) : (
							<p className="mt-1 text-[10px] text-muted-foreground/70">{truncate(detail, 200)}</p>
						))}
					<MediaAttachments attachments={event.attachments} className="mt-2" />
				</div>
				<div className="shrink-0 text-right text-[9px] font-mono text-muted-foreground/50">
					<div>{time}</div>
					<div>seq {event.seq}</div>
				</div>
			</div>
		</div>
	);
}
