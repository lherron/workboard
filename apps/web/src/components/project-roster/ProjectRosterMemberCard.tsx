import { cn } from "@/lib/utils";
import type { MemberWithRuns } from "./ProjectRosterView";

type ProjectRosterMemberCardProps = {
	memberWithRuns: MemberWithRuns;
	isSelected: boolean;
	onSelect: () => void;
};

// State indicator styling
const stateStyles: Record<string, { dot: string; text: string; label: string }> = {
	active: {
		dot: "bg-cyan-400",
		text: "text-cyan-400",
		label: "ACTIVE",
	},
	paused: {
		dot: "bg-indigo-400",
		text: "text-indigo-400",
		label: "PAUSED",
	},
};

export function ProjectRosterMemberCard({
	memberWithRuns,
	isSelected,
	onSelect,
}: ProjectRosterMemberCardProps) {
	const { member, sessions, roleColor } = memberWithRuns;
	const stateStyle = stateStyles[member.state] ?? stateStyles.active;

	const hasActiveSession = !!member.session.activeSessionId;
	const sessionCount = sessions.length;
	const totalRuns = sessions.reduce((sum, s) => sum + s.runs.length, 0);

	// Check if oracle (special styling)
	const isOracle = member.roleName.toLowerCase() === "oracle";

	return (
		<button
			onClick={onSelect}
			className={cn(
				"w-full text-left rounded-lg border transition-all duration-300",
				"backdrop-blur-sm relative overflow-hidden group",
				isSelected
					? "border-cyan-500/50 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/30 bg-indigo-950/60"
					: "border-indigo-800/40 hover:border-indigo-700/60 bg-[#0d1133]/30 hover:bg-[#0d1133]/50",
			)}
		>
			{/* Animated glow on hover/select */}
			<div
				className={cn(
					"absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none",
					isSelected && "opacity-100",
					!isSelected && "group-hover:opacity-50",
				)}
				style={{
					background: `radial-gradient(circle at 50% 0%, ${roleColor}15, transparent 70%)`,
				}}
			/>
			{/* Top accent bar */}
			<div
				className={cn(
					"h-[3px] rounded-t-lg transition-all duration-300",
					isSelected ? "opacity-100" : "opacity-40 group-hover:opacity-70",
				)}
				style={{
					backgroundColor: roleColor,
					boxShadow: isSelected ? `0 0 8px ${roleColor}80` : "none",
				}}
			/>

			<div className="p-3 relative">
				{/* Role name + state */}
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						{/* Role indicator dot */}
						<span
							className={cn(
								"w-2 h-2 rounded-full relative",
								member.state === "active" && "animate-pulse",
							)}
							style={{
								backgroundColor: roleColor,
								boxShadow: member.state === "active" ? `0 0 8px ${roleColor}` : "none",
							}}
						/>
						<span
							className={cn(
								"text-[11px] font-bold uppercase tracking-wider",
								isOracle ? "text-[#ff6b9d]" : "text-cyan-100",
							)}
						>
							{member.persona}
						</span>
					</div>

					{/* State badge */}
					<span className={cn("text-[8px] font-bold uppercase tracking-wider", stateStyle.text)}>
						{stateStyle.label}
					</span>
				</div>

				{/* Role Name */}
				<div
					className={cn(
						"inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium mb-2 border",
						isOracle
							? "bg-[#ff6b9d]/10 text-[#ff6b9d] border-[#ff6b9d]/20"
							: "bg-indigo-900/30 text-cyan-200/80 border-indigo-700/30",
					)}
				>
					<span>{member.roleName}</span>
					{member.model && (
						<>
							<span className="text-indigo-500/50">·</span>
							<span className="text-indigo-300/60">{member.model}</span>
						</>
					)}
				</div>

				{/* Agent target (subtle) */}
				<div className="text-[9px] font-mono text-indigo-400/50 truncate mb-2">
					{member.agentTarget}
				</div>

				{/* Stats row */}
				<div className="flex items-center justify-between text-[9px] text-indigo-300/60">
					<div className="flex items-center gap-3">
						<span>{totalRuns} runs</span>
						<span>{sessionCount} sessions</span>
					</div>

					{/* Active session indicator */}
					{hasActiveSession && (
						<span className="flex items-center gap-1 text-cyan-400/80">
							<span
								className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse"
								style={{ boxShadow: "0 0 4px #22d3ee" }}
							/>
							live
						</span>
					)}
				</div>
			</div>
		</button>
	);
}
