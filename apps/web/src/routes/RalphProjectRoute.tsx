import {
	type ApiClientError,
	type ProjectRosterMember,
	type RalphConfigV1,
	type RalphPreflightResponse,
	type RalphProjectConfigRecord,
	type RalphRunRecord,
	fetchProjectRoster,
	fetchRalphConfig,
	fetchRalphPreflight,
	fetchRalphRuns,
	fetchWorkspaceSpecs,
	resetRalphConfig,
	startRalphRun,
	updateRalphConfig,
} from "@/api/client";
import { cn } from "@/lib/utils";
import type { SpecManifest } from "@workboard/shared";
import { ChevronRight, Loader2, Play, RotateCcw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";

type RalphProjectData = {
	config: RalphProjectConfigRecord | null;
	runs: RalphRunRecord[];
	specs: SpecManifest[];
	roster: ProjectRosterMember[];
	loading: boolean;
	error: string | null;
};

type StartRunDialogState = {
	open: boolean;
	specSlug: string;
	mode: "auto" | "plan" | "build";
};

export function RalphProjectRoute() {
	const { projectId } = useParams<{ projectId: string }>();
	const [, setLocation] = useLocation();

	const [tab, setTab] = useState<"runs" | "config">("runs");
	const [data, setData] = useState<RalphProjectData>({
		config: null,
		runs: [],
		specs: [],
		roster: [],
		loading: true,
		error: null,
	});
	const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(null);
	const [dialog, setDialog] = useState<StartRunDialogState>({
		open: false,
		specSlug: "",
		mode: "auto",
	});
	const [preflight, setPreflight] = useState<RalphPreflightResponse | null>(null);

	const rosterRoleNames = useMemo(() => {
		const set = new Set<string>();
		for (const m of data.roster) set.add(m.roleName);
		return [...set].sort();
	}, [data.roster]);

	const refresh = useCallback(
		async (signal?: AbortSignal) => {
			if (!projectId) return;
			setData((prev) => ({ ...prev, loading: true, error: null }));
			try {
				const [cfg, runs, specs, roster, preflightResult] = await Promise.all([
					fetchRalphConfig(projectId, signal),
					fetchRalphRuns(projectId, { limit: 50 }, signal),
					fetchWorkspaceSpecs(projectId, signal).catch(() => ({ specs: [] })),
					fetchProjectRoster(projectId, signal).catch((err) => {
						if ((err as ApiClientError).status === 404) return { roster: null } as { roster: null };
						throw err;
					}),
					fetchRalphPreflight(projectId).catch(() => null),
				]);
				setPreflight(preflightResult);

				const rosterMembers = roster?.roster?.members ?? [];
				setData({
					config: cfg,
					runs: runs.runs,
					specs: specs.specs ?? [],
					roster: rosterMembers,
					loading: false,
					error: null,
				});
				if (!dialog.specSlug && (specs.specs?.length ?? 0) > 0) {
					setDialog((d) => ({ ...d, specSlug: specs.specs![0].slug }));
				}
			} catch (err) {
				if ((err as Error).name === "AbortError") return;
				setData((prev) => ({
					...prev,
					loading: false,
					error: (err as Error).message || "Failed to load Ralph",
				}));
			}
		},
		[projectId, dialog.specSlug],
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

	const activeRun = useMemo(() => {
		return data.runs.find((r) =>
			["queued", "running", "pausing", "paused", "cancelling"].includes(r.status),
		);
	}, [data.runs]);

	const openStartDialog = useCallback(() => {
		setDialog((d) => ({ ...d, open: true }));
	}, []);

	const handleStartRun = useCallback(async () => {
		if (!projectId) return;
		if (!dialog.specSlug) {
			setToast({ kind: "error", msg: "Choose a spec" });
			return;
		}
		try {
			const created = await startRalphRun(projectId, {
				specSlug: dialog.specSlug,
				mode: dialog.mode,
			});
			setDialog((d) => ({ ...d, open: false }));
			setLocation(`/projects/${projectId}/ralph/runs/${created.rootRunId}`);
		} catch (err) {
			const e = err as ApiClientError;
			const payload = e.details as { active?: { rootRunId?: string } } | undefined;
			if (e.status === 409 && payload?.active?.rootRunId) {
				setToast({ kind: "error", msg: "An active Ralph run already exists — opening it" });
				setDialog((d) => ({ ...d, open: false }));
				setLocation(`/projects/${projectId}/ralph/runs/${payload.active.rootRunId}`);
				return;
			}
			setToast({ kind: "error", msg: e.message || "Failed to start run" });
		}
	}, [projectId, dialog, setLocation]);

	if (!projectId) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-sm text-muted-foreground">No project specified</p>
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
				<div className="px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Link
							href={`/projects/${projectId}`}
							className="px-3 py-1.5 text-[10px] uppercase tracking-wider border border-indigo-700/50 hover:bg-indigo-900/30 transition-colors text-cyan-200 rounded"
						>
							Back
						</Link>
						<div className="h-8 w-px bg-indigo-700/50" />
						<div>
							<div className="text-[14px] font-bold tracking-wide uppercase text-cyan-100">
								{projectId} / Ralph
							</div>
							<div className="text-[11px] text-cyan-400/60 font-mono">
								{activeRun
									? `active: ${activeRun.specSlug} (${activeRun.status})`
									: "no active run"}
							</div>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<button
							onClick={() => setTab("runs")}
							className={cn(
								"px-3 py-1.5 text-[10px] uppercase tracking-wider border transition-colors",
								tab === "runs"
									? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
									: "border-indigo-700/50 hover:bg-indigo-900/30 text-cyan-200",
							)}
						>
							Runs
						</button>
						<button
							onClick={() => setTab("config")}
							className={cn(
								"px-3 py-1.5 text-[10px] uppercase tracking-wider border transition-colors",
								tab === "config"
									? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
									: "border-indigo-700/50 hover:bg-indigo-900/30 text-cyan-200",
							)}
						>
							Config
						</button>
						<button
							onClick={openStartDialog}
							disabled={preflight !== null && !preflight.ready}
							className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider border border-cyan-400/40 bg-cyan-400/10 hover:bg-cyan-400/15 transition-colors text-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed"
							title={preflight && !preflight.ready ? "Fix preflight checks first" : undefined}
						>
							<Play className="h-3 w-3" />
							Start
						</button>
					</div>
				</div>
			</header>

			{preflight && !preflight.ready && (
				<div className="mx-6 mt-4 border border-amber-500/40 bg-amber-500/5">
					<div className="px-4 py-3 border-b border-amber-500/20 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
							<span className="text-[11px] uppercase tracking-wider text-amber-200 font-medium">
								Preflight Checks Failed
							</span>
						</div>
						<span className="text-[10px] text-amber-200/60">
							{preflight.checks.filter((c) => c.status === "fail").length} failing,{" "}
							{preflight.checks.filter((c) => c.status === "warn").length} warnings
						</span>
					</div>
					<div className="p-4 space-y-2">
						{preflight.checks
							.filter((c) => c.status !== "pass")
							.map((check) => (
								<div
									key={check.id}
									className={cn(
										"flex items-start gap-3 px-3 py-2 text-xs font-mono",
										check.status === "fail"
											? "bg-rose-500/10 border-l-2 border-rose-400"
											: "bg-amber-500/10 border-l-2 border-amber-400",
									)}
								>
									<div className="flex-1">
										<div
											className={cn(
												"font-medium",
												check.status === "fail" ? "text-rose-200" : "text-amber-200",
											)}
										>
											{check.label}
										</div>
										{check.message && (
											<div className="text-cyan-200/60 mt-0.5">{check.message}</div>
										)}
										{check.fix && (
											<div className="text-cyan-200/40 mt-1 text-[10px]">
												Fix: {check.fix.method ?? "POST"} {check.fix.endpoint}
											</div>
										)}
									</div>
									<span
										className={cn(
											"px-1.5 py-0.5 text-[9px] uppercase",
											check.status === "fail"
												? "bg-rose-500/20 text-rose-300"
												: "bg-amber-500/20 text-amber-300",
										)}
									>
										{check.status}
									</span>
								</div>
							))}
					</div>
				</div>
			)}

			<div className="flex-1 overflow-auto p-6">
				{data.loading ? (
					<div className="flex items-center gap-2 text-xs text-cyan-200/70 font-mono">
						<Loader2 className="h-4 w-4 animate-spin" /> loading...
					</div>
				) : data.error ? (
					<div className="text-sm text-rose-200 font-mono">{data.error}</div>
				) : tab === "runs" ? (
					<div className="max-w-4xl space-y-4">
						<div className="text-[10px] uppercase tracking-widest text-cyan-400/70 font-bold">
							Recent runs
						</div>
						<div className="border border-indigo-900/40 bg-[#0d1133]/50">
							{data.runs.length === 0 ? (
								<div className="p-4 text-xs text-cyan-200/60 font-mono">No runs yet.</div>
							) : (
								<ul className="divide-y divide-indigo-900/30">
									{data.runs.map((r) => (
										<li key={r.rootRunId}>
											<Link
												href={`/projects/${projectId}/ralph/runs/${r.rootRunId}`}
												className="block p-4 hover:bg-indigo-900/20 transition-colors"
											>
												<div className="flex items-center justify-between gap-3">
													<div className="min-w-0">
														<div className="text-[12px] text-cyan-100 font-mono truncate">
															{r.specSlug} <span className="text-cyan-200/40">·</span> {r.mode}
														</div>
														<div className="text-[10px] text-cyan-200/50 font-mono truncate">
															{r.rootRunId}
														</div>
													</div>
													<div className="flex items-center gap-2">
														<span className={statusPill(r.status)}>{r.status}</span>
														<ChevronRight className="h-4 w-4 text-cyan-200/50" />
													</div>
												</div>
											</Link>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>
				) : (
					<div className="max-w-4xl space-y-4">
						{data.config ? (
							<RalphConfigEditor
								projectId={projectId}
								record={data.config}
								rosterRoleNames={rosterRoleNames}
								onSaved={(next) => {
									setData((d) => ({ ...d, config: next }));
									setToast({ kind: "success", msg: "Saved" });
								}}
								onReset={(next) => {
									setData((d) => ({ ...d, config: next }));
									setToast({ kind: "success", msg: "Reset" });
								}}
								onError={(msg) => setToast({ kind: "error", msg })}
							/>
						) : (
							<div className="text-xs text-cyan-200/60 font-mono">No config</div>
						)}
					</div>
				)}
			</div>

			{dialog.open && (
				<StartRalphRunDialog
					specs={data.specs}
					specSlug={dialog.specSlug}
					mode={dialog.mode}
					onChange={(patch) => setDialog((d) => ({ ...d, ...patch }))}
					onCancel={() => setDialog((d) => ({ ...d, open: false }))}
					onConfirm={handleStartRun}
				/>
			)}
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

function StartRalphRunDialog({
	specs,
	specSlug,
	mode,
	onChange,
	onCancel,
	onConfirm,
}: {
	specs: SpecManifest[];
	specSlug: string;
	mode: "auto" | "plan" | "build";
	onChange: (patch: Partial<StartRunDialogState>) => void;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[3px]">
			<div className="w-full max-w-md border border-indigo-900/40 bg-[#0d1133] font-mono">
				<div className="flex items-center justify-between border-b border-indigo-900/30 px-4 py-3">
					<div className="text-[12px] uppercase tracking-widest text-cyan-200">Start Ralph run</div>
					<button onClick={onCancel} className="text-[10px] text-cyan-200/60 hover:text-cyan-200">
						esc
					</button>
				</div>
				<div className="p-4 space-y-4">
					<div>
						<div className="text-[10px] uppercase tracking-widest text-cyan-200/60 mb-1">Spec</div>
						<select
							value={specSlug}
							onChange={(e) => onChange({ specSlug: e.target.value })}
							className="w-full px-2 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs"
						>
							{specs.length === 0 ? (
								<option value="">(no specs found)</option>
							) : (
								specs
									.slice()
									.sort((a, b) => b.updatedAt - a.updatedAt)
									.map((s) => (
										<option key={s.slug} value={s.slug}>
											{s.title} ({s.slug})
										</option>
									))
							)}
						</select>
					</div>
					<div>
						<div className="text-[10px] uppercase tracking-widest text-cyan-200/60 mb-1">Mode</div>
						<div className="grid grid-cols-3 gap-2">
							{(["auto", "plan", "build"] as const).map((m) => (
								<button
									key={m}
									onClick={() => onChange({ mode: m })}
									className={cn(
										"px-2 py-2 border text-[11px] uppercase tracking-widest",
										mode === m
											? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
											: "border-indigo-900/40 text-cyan-200/70 hover:bg-indigo-900/20",
									)}
								>
									{m}
								</button>
							))}
						</div>
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<button
							onClick={onCancel}
							className="px-3 py-2 text-[11px] border border-indigo-900/40 text-cyan-200/70 hover:text-cyan-200"
						>
							Cancel
						</button>
						<button
							onClick={onConfirm}
							className="px-3 py-2 text-[11px] border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15"
						>
							Start
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function RalphConfigEditor({
	projectId,
	record,
	rosterRoleNames,
	onSaved,
	onReset,
	onError,
}: {
	projectId: string;
	record: RalphProjectConfigRecord;
	rosterRoleNames: string[];
	onSaved: (next: RalphProjectConfigRecord) => void;
	onReset: (next: RalphProjectConfigRecord) => void;
	onError: (msg: string) => void;
}) {
	const [draft, setDraft] = useState<RalphConfigV1>(record.config);
	const [dirty, setDirty] = useState(false);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		setDraft(record.config);
		setDirty(false);
	}, [record.config]);

	const save = useCallback(async () => {
		setSaving(true);
		try {
			const updated = await updateRalphConfig(projectId, record.rev, draft);
			onSaved(updated);
			setDirty(false);
		} catch (err) {
			onError((err as ApiClientError).message || "Failed to save");
		} finally {
			setSaving(false);
		}
	}, [projectId, record.rev, draft, onSaved, onError]);

	const reset = useCallback(async () => {
		setSaving(true);
		try {
			const updated = await resetRalphConfig(projectId);
			onReset(updated);
			setDirty(false);
		} catch (err) {
			onError((err as ApiClientError).message || "Failed to reset");
		} finally {
			setSaving(false);
		}
	}, [projectId, onReset, onError]);

	const update = (patch: Partial<RalphConfigV1>) => {
		setDraft((d) => ({ ...d, ...patch }));
		setDirty(true);
	};

	const updateNested = (path: string, value: unknown) => {
		setDraft((d) => {
			// biome-ignore lint/suspicious/noExplicitAny: Required for dynamic nested path assignment
			const next: any = structuredClone(d);
			const parts = path.split(".");
			let cur = next;
			for (let i = 0; i < parts.length - 1; i++) {
				cur[parts[i]] ??= {};
				cur = cur[parts[i]];
			}
			cur[parts[parts.length - 1]] = value;
			return next;
		});
		setDirty(true);
	};

	return (
		<div className="border border-indigo-900/40 bg-[#0d1133]/50">
			<div className="flex items-center justify-between px-4 py-3 border-b border-indigo-900/30">
				<div>
					<div className="text-[12px] uppercase tracking-widest text-cyan-200">Configuration</div>
					<div className="text-[10px] text-cyan-200/50 font-mono">rev {record.rev}</div>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={reset}
						disabled={saving}
						className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider border border-indigo-900/40 text-cyan-200/70 hover:text-cyan-200 disabled:opacity-50"
					>
						<RotateCcw className="h-3 w-3" /> Reset
					</button>
					<button
						onClick={save}
						disabled={!dirty || saving}
						className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15 disabled:opacity-50"
					>
						{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
						Save
					</button>
				</div>
			</div>

			<datalist id="ralph-roles">
				{rosterRoleNames.map((r) => (
					<option key={r} value={r} />
				))}
			</datalist>

			<div className="p-5 space-y-6">
				{/* Section: Core */}
				<section className="space-y-4">
					<div className="flex items-center gap-3">
						<div className="h-px flex-1 bg-gradient-to-r from-cyan-500/50 to-transparent" />
						<h3 className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-medium">
							Core
						</h3>
						<div className="h-px flex-1 bg-gradient-to-l from-cyan-500/50 to-transparent" />
					</div>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<label className="flex items-center gap-3 px-3 py-2.5 bg-black/20 border border-indigo-900/30 cursor-pointer hover:border-cyan-500/30 transition-colors">
							<input
								type="checkbox"
								checked={draft.enabled}
								onChange={(e) => update({ enabled: e.target.checked })}
								className="w-4 h-4 accent-cyan-500"
							/>
							<span className="text-xs text-cyan-100">Enabled</span>
						</label>
						<div>
							<div className="text-[10px] uppercase tracking-wider text-cyan-200/50 mb-1.5">
								Session Policy
							</div>
							<select
								value={draft.sessionPolicy}
								onChange={(e) =>
									update({ sessionPolicy: e.target.value as "resume-or-new" | "new" })
								}
								className="w-full px-3 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs focus:border-cyan-500/50 focus:outline-none transition-colors"
							>
								<option value="resume-or-new">resume-or-new</option>
								<option value="new">new</option>
							</select>
						</div>
						<div>
							<div className="text-[10px] uppercase tracking-wider text-cyan-200/50 mb-1.5">
								Tick Interval (ms)
							</div>
							<input
								type="number"
								value={draft.tickIntervalMs}
								onChange={(e) => update({ tickIntervalMs: Number(e.target.value) })}
								className="w-full px-3 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs focus:border-cyan-500/50 focus:outline-none transition-colors"
							/>
						</div>
					</div>
				</section>

				{/* Section: Agent Roles */}
				<section className="space-y-4">
					<div className="flex items-center gap-3">
						<div className="h-px flex-1 bg-gradient-to-r from-violet-500/50 to-transparent" />
						<h3 className="text-[11px] uppercase tracking-[0.2em] text-violet-300 font-medium">
							Agent Roles
						</h3>
						<div className="h-px flex-1 bg-gradient-to-l from-violet-500/50 to-transparent" />
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<div className="text-[10px] uppercase tracking-wider text-cyan-200/50 mb-1.5">
								Planner Role
							</div>
							<input
								list="ralph-roles"
								value={draft.plannerRoleName}
								onChange={(e) => update({ plannerRoleName: e.target.value })}
								className="w-full px-3 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs focus:border-cyan-500/50 focus:outline-none transition-colors"
								placeholder="e.g. ralph-planner"
							/>
						</div>
						<div>
							<div className="text-[10px] uppercase tracking-wider text-cyan-200/50 mb-1.5">
								Builder Role
							</div>
							<input
								list="ralph-roles"
								value={draft.builderRoleName}
								onChange={(e) => update({ builderRoleName: e.target.value })}
								className="w-full px-3 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs focus:border-cyan-500/50 focus:outline-none transition-colors"
								placeholder="e.g. ralph-builder"
							/>
						</div>
					</div>
				</section>

				{/* Section: Iteration Limits */}
				<section className="space-y-4">
					<div className="flex items-center gap-3">
						<div className="h-px flex-1 bg-gradient-to-r from-amber-500/50 to-transparent" />
						<h3 className="text-[11px] uppercase tracking-[0.2em] text-amber-300 font-medium">
							Iteration Limits
						</h3>
						<div className="h-px flex-1 bg-gradient-to-l from-amber-500/50 to-transparent" />
					</div>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div>
							<div className="text-[10px] uppercase tracking-wider text-cyan-200/50 mb-1.5">
								Max Plan Iterations
							</div>
							<input
								type="number"
								min="0"
								value={draft.maxPlanIterations}
								onChange={(e) => update({ maxPlanIterations: Number(e.target.value) })}
								className="w-full px-3 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs focus:border-cyan-500/50 focus:outline-none transition-colors"
							/>
						</div>
						<div>
							<div className="text-[10px] uppercase tracking-wider text-cyan-200/50 mb-1.5">
								Max Build Iterations
							</div>
							<input
								type="number"
								min="0"
								value={draft.maxBuildIterations}
								onChange={(e) => update({ maxBuildIterations: Number(e.target.value) })}
								className="w-full px-3 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs focus:border-cyan-500/50 focus:outline-none transition-colors"
							/>
						</div>
						<div>
							<div className="text-[10px] uppercase tracking-wider text-cyan-200/50 mb-1.5">
								Max Consecutive Failures
							</div>
							<input
								type="number"
								min="1"
								value={draft.maxConsecutiveFailures}
								onChange={(e) => update({ maxConsecutiveFailures: Number(e.target.value) })}
								className="w-full px-3 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs focus:border-cyan-500/50 focus:outline-none transition-colors"
							/>
						</div>
					</div>
					<p className="text-[10px] text-amber-200/40 italic">
						Set to 0 to skip that phase entirely
					</p>
				</section>

				{/* Section: Specs & Artifacts */}
				<section className="space-y-4">
					<div className="flex items-center gap-3">
						<div className="h-px flex-1 bg-gradient-to-r from-emerald-500/50 to-transparent" />
						<h3 className="text-[11px] uppercase tracking-[0.2em] text-emerald-300 font-medium">
							Specs & Artifacts
						</h3>
						<div className="h-px flex-1 bg-gradient-to-l from-emerald-500/50 to-transparent" />
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<label className="flex items-center gap-3 px-3 py-2.5 bg-black/20 border border-indigo-900/30 cursor-pointer hover:border-cyan-500/30 transition-colors">
							<input
								type="checkbox"
								checked={draft.spec.materialize}
								onChange={(e) => updateNested("spec.materialize", e.target.checked)}
								className="w-4 h-4 accent-cyan-500"
							/>
							<span className="text-xs text-cyan-100">Materialize Spec</span>
						</label>
						<div>
							<div className="text-[10px] uppercase tracking-wider text-cyan-200/50 mb-1.5">
								Spec Directory
							</div>
							<input
								value={draft.spec.dir}
								onChange={(e) => updateNested("spec.dir", e.target.value)}
								className="w-full px-3 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs focus:border-cyan-500/50 focus:outline-none transition-colors font-mono"
								placeholder="specs"
							/>
						</div>
						<div>
							<div className="text-[10px] uppercase tracking-wider text-cyan-200/50 mb-1.5">
								Implementation Plan Path
							</div>
							<input
								value={draft.artifacts.implementationPlanPath}
								onChange={(e) => updateNested("artifacts.implementationPlanPath", e.target.value)}
								className="w-full px-3 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs focus:border-cyan-500/50 focus:outline-none transition-colors font-mono"
								placeholder="IMPLEMENTATION_PLAN.md"
							/>
						</div>
						<div>
							<div className="text-[10px] uppercase tracking-wider text-cyan-200/50 mb-1.5">
								Agents MD Path
							</div>
							<input
								value={draft.artifacts.agentsMdPath}
								onChange={(e) => updateNested("artifacts.agentsMdPath", e.target.value)}
								className="w-full px-3 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs focus:border-cyan-500/50 focus:outline-none transition-colors font-mono"
								placeholder="AGENTS.md"
							/>
						</div>
					</div>
				</section>

				{/* Section: Reporting */}
				<section className="space-y-4">
					<div className="flex items-center gap-3">
						<div className="h-px flex-1 bg-gradient-to-r from-rose-500/50 to-transparent" />
						<h3 className="text-[11px] uppercase tracking-[0.2em] text-rose-300 font-medium">
							Reporting
						</h3>
						<div className="h-px flex-1 bg-gradient-to-l from-rose-500/50 to-transparent" />
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<div className="text-[10px] uppercase tracking-wider text-cyan-200/50 mb-1.5">
								Report Tag
							</div>
							<input
								value={draft.report.tag}
								onChange={(e) => updateNested("report.tag", e.target.value)}
								className="w-full px-3 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs focus:border-cyan-500/50 focus:outline-none transition-colors font-mono"
								placeholder="RALPH_REPORT"
							/>
						</div>
					</div>
				</section>

				{/* Section: Prompts */}
				<section className="space-y-4">
					<div className="flex items-center gap-3">
						<div className="h-px flex-1 bg-gradient-to-r from-sky-500/50 to-transparent" />
						<h3 className="text-[11px] uppercase tracking-[0.2em] text-sky-300 font-medium">
							Prompts
						</h3>
						<div className="h-px flex-1 bg-gradient-to-l from-sky-500/50 to-transparent" />
					</div>
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<div>
							<div className="text-[10px] uppercase tracking-wider text-cyan-200/50 mb-1.5">
								Plan Prompt
							</div>
							<textarea
								value={draft.prompts.plan}
								onChange={(e) => updateNested("prompts.plan", e.target.value)}
								rows={12}
								className="w-full px-3 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs font-mono focus:border-cyan-500/50 focus:outline-none transition-colors resize-y"
							/>
						</div>
						<div>
							<div className="text-[10px] uppercase tracking-wider text-cyan-200/50 mb-1.5">
								Build Prompt
							</div>
							<textarea
								value={draft.prompts.build}
								onChange={(e) => updateNested("prompts.build", e.target.value)}
								rows={12}
								className="w-full px-3 py-2 bg-black/30 border border-indigo-900/40 text-cyan-100 text-xs font-mono focus:border-cyan-500/50 focus:outline-none transition-colors resize-y"
							/>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
