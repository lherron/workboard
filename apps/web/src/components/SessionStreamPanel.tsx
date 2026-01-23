import { SessionEventRow } from "@/components/session-events";
import { type SessionStreamEntry, useCpSessionStream } from "@/hooks/useCpSessionStream";
import { cn } from "@/lib/utils";
import { toRenderableEvent } from "@/session-events";
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

// Styling is handled inside SessionEventRow; this component only provides the stream.

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
	const renderable = toRenderableEvent(entry);
	if (!renderable) return null;
	return <SessionEventRow event={renderable} variant="stream-panel" />;
}
