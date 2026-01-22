import { formatTaskPath } from "@/lib/taskPaths";
import { cn } from "@/lib/utils";
import type { TaskDetail } from "@webwrkq/shared";
import { useMemo, useState } from "react";

type ClaudeActionButtonProps = {
	command: string;
	icon: React.ReactNode;
	prompt: string;
};

export function ClaudeActionButton({ command, icon, prompt }: ClaudeActionButtonProps) {
	const [state, setState] = useState<"idle" | "copied" | "error">("idle");

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(prompt);
			setState("copied");
			setTimeout(() => setState("idle"), 2000);
		} catch {
			setState("error");
			setTimeout(() => setState("idle"), 2000);
		}
	};

	return (
		<button
			onClick={handleCopy}
			className={cn(
				"group relative flex items-center gap-2 px-3 py-1.5 rounded-sm transition-all duration-200",
				"border border-border/40 hover:border-primary/50",
				"bg-gradient-to-b from-muted/30 to-transparent",
				"hover:from-primary/10 hover:to-transparent",
				"hover:shadow-[0_0_12px_-3px_hsl(var(--primary)/0.3)]",
				state === "copied" && "border-primary/60 from-primary/15",
			)}
		>
			{/* Glow effect */}
			<span
				className={cn(
					"absolute inset-0 rounded-sm opacity-0 transition-opacity duration-300",
					"bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5",
					"group-hover:opacity-100",
				)}
			/>

			{/* Icon */}
			<span
				className={cn(
					"relative text-muted-foreground/60 transition-colors duration-200",
					"group-hover:text-primary",
					state === "copied" && "text-primary",
				)}
			>
				{icon}
			</span>

			{/* Command text */}
			<span
				className={cn(
					"relative text-[11px] font-mono tracking-wide transition-colors duration-200",
					"text-muted-foreground group-hover:text-foreground",
					state === "copied" && "text-primary",
				)}
			>
				{state === "copied" ? "✓ copied" : state === "error" ? "✗ failed" : command}
			</span>

			{/* Keyboard hint */}
			<span
				className={cn(
					"relative text-[9px] font-mono text-muted-foreground/30 transition-opacity",
					"group-hover:text-muted-foreground/50",
					state !== "idle" && "opacity-0",
				)}
			>
				→
			</span>
		</button>
	);
}

type ClaudeActionsProps = {
	task: TaskDetail;
	/** Compact mode for modal headers - hides label */
	compact?: boolean;
};

export function ClaudeActions({ task, compact = false }: ClaudeActionsProps) {
	const planPrompt = useMemo(() => {
		const lines = [
			`Plan implementation for task ${task.id}: "${task.title}"`,
			"",
			`Path: ${formatTaskPath(task.project.path, task.slug)}`,
			task.priority <= 2 ? `Priority: ${task.priority} (high)` : "",
			task.labels.length > 0 ? `Labels: ${task.labels.join(", ")}` : "",
			"",
			"Task description:",
			"---",
			task.description || "(no description)",
			"---",
			"",
			"Please analyze this task and create a detailed implementation plan. Consider:",
			"1. What files need to be modified or created",
			"2. Dependencies and prerequisites",
			"3. Potential edge cases or risks",
			"4. Testing strategy",
			"",
			"Use the TodoWrite tool to break this into actionable steps.",
		].filter(Boolean);
		return lines.join("\n");
	}, [task]);

	const implementPrompt = useMemo(() => {
		const lines = [
			`Implement task ${task.id}: "${task.title}"`,
			"",
			`Path: ${formatTaskPath(task.project.path, task.slug)}`,
			task.priority <= 2 ? `Priority: ${task.priority} (high)` : "",
			task.labels.length > 0 ? `Labels: ${task.labels.join(", ")}` : "",
			"",
			"Task description:",
			"---",
			task.description || "(no description)",
			"---",
			"",
			"Please implement this task. When complete:",
			`1. Mark the task as complete: wrkq set ${task.id} --state completed`,
			`2. Add a summary comment: wrkq comment add ${task.id} -m "Completed: <summary>"`,
		].filter(Boolean);
		return lines.join("\n");
	}, [task]);

	return (
		<div className="flex items-center gap-2">
			{!compact && (
				<span className="text-[9px] uppercase tracking-widest text-muted-foreground/30 font-mono mr-1">
					claude:
				</span>
			)}
			<ClaudeActionButton
				command="--plan"
				icon={
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
						<polyline points="14 2 14 8 20 8" />
						<line x1="16" y1="13" x2="8" y2="13" />
						<line x1="16" y1="17" x2="8" y2="17" />
						<polyline points="10 9 9 9 8 9" />
					</svg>
				}
				prompt={planPrompt}
			/>
			<ClaudeActionButton
				command="--implement"
				icon={
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<polyline points="16 18 22 12 16 6" />
						<polyline points="8 6 2 12 8 18" />
					</svg>
				}
				prompt={implementPrompt}
			/>
		</div>
	);
}
