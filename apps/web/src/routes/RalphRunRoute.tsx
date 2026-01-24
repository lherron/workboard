import {
	type ApiClientError,
	type RalphIterationRecord,
	type RalphRunDetailResponse,
	type RunListResponse,
	type RunSummary,
	cancelRalphRun,
	fetchProjectRunsByParentRunId,
	fetchRalphRunDetail,
	pauseRalphRun,
	resumeRalphRun,
} from "@/api/client";
import { SessionStreamPanel } from "@/components/SessionStreamPanel";
import { cn } from "@/lib/utils";
import { ChevronRight, Loader2, Pause, Play, RotateCcw, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";

type Tab = "stream" | "child-runs";

function isActiveStatus(status: string): boolean {
	return ["queued", "running", "pausing", "paused", "cancelling"].includes(status);
}

function formatTs(ts?: number): string {
	if (!ts) return "";
	try {
		return new Date(ts).toLocaleString();
	} catch {
		return String(ts);
	}
}

function extractReportSummary(iter: RalphIterationRecord): string {
	const r = iter.report as { summary?: string; done?: boolean } | undefined;
	if (!r) return "";
	if (typeof r.summary === "string" && r.summary.trim()) return r.summary;
	if (typeof r.done === "boolean") return r.done ? "done" : "continue";
	return "";
}

export function RalphRunRoute() {
	const { projectId, rootRunId } = useParams<{ projectId: string; rootRunId: string }>();
	const [, setLocation] = useLocation();
	const [tab, setTab] = useState<Tab>("stream");
	const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [detail, setDetail] = useState<RalphRunDetailResponse | null>(null);
	const [childRuns, setChildRuns] = useState<RunListResponse | null>(null);
	const [selectedIterId, setSelectedIterId] = useState<string | null>(null);

	const refresh = useCallback(
		async (signal?: AbortSignal, silent = false) => {
			if (!projectId || !rootRunId) return;
			if (!silent) {
				setLoading(true);
				setError(null);
			}
			try {
				const [d, runs] = await Promise.all([
					fetchRalphRunDetail(projectId, rootRunId, signal),
					fetchProjectRunsByParentRunId(projectId, rootRunId, signal).catch(() => ({ runs: [] })),
				]);
				setDetail(d);
				setChildRuns(runs);
				if (!silent) {
					setLoading(false);
					setError(null);
				}
				// Default selection: latest iteration
				if (!selectedIterId && d.iterations.length > 0) {
					setSelectedIterId(d.iterations[d.iterations.length - 1].iterationId);
				}
			} catch (err) {
				if ((err as Error).name === "AbortError") return;
				if (!silent) {
					setLoading(false);
					setError((err as Error).message || "Failed to load Ralph run");
				}
			}
		},
		[projectId, rootRunId, selectedIterId],
	);

	useEffect(() => {
		const controller = new AbortController();
		void refresh(controller.signal);
		return () => controller.abort();
	}, [refresh]);

	useEffect(() => {
		if (!toast) return;
		const t = window.setTimeout(() => setToast(null), 2000);
		return () => window.clearTimeout(t);
	}, [toast]);

	useEffect(() => {
		if (!detail) return;
		if (!isActiveStatus(detail.run.status)) return;
		const id = window.setInterval(() => {
			void refresh(undefined, true);
		}, 2000);
		return () => window.clearInterval(id);
	}, [detail, refresh]);

	const iterations = detail?.iterations ?? [];
	const selectedIter = useMemo(() => {
		if (!selectedIterId) return null;
		return iterations.find((i) => i.iterationId === selectedIterId) ?? null;
	}, [iterations, selectedIterId]);

	const activeChild = useMemo(() => {
		const state = (detail?.run.state ?? {}) as { activeChildRunId?: string };
		return typeof state.activeChildRunId === "string" ? state.activeChildRunId : null;
	}, [detail]);

	const controlButtons = useMemo(() => {
		const status = detail?.run.status;
		if (!status) return null;
		const canPause = status === "running" || status === "queued";
		const canResume = status === "paused";
		const canCancel = ["queued", "running", "pausing", "paused", "cancelling"].includes(status);
		return { canPause, canResume, canCancel };
	}, [detail]);

	const onPause = useCallback(async () => {
		if (!projectId || !rootRunId) return;
		try {
			await pauseRalphRun(projectId, rootRunId);
			setToast({ kind: "success", msg: "Pausing" });
			await refresh();
		} catch (err) {
			setToast({ kind: "error", msg: (err as ApiClientError).message || "Failed to pause" });
		}
	}, [projectId, rootRunId, refresh]);

	const onResume = useCallback(async () => {
		if (!projectId || !rootRunId) return;
		try {
			await resumeRalphRun(projectId, rootRunId);
			setToast({ kind: "success", msg: "Resumed" });
			await refresh();
		} catch (err) {
			setToast({ kind: "error", msg: (err as ApiClientError).message || "Failed to resume" });
		}
	}, [projectId, rootRunId, refresh]);

	const onCancel = useCallback(async () => {
		if (!projectId || !rootRunId) return;
		try {
			await cancelRalphRun(projectId, rootRunId);
			setToast({ kind: "success", msg: "Cancelling" });
			await refresh();
		} catch (err) {
			setToast({ kind: "error", msg: (err as ApiClientError).message || "Failed to cancel" });
		}
	}, [projectId, rootRunId, refresh]);

	if (!projectId || !rootRunId) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-sm text-muted-foreground">Missing route params</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen bg-[#0a0e27] text-foreground">
			{toast && (
				<div
					className={cn(
						"fixed top-4 right-4 z-50 px-3 py-2 border font-mono text-xs",
						toast.kind === "success"
							? "bg-emerald-500/10 border-emerald-400/30 text-emerald-200"
							: "bg-rose-500/10 border-rose-400/30 text-rose-200",
					)}
				>
					{toast.msg}
				</div>
			)}

			<header className="shrink-0 border-b border-indigo-900/30 bg-[#0d1133]/60 backdrop-blur-sm">
				<div className="px-6 py-4 flex items-center justify-between gap-4">
					<div className="flex items-center gap-3 min-w-0">
						<Link
							href={`/projects/${projectId}/ralph`}
							className="px-3 py-1.5 text-[10px] uppercase tracking-wider border border-indigo-700/50 hover:bg-indigo-900/30 transition-colors text-cyan-200 rounded"
						>
							Back
						</Link>
						<div className="h-8 w-px bg-indigo-700/50" />
						<div className="min-w-0">
							<div className="text-[14px] font-bold tracking-wide uppercase text-cyan-100 truncate">
								Ralph Run
							</div>
							<div className="text-[11px] text-cyan-200/60 font-mono truncate">{rootRunId}</div>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{detail && <span className={statusPill(detail.run.status)}>{detail.run.status}</span>}
						<button
							onClick={() => void refresh()}
							className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider border border-indigo-900/40 text-cyan-200/70 hover:text-cyan-200"
							title="Refresh"
						>
							<RotateCcw className="h-3 w-3" />
						</button>
						{controlButtons?.canPause && (
							<button
								onClick={onPause}
								className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider border border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15"
							>
								<Pause className="h-3 w-3" />
								Pause
							</button>
						)}
						{controlButtons?.canResume && (
							<button
								onClick={onResume}
								className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15"
							>
								<Play className="h-3 w-3" />
								Resume
							</button>
						)}
						{controlButtons?.canCancel && (
							<button
								onClick={onCancel}
								className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider border border-rose-400/40 bg-rose-400/10 text-rose-200 hover:bg-rose-400/15"
							>
								<Square className="h-3 w-3" />
								Cancel
							</button>
						)}
					</div>
				</div>
			</header>

			<div className="flex-1 overflow-hidden">
				{loading ? (
					<div className="p-6 flex items-center gap-2 text-xs text-cyan-200/70 font-mono">
						<Loader2 className="h-4 w-4 animate-spin" /> loading...
					</div>
				) : error ? (
					<div className="p-6 text-sm text-rose-200 font-mono">{error}</div>
				) : !detail ? (
					<div className="p-6 text-sm text-cyan-200/60 font-mono">No data</div>
				) : (
					<div className="h-full grid grid-cols-1 xl:grid-cols-[420px_1fr]">
						{/* Iterations list */}
						<div className="border-r border-indigo-900/30 overflow-auto">
							<div className="p-4 border-b border-indigo-900/30 bg-[#0d1133]/40">
								<div className="text-[10px] uppercase tracking-widest text-cyan-200/60 font-bold">
									Spec
								</div>
								<div className="text-[12px] text-cyan-100 font-mono">
									{detail.run.specSlug} <span className="text-cyan-200/40">·</span> rev{" "}
									{detail.run.specRev}
								</div>
								<div className="text-[10px] text-cyan-200/50 font-mono">
									mode: {detail.run.mode}
								</div>
								{activeChild && (
									<div className="text-[10px] text-cyan-200/50 font-mono">
										active child: {activeChild}
									</div>
								)}
							</div>
							<ul className="divide-y divide-indigo-900/30">
								{iterations.length === 0 ? (
									<li className="p-4 text-xs text-cyan-200/60 font-mono">No iterations yet.</li>
								) : (
									iterations
										.slice()
										.sort((a, b) => b.iterationIndex - a.iterationIndex)
										.map((it) => {
											const selected = it.iterationId === selectedIterId;
											return (
												<li key={it.iterationId}>
													<button
														onClick={() => {
															setSelectedIterId(it.iterationId);
															setTab("stream");
														}}
														className={cn(
															"w-full text-left p-4 hover:bg-indigo-900/20 transition-colors",
															selected && "bg-cyan-400/5 border-l-2 border-cyan-400/40",
														)}
													>
														<div className="flex items-center justify-between gap-2">
															<div className="min-w-0">
																<div className="text-[12px] text-cyan-100 font-mono truncate">
																	#{it.iterationIndex} {it.stepKind}
																</div>
																<div className="text-[10px] text-cyan-200/50 font-mono truncate">
																	{it.runId}
																</div>
															</div>
															<div className="flex items-center gap-2">
																<span className={statusPill(it.status)}>{it.status}</span>
																<ChevronRight className="h-4 w-4 text-cyan-200/40" />
															</div>
														</div>
														{extractReportSummary(it) ? (
															<div className="mt-2 text-[11px] text-cyan-200/70 font-mono line-clamp-2">
																{extractReportSummary(it)}
															</div>
														) : null}
													</button>
												</li>
											);
										})
								)}
							</ul>
						</div>

						{/* Detail pane */}
						<div className="overflow-auto">
							<div className="p-4 border-b border-indigo-900/30 bg-[#0d1133]/40 flex items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<button
										onClick={() => setTab("stream")}
										className={cn(
											"px-3 py-1.5 text-[10px] uppercase tracking-wider border transition-colors",
											tab === "stream"
												? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
												: "border-indigo-700/50 hover:bg-indigo-900/30 text-cyan-200",
										)}
									>
										Stream
									</button>
									<button
										onClick={() => setTab("child-runs")}
										className={cn(
											"px-3 py-1.5 text-[10px] uppercase tracking-wider border transition-colors",
											tab === "child-runs"
												? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
												: "border-indigo-700/50 hover:bg-indigo-900/30 text-cyan-200",
										)}
									>
										Child Runs
									</button>
								</div>
							</div>

							{tab === "stream" ? (
								<div className="p-4 space-y-3">
									{selectedIter ? (
										<div className="border border-indigo-900/40 bg-[#0d1133]/50 p-4">
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<div className="text-[12px] text-cyan-100 font-mono">
														Iteration #{selectedIter.iterationIndex} {selectedIter.stepKind}
													</div>
													<div className="text-[10px] text-cyan-200/50 font-mono break-all">
														runId: {selectedIter.runId}
													</div>
													{selectedIter.sessionId ? (
														<div className="text-[10px] text-cyan-200/50 font-mono break-all">
															sessionId: {selectedIter.sessionId}
														</div>
													) : null}
													<div className="text-[10px] text-cyan-200/50 font-mono">
														started: {formatTs(selectedIter.createdAt)}
													</div>
													{selectedIter.completedAt ? (
														<div className="text-[10px] text-cyan-200/50 font-mono">
															completed: {formatTs(selectedIter.completedAt)}
														</div>
													) : null}
												</div>
												<div className="flex flex-col items-end gap-2">
													<span className={statusPill(selectedIter.status)}>
														{selectedIter.status}
													</span>
													{selectedIter.sessionId ? (
														<div className="flex items-center gap-2">
															<button
																onClick={() =>
																	setLocation(`/sessions/${selectedIter.sessionId}/chat`)
																}
																className="px-2 py-1 text-[10px] uppercase tracking-widest border border-indigo-900/40 text-cyan-200/70 hover:text-cyan-200"
															>
																Chat
															</button>
															<button
																onClick={() =>
																	setLocation(`/sessions/${selectedIter.sessionId}/timeline`)
																}
																className="px-2 py-1 text-[10px] uppercase tracking-widest border border-indigo-900/40 text-cyan-200/70 hover:text-cyan-200"
															>
																Timeline
															</button>
														</div>
													) : null}
												</div>
											</div>
											{extractReportSummary(selectedIter) ? (
												<div className="mt-3 text-[11px] text-cyan-200/80 font-mono whitespace-pre-wrap">
													{extractReportSummary(selectedIter)}
												</div>
											) : null}
										</div>
									) : (
										<div className="text-xs text-cyan-200/60 font-mono">Select an iteration.</div>
									)}
									<div className="border border-indigo-900/40 bg-[#0d1133]/50">
										<SessionStreamPanel
											sessionId={selectedIter?.sessionId ?? null}
											runId={selectedIter?.runId ?? null}
											isOpen={true}
											showToggle={false}
											fill={true}
											className="rounded-none border-0"
										/>
									</div>
								</div>
							) : (
								<div className="p-4">
									<div className="border border-indigo-900/40 bg-[#0d1133]/50">
										<div className="p-4 text-xs text-cyan-200/70 font-mono">
											{childRuns?.runs?.length ?? 0} child runs
										</div>
										<ul className="divide-y divide-indigo-900/30">
											{(childRuns?.runs ?? []).map((r: RunSummary) => (
												<li key={r.runId} className="p-4">
													<div className="flex items-center justify-between gap-3">
														<div className="min-w-0">
															<div className="text-[12px] text-cyan-100 font-mono truncate">
																{r.kind ?? "run"}
																{r.roleName ? ` · ${r.roleName}` : ""}
															</div>
															<div className="text-[10px] text-cyan-200/50 font-mono break-all">
																runId: {r.runId}
															</div>
															{r.sessionId ? (
																<div className="text-[10px] text-cyan-200/50 font-mono break-all">
																	sessionId: {r.sessionId}
																</div>
															) : null}
															<div className="text-[10px] text-cyan-200/50 font-mono">
																{formatTs(r.createdAt)}
															</div>
														</div>
														<div className="flex items-center gap-2">
															<span className={statusPill(r.status)}>{r.status}</span>
															{r.sessionId ? (
																<button
																	onClick={() => setLocation(`/sessions/${r.sessionId}/chat`)}
																	className="px-2 py-1 text-[10px] uppercase tracking-widest border border-indigo-900/40 text-cyan-200/70 hover:text-cyan-200"
																>
																	Open
																</button>
															) : null}
														</div>
													</div>
													{r.inputPreview ? (
														<div className="mt-2 text-[11px] text-cyan-200/60 font-mono whitespace-pre-wrap line-clamp-3">
															{r.inputPreview}
														</div>
													) : null}
												</li>
											))}
										</ul>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function statusPill(status: string): string {
	const base = "text-[10px] font-mono px-2 py-0.5 border";
	if (status === "running" || status === "queued")
		return cn(base, "border-cyan-400/40 text-cyan-200 bg-cyan-400/10");
	if (status === "paused" || status === "pausing")
		return cn(base, "border-amber-400/40 text-amber-200 bg-amber-400/10");
	if (status === "failed") return cn(base, "border-rose-400/40 text-rose-200 bg-rose-400/10");
	if (status === "completed")
		return cn(base, "border-emerald-400/40 text-emerald-200 bg-emerald-400/10");
	return cn(base, "border-indigo-700/40 text-cyan-200/70 bg-indigo-900/20");
}
