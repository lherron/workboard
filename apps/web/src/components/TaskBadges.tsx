import { cn } from "@/lib/utils";
import type { TaskDetail, TaskListItem } from "@workboard/shared";

type TaskState = TaskListItem["state"] | TaskDetail["state"];

export function StatePill({ state }: { state: TaskState }) {
	const config: Record<TaskState, { color: string; label: string; symbol: string }> = {
		idea: { color: "text-cyan-300", label: "idea", symbol: "✧" },
		draft: { color: "text-fuchsia-300", label: "draft", symbol: "◇" },
		open: { color: "text-primary", label: "open", symbol: "○" },
		in_progress: { color: "text-accent", label: "active", symbol: "◐" },
		blocked: { color: "text-destructive", label: "blocked", symbol: "⊘" },
		completed: { color: "text-muted-foreground", label: "done", symbol: "●" },
		cancelled: { color: "text-muted-foreground/60", label: "cancelled", symbol: "✕" },
		archived: { color: "text-muted-foreground/50", label: "archived", symbol: "◌" },
		deleted: { color: "text-red-400/60", label: "deleted", symbol: "⌫" },
	};

	const { color, label, symbol } = config[state];

	return (
		<span className={cn("inline-flex items-center gap-1.5 text-[11px] tracking-wide", color)}>
			<span className="text-[10px]">{symbol}</span>
			<span>{label}</span>
		</span>
	);
}

export function PriorityBadge({ priority }: { priority: number }) {
	// Visual hierarchy: p1 gray-green, gradual fade through p4 very subtle
	const configs = [
		{ color: "text-foreground/90", symbol: "▬", weight: "font-medium" }, // p1: gray-green
		{ color: "text-muted-foreground", symbol: "▬", weight: "font-normal" }, // p2: muted gray
		{ color: "text-muted-foreground/70", symbol: "─", weight: "font-normal" }, // p3: subtle
		{ color: "text-muted-foreground/50", symbol: "─", weight: "font-normal" }, // p4: very subtle
	];

	const index = Math.min(Math.max(priority - 1, 0), configs.length - 1);
	const { color, symbol, weight } = configs[index];

	return (
		<span
			className={cn("inline-flex items-center gap-1.5 text-[11px] tracking-wide", color, weight)}
		>
			<span className="text-[12px]">{symbol}</span>
			<span>p{priority}</span>
		</span>
	);
}

export function TriagedBadge({ triagedAt }: { triagedAt?: string | null }) {
	if (!triagedAt) return null;

	return (
		<span className="inline-flex items-center gap-1.5 text-[11px] tracking-wide text-primary">
			<span className="text-[10px]">●</span>
			<span>triaged</span>
		</span>
	);
}
