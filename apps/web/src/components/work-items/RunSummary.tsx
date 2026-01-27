import type { RunDetail } from "@/api/client";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MediaAttachments } from "@/components/session-events";
import type { SessionStreamEntry } from "@/hooks/useCpSessionStream";
import { cn } from "@/lib/utils";
import {
	type MediaAttachment,
	type TranscriptItem,
	type TranscriptToolCall,
	buildTranscript,
	isImagePath,
	resolveLocalFileUrl,
	summarizeToolInput,
} from "@/session-events";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";

type RunSummaryProps = {
	detail: RunDetail | null;
	loading: boolean;
	events: SessionStreamEntry[];
};

// Fallback timeline tool type - extracted from API toolHistory
type TimelineTool = {
	kind: "tool";
	seq: number;
	toolUseId: string;
	toolName: string;
	input: Record<string, unknown>;
	isError: boolean;
	durationMs?: number;
};

// Fallback: extract tools from API toolHistory if no SSE events
function extractToolsFromHistory(
	toolHistory: Record<string, unknown>[] | undefined,
): TimelineTool[] {
	if (!toolHistory || toolHistory.length === 0) return [];

	return toolHistory.map((tool, idx) => ({
		kind: "tool" as const,
		seq: idx,
		toolUseId: (tool.toolUseId as string) ?? (tool.id as string) ?? "",
		toolName: (tool.toolName as string) ?? (tool.name as string) ?? "Tool",
		input: (tool.input as Record<string, unknown>) ?? {},
		isError: (tool.isError as boolean) ?? (tool.error as boolean) ?? false,
		durationMs: tool.durationMs as number | undefined,
	}));
}

// Extract model name from message_update events
function extractModelName(events: SessionStreamEntry[]): string | null {
	for (const entry of events) {
		const event = entry.event;
		const kind = (event as Record<string, unknown>).kind ?? event.type;

		if (kind === "message_update") {
			const payload = (event as Record<string, unknown>).payload as
				| Record<string, unknown>
				| undefined;
			const message = payload?.message as Record<string, unknown> | undefined;
			const model = message?.model as string | undefined;
			if (model) {
				if (model.includes("opus")) return "opus";
				if (model.includes("sonnet")) return "sonnet";
				if (model.includes("haiku")) return "haiku";
				return model;
			}
		}
	}
	return null;
}

// Check if run is in progress (started but not completed)
function isRunInProgress(events: SessionStreamEntry[]): boolean {
	let hasStarted = false;
	let hasEnded = false;

	for (const entry of events) {
		const kind = (entry.event as Record<string, unknown>).kind ?? entry.event.type;
		if (kind === "run_started") hasStarted = true;
		if (kind === "run_completed" || kind === "run_failed" || kind === "run_cancelled") {
			hasEnded = true;
		}
	}

	return hasStarted && !hasEnded;
}

// Grouped transcript item - tool with optional children
type GroupedTranscriptItem =
	| TranscriptItem
	| (TranscriptToolCall & { childTools?: TranscriptToolCall[] });

/**
 * Group subagent tools under their parent Task tools.
 */
function groupTranscriptTools(items: TranscriptItem[]): GroupedTranscriptItem[] {
	// Build map of Task tools (tools named "Task")
	const taskToolMap = new Map<string, TranscriptToolCall & { childTools: TranscriptToolCall[] }>();
	for (const item of items) {
		if (item.kind === "tool" && item.toolName === "Task") {
			taskToolMap.set(item.toolUseId, { ...item, childTools: [] });
		}
	}

	// If no Task tools, return as-is
	if (taskToolMap.size === 0) {
		return items;
	}

	// Collect child tools and track which items to skip
	const childToolIds = new Set<string>();
	for (const item of items) {
		if (item.kind === "tool" && item.parentToolUseId) {
			const parent = taskToolMap.get(item.parentToolUseId);
			if (parent) {
				parent.childTools.push(item);
				childToolIds.add(item.toolUseId);
			}
		}
	}

	// Build grouped result, filtering out child tools from top level
	const result: GroupedTranscriptItem[] = [];
	for (const item of items) {
		if (item.kind === "tool") {
			// Skip child tools (they're nested under parent)
			if (childToolIds.has(item.toolUseId)) continue;
			// Use grouped version for Task tools
			if (item.toolName === "Task") {
				const grouped = taskToolMap.get(item.toolUseId);
				if (grouped) {
					result.push(grouped);
					continue;
				}
			}
		}
		result.push(item);
	}

	return result;
}

