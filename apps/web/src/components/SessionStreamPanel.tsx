import { MarkdownContent } from "@/components/MarkdownContent";
import {
	type ContentBlock,
	type RexSessionEvent,
	type SessionStreamEntry,
	useCpSessionStream,
} from "@/hooks/useCpSessionStream";
import { cn } from "@/lib/utils";
import { Loader2, Maximize2, Minimize2, Radio, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type SessionStreamPanelProps = {
	sessionId?: string | null;
	runId?: string | null;
	className?: string;
	isOpen?: boolean;
	onToggle?: (next: boolean) => void;
	showToggle?: boolean;
	fill?: boolean;
};

type EventTone = {
	dot: string;
	badge: string;
};

const TONES: Record<string, EventTone> = {
	run: { dot: "bg-emerald-400", badge: "border-emerald-400/30 text-emerald-300" },
	message: { dot: "bg-sky-400", badge: "border-sky-400/30 text-sky-300" },
	tool: { dot: "bg-amber-400", badge: "border-amber-400/30 text-amber-300" },
	permission: { dot: "bg-rose-400", badge: "border-rose-400/30 text-rose-300" },
	notice: { dot: "bg-slate-400", badge: "border-slate-400/30 text-slate-300" },
	default: {
		dot: "bg-muted-foreground/60",
		badge: "border-muted-foreground/30 text-muted-foreground/80",
	},
};

export function SessionStreamPanel({
	sessionId,
	runId,
	className,
	isOpen,
	onToggle,
	showToggle = true,
	fill = false,
}: SessionStreamPanelProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const open = isOpen ?? internalOpen;
	const setOpen = onToggle ?? setInternalOpen;
	const isControlled = isOpen !== undefined;
	const [filterRunOnly, setFilterRunOnly] = useState(Boolean(runId));
	const [expanded, setExpanded] = useState(false);
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const bottomRef = useRef<HTMLDivElement | null>(null);

	const { entries, isConnected, isConnecting, error, clear } = useCpSessionStream({
		sessionId: sessionId ?? null,
		enabled: open && Boolean(sessionId),
		maxEvents: 300,
		mode: filterRunOnly && runId ? "attach" : "watch",
		runId: filterRunOnly ? runId : null,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: sessionId triggers filter reset
	useEffect(() => {
		setFilterRunOnly(Boolean(runId));
	}, [runId, sessionId]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: sessionId triggers panel reset
	useEffect(() => {
		clear();
		if (!isControlled) {
			setInternalOpen(false);
		}
	}, [sessionId, clear, isControlled]);

	useEffect(() => {
		if (!open) {
			clear();
			setExpanded(false);
		}
	}, [open, clear]);

	const filteredEntries = useMemo(() => {
		if (!filterRunOnly || !runId) return entries;
		return entries.filter((entry) => entry.runId === runId);
	}, [entries, filterRunOnly, runId]);

	const historyEntries = filteredEntries.filter((entry) => entry.source === "history");
	const liveEntries = filteredEntries.filter((entry) => entry.source === "live");

	// biome-ignore lint/correctness/useExhaustiveDependencies: filteredEntries triggers scroll on new entries
	useEffect(() => {
		if (!open) return;
		// Double-RAF ensures DOM has rendered before scrolling
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
			});
		});
	}, [open, filteredEntries]);

	const statusLabel = isConnected ? "Live" : isConnecting ? "Connecting" : "Disconnected";
	const showPopout = open;
	const panelFill = fill || expanded;

	if (!open && !showToggle) {
		return null;
	}

	const panel = (extraClass?: string) => (
		<div
			className={cn(
				"rounded-lg border border-border/40 bg-gradient-to-b from-muted/20 via-transparent to-muted/10",
				"px-3 py-2 text-[11px] text-foreground/80",
				panelFill && "h-full flex flex-col",
				extraClass,
			)}
		>
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
						Session Stream
					</span>
					{open && sessionId && (
						<span
							className={cn(
								"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px]",
								isConnected && "border-emerald-400/40 text-emerald-300",
								isConnecting && "border-muted-foreground/40 text-muted-foreground/70",
								!isConnected && !isConnecting && "border-rose-400/40 text-rose-300",
							)}
						>
							{isConnected ? (
								<Radio className="h-3 w-3" />
							) : isConnecting ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<WifiOff className="h-3 w-3" />
							)}
							{statusLabel}
						</span>
					)}
				</div>

				<div className="flex items-center gap-2">
					{showPopout && (
						<button
							type="button"
							onClick={() => setExpanded((prev) => !prev)}
							className={cn(
								"rounded-full border p-1.5 transition",
								"border-border/40 text-muted-foreground/70 hover:border-primary/40 hover:text-foreground",
								expanded && "border-primary/50 text-primary",
							)}
							aria-label={expanded ? "Exit full view" : "Full view"}
						>
							{expanded ? (
								<Minimize2 className="h-3.5 w-3.5" />
							) : (
								<Maximize2 className="h-3.5 w-3.5" />
							)}
						</button>
					)}

					{showToggle &&
						(sessionId ? (
							<button
								type="button"
								onClick={() => setOpen(!open)}
								className={cn(
									"rounded-full border px-3 py-1 text-[10px] uppercase tracking-widest transition",
									"border-border/50 text-muted-foreground/80 hover:border-primary/40 hover:text-foreground",
									open && "border-primary/50 text-primary",
								)}
							>
								{open ? "Hide" : "Live Session"}
							</button>
						) : (
							<span className="text-[10px] text-muted-foreground/50">No session stream</span>
						))}
				</div>
			</div>

			{!open && sessionId && showToggle && (
				<p className="mt-2 text-[10px] text-muted-foreground/60">
					Open to stream events. No connection until you opt in.
				</p>
			)}

			{open && sessionId && (
				<div className={cn("mt-3 space-y-3", panelFill && "flex-1 min-h-0 flex flex-col")}>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
							<span className="font-mono">{sessionId}</span>
							{error && <span className="text-rose-300">{error.message}</span>}
						</div>
						{runId && (
							<button
								type="button"
								onClick={() => setFilterRunOnly((prev) => !prev)}
								className={cn(
									"rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-widest transition",
									filterRunOnly
										? "border-amber-400/50 text-amber-300"
										: "border-border/40 text-muted-foreground/70 hover:text-foreground",
								)}
							>
								{filterRunOnly ? "This run only" : "All runs"}
							</button>
						)}
					</div>

					<div
						ref={scrollRef}
						className={cn("space-y-3 overflow-y-auto pr-2", panelFill && "flex-1 min-h-0")}
					>
						<TimelineSection label="History" entries={historyEntries} emptyLabel="No replay yet." />
						<TimelineSection
							label="Live"
							entries={liveEntries}
							emptyLabel="Waiting for live events..."
						/>
						<div ref={bottomRef} />
					</div>
				</div>
			)}
		</div>
	);

	return (
		<>
			{panel(
				className
					? cn(className, expanded && "opacity-0 pointer-events-none")
					: expanded
						? "opacity-0 pointer-events-none"
						: undefined,
			)}
			{expanded && (
				<div
					className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
					onClick={() => setExpanded(false)}
				>
					<div
						className="h-full w-full max-h-[92vh] max-w-[92vw]"
						onClick={(event) => event.stopPropagation()}
					>
						{panel("h-full w-full border-border/60 bg-background/95 shadow-2xl")}
					</div>
				</div>
			)}
		</>
	);
}

