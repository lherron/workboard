import { cn } from "@/lib/utils";
import type { TaskRunStatus } from "@webwrkq/shared";

type RunStatusBadgeProps = {
	status: TaskRunStatus | null | undefined;
	variant?: "default" | "compact";
	className?: string;
};

// Run status styling configuration
const runStatusConfig: Record<
	TaskRunStatus,
	{
		label: string;
		bg: string;
		text: string;
		border: string;
		icon: "clock" | "spinner" | "check" | "x" | "slash" | "clock-x";
		animate?: boolean;
	}
> = {
	queued: {
		label: "Queued",
		bg: "bg-amber-500/15",
		text: "text-amber-300",
		border: "border-amber-500/30",
		icon: "clock",
		animate: true,
	},
	running: {
		label: "Running",
		bg: "bg-emerald-500/15",
		text: "text-emerald-300",
		border: "border-emerald-500/30",
		icon: "spinner",
		animate: true,
	},
	completed: {
		label: "Completed",
		bg: "bg-green-500/15",
		text: "text-green-400",
		border: "border-green-500/30",
		icon: "check",
	},
	failed: {
		label: "Failed",
		bg: "bg-rose-500/15",
		text: "text-rose-300",
		border: "border-rose-500/30",
		icon: "x",
	},
	cancelled: {
		label: "Cancelled",
		bg: "bg-zinc-500/15",
		text: "text-zinc-400",
		border: "border-zinc-500/30",
		icon: "slash",
	},
	timed_out: {
		label: "Timed Out",
		bg: "bg-orange-500/15",
		text: "text-orange-300",
		border: "border-orange-500/30",
		icon: "clock-x",
	},
};

function StatusIcon({
	icon,
	animate,
	size,
}: {
	icon: string;
	animate?: boolean;
	size: number;
}) {
	switch (icon) {
		case "clock":
			return (
				<svg
					width={size}
					height={size}
					viewBox="0 0 16 16"
					fill="none"
					className={animate ? "animate-pulse" : ""}
				>
					<circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
					<path
						d="M8 5v3l2 1.5"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			);

		case "spinner":
			return (
				<svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="animate-spin">
					<circle
						cx="8"
						cy="8"
						r="6"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeOpacity="0.25"
					/>
					<path
						d="M14 8a6 6 0 00-6-6"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
					/>
				</svg>
			);

		case "check":
			return (
				<svg width={size} height={size} viewBox="0 0 16 16" fill="none">
					<circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
					<path
						d="M5.5 8l2 2 3.5-4"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			);

		case "x":
			return (
				<svg width={size} height={size} viewBox="0 0 16 16" fill="none">
					<circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
					<path
						d="M5.5 5.5l5 5M10.5 5.5l-5 5"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
					/>
				</svg>
			);

		case "slash":
			return (
				<svg width={size} height={size} viewBox="0 0 16 16" fill="none">
					<circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
					<path d="M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
				</svg>
			);

		case "clock-x":
			return (
				<svg width={size} height={size} viewBox="0 0 16 16" fill="none">
					<circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
					<path
						d="M8 4.5V8M10.5 10l-2.5-2"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<path
						d="M5 11l6-6"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeOpacity="0.6"
					/>
				</svg>
			);

		default:
			return null;
	}
}

export function RunStatusBadge({ status, variant = "default", className }: RunStatusBadgeProps) {
	if (!status) {
		return <span className={cn("text-muted-foreground/50 font-mono", className)}>—</span>;
	}

	const config = runStatusConfig[status];
	if (!config) {
		return <span className={cn("text-muted-foreground/50 font-mono", className)}>{status}</span>;
	}

	const isCompact = variant === "compact";
	const iconSize = isCompact ? 10 : 12;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 font-medium border rounded",
				config.bg,
				config.text,
				config.border,
				isCompact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
				className,
			)}
			title={`Async run status: ${config.label}`}
		>
			<StatusIcon icon={config.icon} animate={config.animate} size={iconSize} />
			<span>{config.label}</span>
		</span>
	);
}
