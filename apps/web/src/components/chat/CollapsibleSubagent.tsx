/**
 * CollapsibleSubagent - Renders a Task tool call with its subagent events collapsed.
 *
 * Shows:
 * - Header: subagent type + task description
 * - Hint: last event summary (when collapsed)
 * - Expandable: full list of subagent events
 */

import type { SessionStreamEntry } from "@/hooks/useCpSessionStream";
import { getLastSubagentHint } from "@/lib/subagentEvents";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { EventBlock } from "../work-items/EventBlock";

type CollapsibleSubagentProps = {
	/** Task description from the tool input */
	description: string;
	/** Subagent type (e.g., "Explore", "Plan") */
	subagentType: string;
	/** Subagent events to render when expanded */
	events: SessionStreamEntry[];
	/** Whether the subagent is still running */
	isLive?: boolean;
	/** Theme color for styling */
	themeColor?: string;
};

/**
 * Icon for subagent types.
 */
function getSubagentIcon(type: string): string {
	switch (type.toLowerCase()) {
		case "explore":
			return "🔍";
		case "plan":
			return "📋";
		case "bash":
			return "💻";
		default:
			return "🤖";
	}
}

export function CollapsibleSubagent({
	description,
	subagentType,
	events,
	isLive = false,
	themeColor,
}: CollapsibleSubagentProps) {
	const [expanded, setExpanded] = useState(false);

	const hint = getLastSubagentHint(events);
	const icon = getSubagentIcon(subagentType);

	return (
		<div
			className={cn("border-l-2 border-l-violet-500/50 pl-3 py-1.5", "bg-slate-900/30 rounded-r")}
		>
			{/* Header row - clickable to expand/collapse */}
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="w-full flex items-center gap-2 text-left hover:bg-slate-800/30 -ml-3 pl-3 -mr-1 pr-1 py-0.5 rounded transition-colors"
			>
				{/* Expand/collapse icon */}
				{expanded ? (
					<ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
				) : (
					<ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
				)}

				{/* Subagent type badge */}
				<span className="text-[10px] font-medium text-violet-400 shrink-0">
					{icon} {subagentType}
				</span>

				{/* Description */}
				<span className="text-[10px] text-slate-400 truncate flex-1">{description}</span>

				{/* Live indicator or event count */}
				{isLive ? (
					<Loader2 className="w-3 h-3 text-violet-400 animate-spin shrink-0" />
				) : (
					<span className="text-[9px] text-slate-600 shrink-0">{events.length} events</span>
				)}
			</button>

			{/* Hint line (when collapsed) */}
			{!expanded && hint && (
				<div className="mt-1 ml-5 flex items-center gap-1.5">
					<span className="text-[9px] text-slate-600">└─</span>
					{hint.kind === "tool" ? (
						<span className="text-[9px] text-amber-400/70">{hint.summary}</span>
					) : (
						<span className="text-[9px] text-slate-500 italic truncate">{hint.summary}</span>
					)}
				</div>
			)}

			{/* Expanded event list */}
			{expanded && events.length > 0 && (
				<div className="mt-2 ml-3 border-l border-slate-700/50 pl-2 space-y-0.5">
					{events.map((entry, index) => (
						<EventBlock
							key={entry.id}
							entry={entry}
							roleColor={themeColor ?? "#8b5cf6"}
							isNew={isLive && index === events.length - 1}
						/>
					))}
				</div>
			)}
		</div>
	);
}