function getFallbackToolAttachments(tool: TimelineTool): MediaAttachment[] {
	const filePath =
		typeof tool.input.file_path === "string" ? (tool.input.file_path as string) : undefined;
	if (!tool.isError && tool.toolName === "Read" && filePath && isImagePath(filePath)) {
		return [
			{ kind: "image", src: resolveLocalFileUrl(filePath), alt: filePath, filename: filePath },
		];
	}
	return [];
}

/**
 * Render a single tool item (used for both top-level and nested tools).
 */
function ToolItem({ tool, nested = false }: { tool: TranscriptToolCall; nested?: boolean }) {
	const inputSummary = summarizeToolInput(tool.input);
	return (
		<div className="space-y-1">
			<div
				className={cn(
					"rounded-sm border px-2 py-1 flex items-center gap-2",
					tool.isError ? "border-red-500/20 bg-red-500/5" : "border-amber-500/20 bg-amber-500/5",
					nested && "ml-4 border-l-2 border-l-violet-500/30",
				)}
			>
				<span
					className={cn("text-[10px] shrink-0", tool.isError ? "text-red-400" : "text-emerald-400")}
				>
					{tool.isError ? "✗" : "✓"}
				</span>
				<span className="text-[10px] font-bold text-amber-300 shrink-0">{tool.toolName}</span>
				{inputSummary && (
					<span className="text-[9px] font-mono text-muted-foreground/50 truncate min-w-0">
						{inputSummary}
					</span>
				)}
				{tool.durationMs !== undefined && (
					<span className="text-[8px] font-mono text-muted-foreground/40 ml-auto shrink-0">
						{tool.durationMs}ms
					</span>
				)}
			</div>
			{tool.attachments.length > 0 && (
				<div className="ml-4 mt-1">
					<MediaAttachments attachments={tool.attachments} />
				</div>
			)}
		</div>
	);
}

/**
 * Get the last child tool hint for a collapsed Task.
 */
function getLastChildToolHint(childTools: TranscriptToolCall[]): string | null {
	if (childTools.length === 0) return null;
	const lastTool = childTools[childTools.length - 1];
	const inputSummary = summarizeToolInput(lastTool.input);
	return inputSummary ? `${lastTool.toolName}: ${inputSummary}` : lastTool.toolName;
}

/**
 * Collapsible Task tool with nested child tools.
 */
