/**
 * SessionChatRoute - Chat/summary view for session events.
 *
 * Displays events grouped by run using RunCard components.
 * Route: /sessions/:sessionId/chat
 */

import { type RunSummary, fetchRuns } from "@/api/client";
import { RunCard } from "@/components/chat/RunCard";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useCpSessionStream } from "@/hooks/useCpSessionStream";
import { detectLiveRun, groupEventsByRun } from "@/lib/chat";
import { List, Loader2, Radio, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";

export function SessionChatRoute() {
	const [, params] = useRoute("/sessions/:sessionId/chat");
	const sessionId = params?.sessionId ?? null;

	// Fetch runs for this session
	const [runs, setRuns] = useState<RunSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!sessionId) return;

		let cancelled = false;
		setLoading(true);
		setError(null);

		fetchRuns({ sessionId })
			.then((data) => {
				if (!cancelled) {
					setRuns(data.runs);
				}
			})
			.catch((err) => {
				if (!cancelled) {
					setError(err.message ?? "Failed to fetch runs");
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [sessionId]);

	// Connect to SSE for live events
	const {
		entries = [],
		isConnected,
		isConnecting,
		error: streamError,
	} = useCpSessionStream({
		sessionId: sessionId,
		enabled: Boolean(sessionId),
		maxEvents: 500,
	});

	// Sort entries by sequence
	const sortedEntries = useMemo(
		() => [...(entries || [])].sort((a, b) => a.seq - b.seq),
		[entries],
	);

	// Map RunSummary to RunLike for groupEventsByRun
	const runsAsRunLike = useMemo(
		() =>
			runs.map((r) => ({
				runId: r.runId,
				status: r.status,
				createdAt: r.createdAt,
				completedAt: r.completedAt,
			})),
		[runs],
	);

	// Group events by run
	const runGroups = useMemo(
		() => groupEventsByRun(sortedEntries, runsAsRunLike),
		[sortedEntries, runsAsRunLike],
	);

	// Detect live runs
	const hasLiveRun = useMemo(
		() => detectLiveRun(runsAsRunLike, sortedEntries),
		[runsAsRunLike, sortedEntries],
	);

	// Auto-scroll on new entries
	const { scrollRef } = useAutoScroll({
		dependency: entries?.length ?? 0,
		resetKey: sessionId ?? "",
	});

	if (!sessionId) {
		return (
			<div className="flex items-center justify-center h-screen text-muted-foreground">
				No session ID provided
			</div>
		);
	}

	return (
		<div className="h-screen flex flex-col bg-background">
			{/* Header */}
			<div className="shrink-0 px-6 py-4 border-b border-border/40">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<h1 className="text-lg font-semibold text-foreground">Session Chat</h1>
						<span className="text-xs font-mono text-muted-foreground/60 bg-muted/30 px-2 py-1 rounded">
							{sessionId}
						</span>
					</div>

					{/* View switcher + Connection status */}
					<div className="flex items-center gap-3">
						<Link
							href={`/sessions/${sessionId}/timeline`}
							className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border/40 rounded hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
						>
							<List className="h-3.5 w-3.5" />
							Timeline
						</Link>

						{hasLiveRun && (
							<span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
								<Radio className="h-3 w-3" />
								<span className="animate-pulse">Live</span>
							</span>
						)}
						{isConnecting && (
							<span className="inline-flex items-center gap-1.5 text-xs text-amber-400/70">
								<Loader2 className="h-3 w-3 animate-spin" />
								connecting
							</span>
						)}
						{isConnected && !isConnecting && (
							<span className="inline-flex items-center gap-1.5 text-xs text-emerald-400/70">
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
								connected
							</span>
						)}
						{streamError && (
							<span className="inline-flex items-center gap-1.5 text-xs text-red-400/70">
								<WifiOff className="h-3 w-3" />
								disconnected
							</span>
						)}
					</div>
				</div>

				{/* Stats */}
				<div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground/60">
					<span>{runs.length} runs</span>
					<span>{entries.length} events</span>
				</div>
			</div>

			{/* Content */}
			<div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
				{loading ? (
					<div className="flex items-center justify-center h-full">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
					</div>
				) : error ? (
					<div className="flex items-center justify-center h-full text-red-400">{error}</div>
				) : runGroups.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-center">
						<div className="border border-dashed border-border/40 rounded px-8 py-6">
							<div className="text-2xl text-muted-foreground/30 mb-2">○ ○ ○</div>
							<div className="text-sm font-medium uppercase tracking-wider text-muted-foreground/40">
								No Runs
							</div>
							<div className="text-xs text-muted-foreground/30 mt-1">
								Waiting for activity in this session
							</div>
						</div>
					</div>
				) : (
					<div className="space-y-2 max-w-4xl mx-auto">
						{runGroups.map((group, groupIndex) => (
							<RunCard
								key={`${group.runId}-${groupIndex}`}
								run={group.run}
								runId={group.runId}
								events={group.events}
								isFirst={groupIndex === 0}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
