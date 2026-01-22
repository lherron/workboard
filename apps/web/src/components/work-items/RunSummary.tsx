import type { RunDetail } from "@/api/client";
import { MarkdownContent } from "@/components/MarkdownContent";
import type { SessionStreamEntry } from "@/hooks/useCpSessionStream";
import { cn } from "@/lib/utils";

type RunSummaryProps = {
	detail: RunDetail | null;
	loading: boolean;
	events: SessionStreamEntry[];
};

// Extract tool execution info from events
type ToolExecution = {
	toolUseId: string;
	toolName: string;
	input: Record<string, unknown>;
	isError: boolean;
	durationMs?: number;
};

type ToolStartInfo = {
	input: Record<string, unknown>;
	ts: number;
};

function extractToolsFromHistory(
	toolHistory: Record<string, unknown>[] | undefined,
): ToolExecution[] {
	if (!toolHistory || toolHistory.length === 0) return [];

	return toolHistory.map((tool) => ({
		toolUseId: (tool.toolUseId as string) ?? (tool.id as string) ?? "",
		toolName: (tool.toolName as string) ?? (tool.name as string) ?? "Tool",
		input: (tool.input as Record<string, unknown>) ?? {},
		isError: (tool.isError as boolean) ?? (tool.error as boolean) ?? false,
		durationMs: tool.durationMs as number | undefined,
	}));
}

function extractToolExecutions(events: SessionStreamEntry[]): ToolExecution[] {
	// Build a map of toolUseId -> start info from start events
	const startMap = new Map<string, ToolStartInfo>();

	for (const entry of events) {
		const event = entry.event;
		const kind = (event as Record<string, unknown>).kind ?? event.type;

		if (kind === "tool_execution_start") {
			const e = event as Record<string, unknown>;
			const toolUseId = e.toolUseId as string;
			if (toolUseId) {
				startMap.set(toolUseId, {
					input: (e.input as Record<string, unknown>) ?? {},
					ts: (e.ts as number) ?? 0,
				});
			}
		}
	}

	// Extract completed tools with their inputs and calculated duration
	const tools: ToolExecution[] = [];

	for (const entry of events) {
		const event = entry.event;
		const kind = (event as Record<string, unknown>).kind ?? event.type;

		if (kind === "tool_execution_end") {
			const e = event as Record<string, unknown>;
			const toolUseId = (e.toolUseId as string) ?? "";
			const startInfo = startMap.get(toolUseId);
			const endTs = (e.ts as number) ?? 0;
			const durationMs =
				startInfo && endTs && startInfo.ts
					? endTs - startInfo.ts
					: (e.durationMs as number | undefined);

			// Prefer input from start event, fall back to end event if available
			const inputFromEnd = (e.input as Record<string, unknown>) ?? {};
			const input =
				startInfo?.input && Object.keys(startInfo.input).length > 0
					? startInfo.input
					: inputFromEnd;

			tools.push({
				toolUseId,
				toolName: (e.toolName as string) ?? "Tool",
				input,
				isError: (e.isError as boolean) ?? false,
				durationMs,
			});
		}
	}

	return tools;
}

// Get a short summary of tool input
function getToolInputSummary(_toolName: string, input: Record<string, unknown>): string {
	// File-based tools (Read, Write, Edit, NotebookEdit)
	if (typeof input.file_path === "string") {
		return input.file_path;
	}
	// Bash tool
	if (typeof input.command === "string") {
		const cmd = input.command;
		return cmd.length > 60 ? `${cmd.slice(0, 57)}...` : cmd;
	}
	// Glob/Grep tools
	if (typeof input.pattern === "string") {
		const path = typeof input.path === "string" ? ` in ${input.path}` : "";
		return `${input.pattern}${path}`;
	}
	// WebFetch/WebSearch
	if (typeof input.url === "string") {
		return input.url;
	}
	if (typeof input.query === "string") {
		return input.query;
	}
	// Task tool
	if (typeof input.prompt === "string") {
		const prompt = input.prompt;
		return prompt.length > 60 ? `${prompt.slice(0, 57)}...` : prompt;
	}
	if (typeof input.description === "string") {
		return input.description;
	}
	// Fallback: find any string value that looks useful
	for (const [key, value] of Object.entries(input)) {
		if (typeof value === "string" && value.length > 0 && value.length < 100) {
			// Skip metadata-like fields
			if (["type", "kind", "id", "toolUseId"].includes(key)) continue;
			return value.length > 60 ? `${value.slice(0, 57)}...` : value;
		}
	}
	return "";
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
				// Parse model name: "claude-sonnet-4-5-20250929" -> "sonnet"
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

export function RunSummary({ detail, loading, events }: RunSummaryProps) {
	// Try SSE events first, fall back to toolHistory from run detail
	const toolsFromEvents = extractToolExecutions(events);
	const toolsFromHistory = extractToolsFromHistory(detail?.toolHistory);
	const toolExecutions = toolsFromEvents.length > 0 ? toolsFromEvents : toolsFromHistory;

	const modelName = extractModelName(events);
	const inProgress = isRunInProgress(events);

	return (
		<div className="space-y-3">
			{/* Loading state */}
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

			{/* Tool Calls Summary */}
			{toolExecutions.length > 0 && (
				<div className="space-y-1">
					{toolExecutions.map((tool, idx) => {
						const inputSummary = getToolInputSummary(tool.toolName, tool.input);
						return (
							<div
								key={idx}
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
						);
					})}
				</div>
			)}

			{/* Thinking indicator */}
			{inProgress && !detail?.response?.content && (
				<div className="flex items-center gap-2 py-2">
					<span className="flex gap-1">
						<span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.3s]" />
						<span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.15s]" />
						<span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" />
					</span>
					<span className="text-[10px] text-violet-400/70 italic">Thinking...</span>
				</div>
			)}

			{/* Response */}
			{detail?.response?.content && (
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

			{/* No data state */}
			{detail && !detail.input?.content && !detail.response?.content && !loading && (
				<div className="text-[9px] text-muted-foreground/40 italic">
					No prompt/response data available
				</div>
			)}
		</div>
	);
}
