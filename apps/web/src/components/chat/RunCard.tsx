/**
 * Shared RunCard component for displaying a single run with events and summary.
 *
 * Extracted from SessionCard and ProjectRosterConversation to provide
 * consistent run display across chat UIs.
 */

import { type RunDetail, fetchRunDetail } from "@/api/client";
import type { SessionStreamEntry } from "@/hooks/useCpSessionStream";
import type { RunLike } from "@/lib/chat";
import { formatTimestamp } from "@/lib/datetime";
import { getRunStatusStyle } from "@/lib/runStatus";
import { groupSubagentEvents } from "@/lib/subagentEvents";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EventBlock } from "../work-items/EventBlock";
import { RunSummary } from "../work-items/RunSummary";
import { CollapsibleSubagent } from "./CollapsibleSubagent";

export type RunCardProps = {
	/** Run identifier */
	runId: string;

	/** Run metadata (optional - may not be available for unknown runs) */
	run?: RunLike & { kind?: string };

	/** Events belonging to this run */
	events: SessionStreamEntry[];

	/** Theme color for role-based styling */
	themeColor?: string;

	/** Whether this is the first run (affects top border) */
	isFirst?: boolean;

	/** Optional CSS class for the container */
	className?: string;
};

/**
 * Check if a run has a completion event in the provided events.
 */
function hasCompletedEvent(events: SessionStreamEntry[]): boolean {
	return events.some((e) => {
		const kind = (e.event as Record<string, unknown>).kind ?? e.event.type;
		return kind === "run_completed";
	});
}

/**
 * RunCard displays a single run with:
 * - Header showing run ID, kind, status, and timestamps
 * - Expandable event timeline
 * - Run summary with prompt, tools, and response
 */
export function RunCard({
	runId,
	run,
	events,
	themeColor,
	isFirst = false,
	className,
}: RunCardProps) {
	const [eventsExpanded, setEventsExpanded] = useState(false);
	const [detail, setDetail] = useState<RunDetail | null>(null);
	const [loading, setLoading] = useState(false);

	const status = run?.status ?? "unknown";
	const statusStyle = getRunStatusStyle(status);
	const isLive = status === "running";

	// Group subagent events under their parent Task tools
	const groupedEvents = useMemo(() => groupSubagentEvents(events), [events]);

	// Check if run_completed event exists in events
	const hasCompleted = hasCompletedEvent(events);

	// Fetch run details on mount and when run completes
	// biome-ignore lint/correctness/useExhaustiveDependencies: hasCompleted triggers re-fetch when run completes
	useEffect(() => {
		if (runId === "unknown") return;

		// Skip if we already have response content
		if (detail?.response?.content) return;

		let cancelled = false;
		setLoading(true);

		fetchRunDetail(runId)
			.then((data) => {
				if (!cancelled) setDetail(data);
			})
			.catch((err) => {
				if (!cancelled) console.error("Failed to fetch run detail:", err);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [runId, hasCompleted, detail?.response?.content]);

	return (
		<div className={cn("py-3", !isFirst && "mt-4 border-t border-slate-800/50", className)}>
			{/* Header row with all metadata + events toggle */}
			<div className="flex items-center gap-2 mb-3 flex-wrap">
				<span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">RUN</span>
				<span className="text-[9px] font-mono text-slate-600">{runId.slice(0, 8)}</span>

				{run?.kind && (
					<span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-secondary/60 border border-border/30 text-muted-foreground/60">
						{run.kind}
					</span>
				)}

				<span className={cn("text-[8px] font-bold uppercase", statusStyle.color)}>
					{statusStyle.label}
				</span>

				{run && (
					<span className="text-[8px] text-slate-600">
						{formatTimestamp(run.createdAt)}
						{run.completedAt && ` → ${formatTimestamp(run.completedAt)}`}
					</span>
				)}

				{/* Events toggle inline */}
				{events.length > 0 && (
					<button
						className="flex items-center gap-1 ml-auto text-[8px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-400 transition-colors"
						onClick={() => setEventsExpanded(!eventsExpanded)}
					>
						{eventsExpanded ? (
							<ChevronDown className="w-3 h-3" />
						) : (
							<ChevronRight className="w-3 h-3" />
						)}
						{events.length} events
					</button>
				)}
			</div>

			{/* Events - expanded below header, above prompt/response */}
			{eventsExpanded && groupedEvents.length > 0 && (
				<div className="mb-3 ml-2 border-l border-slate-800/30 pl-2 space-y-1">
					{groupedEvents.map((grouped, index) => {
						// Task tool with subagent events - render collapsed
						if (grouped.taskMeta && grouped.subagentEvents) {
							return (
								<CollapsibleSubagent
									key={grouped.entry.id}
									description={grouped.taskMeta.description}
									subagentType={grouped.taskMeta.subagentType}
									events={grouped.subagentEvents}
									isLive={isLive}
									themeColor={themeColor}
								/>
							);
						}
						// Regular event
						return (
							<EventBlock
								key={grouped.entry.id}
								entry={grouped.entry}
								roleColor={themeColor ?? "#64748b"}
								isNew={grouped.entry.source === "live" && index === groupedEvents.length - 1}
							/>
						);
					})}
				</div>
			)}

			{/* Run Summary - prompt, tools, response */}
			<RunSummary detail={detail} loading={loading} events={events} />
		</div>
	);
}
