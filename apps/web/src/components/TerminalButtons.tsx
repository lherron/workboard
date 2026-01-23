import { launchTerminal, startAsyncTriage, startGeminiTriage } from "@/api/client";
import { buildTerminalLaunchRequest, getSessionLaunch } from "@/lib/sessionLaunches";
import { cn } from "@/lib/utils";
import type { TaskDetail } from "@workboard/shared";
import {
	type Ref,
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";

export type TerminalButtonsHandle = {
	openImplementTerminal: () => Promise<void>;
};

type TerminalButtonsProps = {
	workspaceId: string;
	/** Human-readable project name for terminal title (falls back to workspaceId if not provided) */
	workspaceName?: string;
	task: TaskDetail;
	/** Compact mode uses shorter labels */
	compact?: boolean;
	/** Vertical layout for narrow containers (stacks groups, wraps buttons) */
	vertical?: boolean;
	onAsyncTriageComplete?: () => void;
	/** Callback when an error occurs (for external toast display) */
	onError?: (message: string | null) => void;
	/** Callback when a notice should be shown (for external toast display) */
	onNotice?: (message: string | null) => void;
};

// Provider color themes - consistent identity across triage/implement
const providerThemes = {
	claude: {
		bg: "bg-amber-500/10",
		border: "border-amber-500/30",
		text: "text-amber-400",
		hoverBg: "hover:bg-amber-500/20",
		hoverBorder: "hover:border-amber-500/50",
		glow: "hover:shadow-[0_0_12px_-3px_rgba(251,191,36,0.4)]",
	},
	agentsdk: {
		bg: "bg-teal-500/10",
		border: "border-teal-500/30",
		text: "text-teal-400",
		hoverBg: "hover:bg-teal-500/20",
		hoverBorder: "hover:border-teal-500/50",
		glow: "hover:shadow-[0_0_12px_-3px_rgba(45,212,191,0.4)]",
	},
	codex: {
		bg: "bg-violet-500/10",
		border: "border-violet-500/30",
		text: "text-violet-400",
		hoverBg: "hover:bg-violet-500/20",
		hoverBorder: "hover:border-violet-500/50",
		glow: "hover:shadow-[0_0_12px_-3px_rgba(167,139,250,0.4)]",
	},
	gemini: {
		bg: "bg-blue-500/10",
		border: "border-blue-500/30",
		text: "text-blue-400",
		hoverBg: "hover:bg-blue-500/20",
		hoverBorder: "hover:border-blue-500/50",
		glow: "hover:shadow-[0_0_12px_-3px_rgba(96,165,250,0.4)]",
	},
	disabled: {
		bg: "bg-zinc-500/5",
		border: "border-zinc-500/20 border-dashed",
		text: "text-zinc-500",
	},
} as const;

// Provider icons - distinctive per provider
function ClaudeIcon({ className }: { className?: string }) {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={className}>
			<rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
			<path
				d="M4.5 6.5l2 1.5-2 1.5"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path d="M8 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
		</svg>
	);
}

function AgentSDKIcon({ className }: { className?: string }) {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={className}>
			<path
				d="M3 8a5 5 0 1 0 1-3.1"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
			/>
			<path d="M3 3v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
		</svg>
	);
}

function CodexIcon({ className }: { className?: string }) {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={className}>
			<path
				d="M5 4L2 8l3 4"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M11 4l3 4-3 4"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path d="M9 2l-2 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
		</svg>
	);
}