function TimelineSection({
	label,
	entries,
	emptyLabel,
}: {
	label: string;
	entries: SessionStreamEntry[];
	emptyLabel: string;
}) {
	return (
		<div>
			<div className="mb-2 flex items-center gap-2">
				<span className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground/60">
					{label}
				</span>
				<span className="text-[9px] text-muted-foreground/40">{entries.length}</span>
			</div>
			{entries.length === 0 ? (
				<div className="rounded-md border border-dashed border-border/30 px-3 py-2 text-[10px] text-muted-foreground/50">
					{emptyLabel}
				</div>
			) : (
				<div className="space-y-3 border-l border-border/40 pl-4">
					{entries.map((entry) => (
						<TimelineEntry key={entry.id} entry={entry} />
					))}
				</div>
			)}
		</div>
	);
}

function TimelineEntry({ entry }: { entry: SessionStreamEntry }) {
	const { category, title, detail, renderMarkdown } = describeEvent(entry.event);
	const tone = getEventTone(entry.event);
	const time = formatTime(entry.timestamp);
	const runToken = entry.runId ? entry.runId.slice(-6) : null;

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
							{category}
						</span>
						<span className="text-[11px] text-foreground/90">{title}</span>
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
				</div>
				<div className="shrink-0 text-right text-[9px] font-mono text-muted-foreground/50">
					<div>{time}</div>
					<div>seq {entry.seq}</div>
				</div>
			</div>
		</div>
	);
}

function getEventTone(event: RexSessionEvent): EventTone {
	if (event.type.startsWith("run_")) return TONES.run;
	if (event.type.startsWith("message_")) return TONES.message;
	if (event.type.startsWith("tool_execution_")) return TONES.tool;
	if (event.type.startsWith("permission_")) return TONES.permission;
	if (event.type === "notice") return TONES.notice;
	return TONES.default;
}