function CollapsibleTaskTool({
	tool,
	childTools,
}: { tool: TranscriptToolCall; childTools: TranscriptToolCall[] }) {
	const [expanded, setExpanded] = useState(false);
	const inputSummary = summarizeToolInput(tool.input);
	const hasChildren = childTools.length > 0;
	const isRunning = tool.durationMs === undefined;
	const lastChildHint = !expanded ? getLastChildToolHint(childTools) : null;

	return (
		<div className="space-y-1">
			<div
				className={cn(
					"rounded-sm border px-2 py-1 flex items-center gap-2",
					tool.isError
						? "border-red-500/20 bg-red-500/5"
						: isRunning
							? "border-violet-500/30 bg-violet-500/5"
							: "border-amber-500/20 bg-amber-500/5",
				)}
			>
				{/* Expand/collapse button */}
				{hasChildren && (
					<button
						type="button"
						onClick={() => setExpanded(!expanded)}
						className="text-slate-500 hover:text-slate-400 transition-colors shrink-0"
					>
						{expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
					</button>
				)}
				{/* Status indicator: spinner for running, checkmark/X for completed */}
				{isRunning ? (
					<Loader2 className="w-3 h-3 text-violet-400 animate-spin shrink-0" />
				) : (
					<span
						className={cn(
							"text-[10px] shrink-0",
							tool.isError ? "text-red-400" : "text-emerald-400",
						)}
					>
						{tool.isError ? "✗" : "✓"}
					</span>
				)}
				<span className="text-[10px] font-bold text-amber-300 shrink-0">{tool.toolName}</span>
				{inputSummary && (
					<span className="text-[9px] font-mono text-muted-foreground/50 truncate min-w-0">
						{inputSummary}
					</span>
				)}
				{hasChildren && !expanded && (
					<span className="text-[8px] text-violet-400/60 shrink-0">
						({childTools.length} tools)
					</span>
				)}
				{tool.durationMs !== undefined && (
					<span className="text-[8px] font-mono text-muted-foreground/40 ml-auto shrink-0">
						{tool.durationMs}ms
					</span>
				)}
			</div>

			{/* Last child tool hint when collapsed */}
			{!expanded && lastChildHint && (
				<div className="ml-6 flex items-center gap-1.5">
					<span className="text-[9px] text-slate-600">└─</span>
					<span className="text-[9px] text-amber-400/70 truncate">{lastChildHint}</span>
				</div>
			)}

			{/* Expanded child tools */}
			{expanded && hasChildren && (
				<div className="space-y-1 ml-2 pl-2 border-l border-violet-500/20">
					{childTools.map((child) => (
						<ToolItem key={child.toolUseId} tool={child} nested />
					))}
				</div>
			)}

			{tool.attachments.length > 0 && (
				<div className="ml-4 mt-1">
					<MediaAttachments attachments={tool.attachments} />
				</div>
			)}
		</div>
	);
}

export function RunSummary({ detail, loading, events }: RunSummaryProps) {
	// Shared transcript builder (single pipeline for session/run events).
	const transcript: TranscriptItem[] = buildTranscript(events, {
		includeUserPrompts: false,
		includeToolCalls: true,
		includeAssistantMessages: true,
		includeMessageRoles: ["assistant"],
	});

	// Group subagent tools under their parent Task tools
	const groupedTranscript = groupTranscriptTools(transcript);

	// Fallback to toolHistory from API if no SSE events
	const fallbackTools = transcript.length === 0 ? extractToolsFromHistory(detail?.toolHistory) : [];
	const hasTimeline = groupedTranscript.length > 0 || fallbackTools.length > 0;

	const modelName = extractModelName(events);
	const inProgress = isRunInProgress(events);

	const firstAssistantIndex = groupedTranscript.findIndex((item) => item.kind === "assistant");

	return (
		<div className="space-y-3">
			{loading && <div className="text-[9px] text-muted-foreground/50 italic">Loading...</div>}

			{/* Prompt */}
			{detail?.input?.content && (
				<div className="border-l-2 border-cyan-500/40 pl-2">
					<div className="text-[8px] font-bold uppercase tracking-wider text-cyan-400/70 mb-1">
						PROMPT
					</div>
					<div className="text-[10px] text-foreground/70 whitespace-pre-wrap leading-relaxed bg-cyan-500/5 px-2 py-1.5 rounded-sm">
						{detail.input.content}
					</div>
				</div>
			)}

			{/* Chronological Timeline - interleaved messages and tools */}
			{groupedTranscript.length > 0 && (
				<div className="space-y-2">
					{groupedTranscript.map((item, idx) => {
						if (item.kind === "tool") {
							// Check if this is a Task tool with children
							const toolWithChildren = item as TranscriptToolCall & {
								childTools?: TranscriptToolCall[];
							};
							if (toolWithChildren.childTools && toolWithChildren.childTools.length > 0) {
								return (
									<CollapsibleTaskTool
										key={`tool-${item.toolUseId || idx}`}
										tool={item}
										childTools={toolWithChildren.childTools}
									/>
								);
							}
							// Regular tool (no children)
							return <ToolItem key={`tool-${item.toolUseId || idx}`} tool={item} />;
						}

						if (item.kind === "assistant") {
							return (
								<div key={`msg-${item.id}`} className="border-l-2 border-emerald-500/40 pl-2">
									<div className="flex items-center gap-2 mb-1">
										<span className="text-[8px] font-bold uppercase tracking-wider text-emerald-400/70">
											RESPONSE
										</span>
										{modelName && idx === firstAssistantIndex && (
											<span className="text-[8px] font-mono px-1 py-0.5 rounded bg-violet-500/20 text-violet-300/80">
												{modelName}
											</span>
										)}
									</div>
									<div className="text-[11px] text-foreground/80 leading-relaxed bg-emerald-500/5 px-2 py-1.5 rounded-sm">
										<MarkdownContent
											content={item.content}
											className="prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:text-[10px] [&_pre]:text-[10px] [&_pre]:my-1 [&_h1]:text-[14px] [&_h1]:font-semibold [&_h1]:my-2 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:my-1.5 [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:my-1 [&_h4]:text-[12px] [&_h4]:font-medium [&_h4]:my-1"
										/>
									</div>
									{item.attachments.length > 0 && (
										<div className="mt-1">
											<MediaAttachments attachments={item.attachments} />
										</div>
									)}
								</div>
							);
						}

						return null;
					})}
				</div>
			)}

			{/* Fallback: Tool history from API (when no SSE events) */}
			{fallbackTools.length > 0 && (
				<div className="space-y-1">
					{fallbackTools.map((tool, idx) => {
						const inputSummary = summarizeToolInput(tool.input);
						const attachments = getFallbackToolAttachments(tool);
						return (
							<div key={idx} className="space-y-1">
								<div
									className={cn(
										"rounded-sm border px-2 py-1 flex items-center gap-2",
										tool.isError
											? "border-red-500/20 bg-red-500/5"
											: "border-amber-500/20 bg-amber-500/5",
									)}
								>
									<span
										className={cn(
											"text-[10px] shrink-0",
											tool.isError ? "text-red-400" : "text-emerald-400",
										)}
									>
										{tool.isError ? "✗" : "✓"}
									</span>
									<span className="text-[10px] font-bold text-amber-300 shrink-0">
										{tool.toolName}
									</span>
									{inputSummary && (
										<span className="text-[9px] font-mono text-muted-foreground/50 truncate min-w-0">
											{inputSummary}
										</span>
									)}
									{tool.durationMs !== undefined && (
										<span className="text-[8px] font-mono text-muted-foreground/40 ml-auto shrink-0">
											{tool.durationMs}ms
										</span>
									)}
								</div>
								{attachments.length > 0 && (
									<div className="ml-4 mt-1">
										<MediaAttachments attachments={attachments} />
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* Fallback response from API (when no SSE events) */}
			{transcript.length === 0 && detail?.response?.content && (
				<div className="border-l-2 border-emerald-500/40 pl-2">
					<div className="flex items-center gap-2 mb-1">
						<span className="text-[8px] font-bold uppercase tracking-wider text-emerald-400/70">
							RESPONSE
						</span>
						{modelName && (
							<span className="text-[8px] font-mono px-1 py-0.5 rounded bg-violet-500/20 text-violet-300/80">
								{modelName}
							</span>
						)}
					</div>
					<div className="text-[11px] text-foreground/80 leading-relaxed bg-emerald-500/5 px-2 py-1.5 rounded-sm">
						<MarkdownContent
							content={detail.response.content}
							className="prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:text-[10px] [&_pre]:text-[10px] [&_pre]:my-1 [&_h1]:text-[14px] [&_h1]:font-semibold [&_h1]:my-2 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:my-1.5 [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:my-1 [&_h4]:text-[12px] [&_h4]:font-medium [&_h4]:my-1"
						/>
					</div>
				</div>
			)}

			{/* Thinking indicator */}
			{inProgress && !hasTimeline && (
				<div className="flex items-center gap-2 py-2">
					<span className="flex gap-1">
						<span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.3s]" />
						<span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.15s]" />
						<span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" />
					</span>
					<span className="text-[10px] text-violet-400/70 italic">Thinking...</span>
				</div>
			)}

			{/* No data state */}
			{detail && !detail.input?.content && !hasTimeline && !loading && (
				<div className="text-[9px] text-muted-foreground/40 italic">
					No prompt/response data available
				</div>
			)}
		</div>
	);
}