function GeminiIcon({ className }: { className?: string }) {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={className}>
			<path
				d="M8 2L10 6l4 .5-3 3 .5 4L8 11.5 4.5 13.5l.5-4-3-3L6 6l2-4z"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

// Session mode icons for implement button
function ResumeIcon({ className }: { className?: string }) {
	return (
		<svg width="10" height="10" viewBox="0 0 16 16" fill="none" className={className}>
			<path
				d="M2 8a6 6 0 1 0 1.5-4"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
			<path
				d="M2 2v4h4"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function NewSessionIcon({ className }: { className?: string }) {
	return (
		<svg width="10" height="10" viewBox="0 0 16 16" fill="none" className={className}>
			<path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	);
}

// Reusable agent button component
type AgentButtonProps = {
	provider: "claude" | "agentsdk" | "codex" | "gemini";
	label: string;
	onClick?: () => void;
	disabled?: boolean;
	loading?: boolean;
	title?: string;
	isPlaceholder?: boolean;
	/** Session mode indicator for implement buttons */
	sessionMode?: "resume" | "new";
	/** Test ID for automated testing */
	testId?: string;
};

function AgentButton({
	provider,
	label,
	onClick,
	disabled,
	loading,
	title,
	isPlaceholder,
	sessionMode,
	testId,
}: AgentButtonProps) {
	const theme = isPlaceholder ? providerThemes.disabled : providerThemes[provider];
	const Icon = {
		claude: ClaudeIcon,
		agentsdk: AgentSDKIcon,
		codex: CodexIcon,
		gemini: GeminiIcon,
	}[provider];

	return (
		<button
			onClick={onClick}
			disabled={disabled || isPlaceholder}
			title={isPlaceholder ? "Coming soon" : title}
			data-testid={testId}
			className={cn(
				"flex items-center gap-1 px-1.5 py-1 rounded border text-[10px] font-medium transition-all duration-200",
				theme.bg,
				theme.border,
				theme.text,
				!isPlaceholder && "hoverBg" in theme && theme.hoverBg,
				!isPlaceholder && "hoverBorder" in theme && theme.hoverBorder,
				!isPlaceholder && "glow" in theme && theme.glow,
				"disabled:cursor-not-allowed",
				isPlaceholder && "opacity-40",
				!isPlaceholder && disabled && "opacity-50",
				loading && "cursor-wait",
			)}
		>
			{loading ? (
				<div className="w-2.5 h-2.5 border border-current/30 border-t-current rounded-full animate-spin" />
			) : (
				<Icon />
			)}
			<span>{label}</span>
			{/* Session mode indicator */}
			{sessionMode && !loading && !isPlaceholder && (
				<span className="opacity-60">
					{sessionMode === "resume" ? <ResumeIcon /> : <NewSessionIcon />}
				</span>
			)}
		</button>
	);
}

// Group wrapper component
function ButtonGroup({
	label,
	children,
	vertical,
}: { label: string; children: React.ReactNode; vertical?: boolean }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground/40 font-medium pl-0.5">
				{label}
			</span>
			<div className={cn("flex gap-1", vertical ? "flex-wrap" : "items-center")}>{children}</div>
		</div>
	);
}

const isTerminalRunStatus = (status?: string | null) => {
	switch (status) {
		case "completed":
		case "failed":
		case "cancelled":
		case "timed_out":
			return true;
		default:
			return false;
	}
};

// Triage agent types from task metadata
type TriageAgent = "agent-sdk" | "pi" | null;

function getTriageAgent(task: TaskDetail): TriageAgent {
	const meta = task.meta as Record<string, unknown> | null;
	const agent = meta?.triage_agent;
	if (agent === "agent-sdk" || agent === "pi") return agent;
	return null;
}

// Determine if we should resume an existing session
function shouldResumeSession(task: TaskDetail): boolean {
	const triageAgent = getTriageAgent(task);
	// Only resume if explicitly triaged with agent-sdk AND session exists
	return triageAgent === "agent-sdk" && !!task.sdk_session_id;
}

export const TerminalButtons = forwardRef(function TerminalButtons(
	{
		workspaceId,
		task,
		compact: _compact = false,
		vertical = false,
		onAsyncTriageComplete,
		onError,
		onNotice,
	}: TerminalButtonsProps,
	ref: Ref<TerminalButtonsHandle>,
) {
	const [terminalLoading, setTerminalLoading] = useState(false);
	const [codexTriageLoading, setCodexTriageLoading] = useState(false);
	const [implementLoading, setImplementLoading] = useState(false);
	const [codexImplementLoading, setCodexImplementLoading] = useState(false);
	const [asyncTriageLoading, setAsyncTriageLoading] = useState(false);
	const [geminiTriageLoading, setGeminiTriageLoading] = useState(false);
	const lastCompletedRunIdRef = useRef<string | null>(null);

	// Helper to show error with auto-clear
	const showError = useCallback(
		(message: string) => {
			onError?.(message);
			setTimeout(() => onError?.(null), 5000);
		},
		[onError],
	);

	// Helper to show notice with auto-clear
	const showNotice = useCallback(
		(message: string) => {
			onNotice?.(message);
			setTimeout(() => onNotice?.(null), 5000);
		},
		[onNotice],
	);

	useEffect(() => {
		if (!task?.cp_run_id || !isTerminalRunStatus(task.run_status)) return;
		if (lastCompletedRunIdRef.current === task.cp_run_id) return;
		lastCompletedRunIdRef.current = task.cp_run_id;
		onAsyncTriageComplete?.();
	}, [task?.cp_run_id, task?.run_status, onAsyncTriageComplete]);

	// Handle opening terminal for triage
	const handleOpenTerminal = useCallback(async () => {
		if (!task) return;

		setTerminalLoading(true);
		onError?.(null);
		onNotice?.(null);

		try {
			const launch = getSessionLaunch("triage-clod");
			await launchTerminal(
				buildTerminalLaunchRequest(launch, {
					projectId: workspaceId,
					statusbar: { right: `clod@${workspaceId}` },
					task: { id: task.id, slug: task.path, title: task.title },
				}),
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to open terminal";
			showError(message);
		} finally {
			setTerminalLoading(false);
		}
	}, [workspaceId, task, showError, onError, onNotice]);

	// Handle opening terminal for Codex triage
	const handleOpenCodexTerminal = useCallback(async () => {
		if (!task) return;

		setCodexTriageLoading(true);
		onError?.(null);
		onNotice?.(null);

		try {
			const launch = getSessionLaunch("triage-codex");
			await launchTerminal(
				buildTerminalLaunchRequest(launch, {
					projectId: workspaceId,
					statusbar: { center: "codex-triage", right: `codex@${workspaceId}` },
					task: { id: task.id, slug: task.path, title: task.title },
				}),
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to open terminal";
			showError(message);
		} finally {
			setCodexTriageLoading(false);
		}
	}, [workspaceId, task, showError, onError, onNotice]);

	const handleAsyncTriage = useCallback(async () => {
		if (!task) return;

		setAsyncTriageLoading(true);
		onError?.(null);
		onNotice?.(null);

		try {
			await startAsyncTriage(workspaceId, task.id);
			showNotice("Async triage started");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to start async triage";
			showError(message);
		} finally {
			setAsyncTriageLoading(false);
		}
	}, [task, workspaceId, showError, showNotice, onError, onNotice]);

	const handleGeminiTriage = useCallback(async () => {
		if (!task) return;

		setGeminiTriageLoading(true);
		onError?.(null);
		onNotice?.(null);

		try {
			await startGeminiTriage(workspaceId, task.id);
			showNotice("Gemini triage started");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to start Gemini triage";
			showError(message);
		} finally {
			setGeminiTriageLoading(false);
		}
	}, [task, workspaceId, showError, showNotice, onError, onNotice]);

	// Handle opening terminal for implementation
	const handleImplementTerminal = useCallback(async () => {
		if (!task) return;

		setImplementLoading(true);
		onError?.(null);
		onNotice?.(null);

		try {
			// Only resume if explicitly triaged with agent-sdk and session exists
			const canResume = shouldResumeSession(task);
			const launch = getSessionLaunch("implement-clod");
			await launchTerminal(
				buildTerminalLaunchRequest(launch, {
					projectId: workspaceId,
					tool:
						canResume && task.sdk_session_id
							? { resume: { policy: "force", sdkSessionId: task.sdk_session_id } }
							: undefined,
					statusbar: { right: `clod@${workspaceId}` },
					task: { id: task.id, slug: task.path, title: task.title },
				}),
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to open terminal";
			showError(message);
		} finally {
			setImplementLoading(false);
		}
	}, [workspaceId, task, showError, onError, onNotice]);

	// Handle opening terminal for Codex implementation (always new session)
	const handleCodexImplementTerminal = useCallback(async () => {
		if (!task) return;

		setCodexImplementLoading(true);
		onError?.(null);
		onNotice?.(null);

		try {
			const launch = getSessionLaunch("implement-codex");
			await launchTerminal(
				buildTerminalLaunchRequest(launch, {
					projectId: workspaceId,
					statusbar: { center: "codex-impl", right: `codex@${workspaceId}` },
					task: { id: task.id, slug: task.path, title: task.title },
				}),
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to open terminal";
			showError(message);
		} finally {
			setCodexImplementLoading(false);
		}
	}, [workspaceId, task, showError, onError, onNotice]);

	// Expose imperative handle for parent components
	useImperativeHandle(
		ref,
		() => ({
			openImplementTerminal: handleImplementTerminal,
		}),
		[handleImplementTerminal],
	);

	return (
		<div className={cn("flex gap-3", vertical ? "flex-col" : "items-start")}>
			{/* TRIAGE_OPS Group */}
			<ButtonGroup label="triage" vertical={vertical}>
				<AgentButton
					provider="claude"
					label="Claude"
					onClick={handleOpenTerminal}
					disabled={!task}
					loading={terminalLoading}
					title="Triage in terminal"
					testId="open-terminal-button"
				/>
				<AgentButton
					provider="agentsdk"
					label="Agent SDK"
					onClick={handleAsyncTriage}
					disabled={!task}
					loading={asyncTriageLoading}
					title="Start async triage run"
				/>
				<AgentButton
					provider="codex"
					label="Codex"
					onClick={handleOpenCodexTerminal}
					disabled={!task}
					loading={codexTriageLoading}
					title="Codex triage"
				/>
				<AgentButton
					provider="gemini"
					label="Gemini"
					onClick={handleGeminiTriage}
					disabled={!task}
					loading={geminiTriageLoading}
					title="Start Gemini triage run"
				/>
			</ButtonGroup>

			{/* Separator - horizontal line for vertical layout, vertical line for horizontal */}
			{vertical ? (
				<div className="border-t border-border/20" />
			) : (
				<div className="self-stretch flex items-center pt-4">
					<div className="w-px h-5 bg-border/30" />
				</div>
			)}

			{/* IMPL_OPS Group */}
			<ButtonGroup label="implement" vertical={vertical}>
				<AgentButton
					provider="claude"
					label="Claude"
					onClick={handleImplementTerminal}
					disabled={!task}
					loading={implementLoading}
					title={
						shouldResumeSession(task)
							? "Resume implementation session"
							: "Start new implementation session"
					}
					sessionMode={shouldResumeSession(task) ? "resume" : "new"}
				/>
				<AgentButton provider="agentsdk" label="Agent SDK" isPlaceholder />
				<AgentButton
					provider="codex"
					label="Codex"
					onClick={handleCodexImplementTerminal}
					disabled={!task}
					loading={codexImplementLoading}
					title="Start Codex implementation session"
					sessionMode="new"
				/>
				<AgentButton provider="gemini" label="Gemini" isPlaceholder />
			</ButtonGroup>
		</div>
	);
});