// Type alias for accessing event properties with type assertions
type EventWithInput = { input?: { content?: string } };
type EventWithOutput = { finalOutput?: string };
type EventWithError = { error?: { message?: string } };
type EventWithReason = { reason?: string };
type EventWithMessage = { message?: { role?: string; content?: unknown } };
type EventWithTextDelta = { textDelta?: string; contentBlocks?: ContentBlock[] };
type EventWithToolInfo = {
	toolName?: string;
	input?: Record<string, unknown>;
	message?: string;
	partialOutput?: string;
};
type EventWithToolResult = {
	toolName?: string;
	result?: { content?: ContentBlock[]; details?: Record<string, unknown> };
};
type EventWithDecision = { decision?: string };
type EventWithNotice = { message?: string };

function describeEvent(event: RexSessionEvent): {
	category: string;
	title: string;
	detail?: string;
	renderMarkdown?: boolean;
} {
	// Type assertions needed because RexSessionEventUnknown overlaps with all known types
	switch (event.type) {
		case "run_queued":
			return {
				category: "Run",
				title: "Run queued",
				detail: (event as EventWithInput).input?.content,
			};
		case "run_started":
			return { category: "Run", title: "Run started" };
		case "run_completed":
			return {
				category: "Run",
				title: "Run completed",
				detail: (event as EventWithOutput).finalOutput,
			};
		case "run_failed":
			return {
				category: "Run",
				title: "Run failed",
				detail: (event as EventWithError).error?.message ?? "Execution failed",
			};
		case "run_cancelled":
			return { category: "Run", title: "Run cancelled", detail: (event as EventWithReason).reason };
		case "message_start": {
			const msg = (event as EventWithMessage).message;
			const content = extractMessageContent(msg);
			const role = msg?.role ?? "message";
			return {
				category: "Message",
				title: `${role} message start`,
				detail: content,
				renderMarkdown: true,
			};
		}
		case "message_update": {
			const evt = event as EventWithTextDelta;
			const content = evt.textDelta ?? extractContentBlocks(evt.contentBlocks);
			return {
				category: "Message",
				title: "Message update",
				detail: content,
				renderMarkdown: true,
			};
		}
		case "message_end": {
			const msg = (event as EventWithMessage).message;
			const content = extractMessageContent(msg);
			const role = msg?.role ?? "message";
			return {
				category: "Message",
				title: `${role} message end`,
				detail: content,
				renderMarkdown: true,
			};
		}
		case "tool_execution_start": {
			const evt = event as EventWithToolInfo;
			return {
				category: "Tool",
				title: `Tool start: ${evt.toolName ?? "unknown"}`,
				detail: stringifyCompact(evt.input),
			};
		}
		case "tool_execution_update": {
			const evt = event as EventWithToolInfo;
			return {
				category: "Tool",
				title: "Tool update",
				detail: evt.message ?? evt.partialOutput,
			};
		}
		case "tool_execution_end": {
			const evt = event as EventWithToolResult;
			return {
				category: "Tool",
				title: `Tool end: ${evt.toolName ?? "unknown"}`,
				detail: extractToolOutput(evt.result),
			};
		}
		case "permission_request": {
			const evt = event as EventWithToolInfo;
			return {
				category: "Permission",
				title: `Permission requested: ${evt.toolName ?? "unknown"}`,
			};
		}
		case "permission_decision": {
			const evt = event as EventWithDecision;
			return {
				category: "Permission",
				title: `Permission ${evt.decision ?? "unknown"}`,
			};
		}
		case "notice":
			return { category: "Notice", title: (event as EventWithNotice).message ?? "Notice" };
		default:
			return { category: "Event", title: event.type.replace(/_/g, " ") };
	}
}

function extractMessageContent(message?: { content?: unknown }): string | undefined {
	if (!message?.content) return undefined;
	if (typeof message.content === "string") return message.content;
	if (Array.isArray(message.content))
		return extractContentBlocks(message.content as ContentBlock[]);
	return undefined;
}

function extractToolOutput(result?: {
	content?: ContentBlock[];
	details?: Record<string, unknown>;
}): string {
	if (!result) return "";
	if (result.content) {
		const text = extractContentBlocks(result.content);
		if (text) return text;
	}
	if (result.details && Array.isArray(result.details.content)) {
		return extractContentBlocks(result.details.content as ContentBlock[]);
	}
	return "";
}

function extractContentBlocks(blocks?: ContentBlock[]): string {
	if (!blocks) return "";
	return blocks
		.map((block) => {
			if (block.type === "text") return block.text;
			if (block.type === "media_ref" && block.filename) return block.filename;
			return "";
		})
		.filter(Boolean)
		.join(" ")
		.trim();
}

function stringifyCompact(value: Record<string, unknown> | undefined): string | undefined {
	if (!value) return undefined;
	try {
		return JSON.stringify(value);
	} catch {
		return undefined;
	}
}

function formatTime(timestamp: number): string {
	if (!timestamp) return "--:--:--";
	return new Date(timestamp).toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function truncate(value: string, max: number): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max)}...`;
}
