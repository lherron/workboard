import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

type ProjectRosterHeaderProps = {
	projectId: string;
	activeCount: number;
	pausedCount: number;
	totalMembers: number;
	onBack: () => void;
};

export function ProjectRosterHeader({
	projectId,
	activeCount,
	pausedCount,
	totalMembers,
	onBack,
}: ProjectRosterHeaderProps) {
	return (
		<header className="relative shrink-0 border-b border-indigo-900/30 bg-[#0d1133]/60 backdrop-blur-md">
			{/* Top accent line - cyan gradient with glow */}
			<div
				className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
				style={{ boxShadow: "0 0 8px rgba(34, 211, 238, 0.3)" }}
			/>

			<div className="px-6 py-3">
				<div className="flex items-center justify-between">
					{/* Left: Back + Title */}
					<div className="flex items-center gap-4">
						<button
							onClick={onBack}
							className="flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-indigo-300/70 hover:text-cyan-300 border border-indigo-700/40 hover:border-cyan-500/50 transition-all rounded bg-indigo-950/30 hover:bg-indigo-900/40"
						>
							<ArrowLeft className="w-3 h-3" />
							Back
						</button>

						<div className="flex items-center gap-3">
							{/* Observatory icon - with cyberpunk styling */}
							<div className="w-9 h-9 rounded-lg border border-cyan-500/40 flex items-center justify-center bg-gradient-to-br from-cyan-500/15 to-indigo-900/40 relative overflow-hidden">
								<div className="absolute inset-0 bg-gradient-to-tr from-cyan-400/5 to-transparent" />
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									className="text-cyan-400 relative z-10"
									style={{ filter: "drop-shadow(0 0 3px rgba(34, 211, 238, 0.5))" }}
								>
									{/* Telescope/observatory icon */}
									<circle cx="12" cy="12" r="3" />
									<path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
									<path d="M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
								</svg>
							</div>
							<div>
								<h1 className="text-[14px] font-bold tracking-wide uppercase text-cyan-100">
									Project Roster
								</h1>
								<p className="text-[10px] text-cyan-400/80 font-mono tracking-wider">{projectId}</p>
							</div>
						</div>
					</div>

					{/* Right: Status indicators */}
					<div className="flex items-center gap-6">
						{/* Active agents */}
						<div className="flex items-center gap-2">
							<span className="relative flex h-2 w-2">
								{activeCount > 0 && (
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
								)}
								<span
									className={cn(
										"relative inline-flex rounded-full h-2 w-2",
										activeCount > 0 ? "bg-cyan-400" : "bg-indigo-600",
									)}
									style={activeCount > 0 ? { boxShadow: "0 0 6px #22d3ee" } : {}}
								/>
							</span>
							<span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
								{activeCount} Active
							</span>
						</div>

						{/* Paused */}
						{pausedCount > 0 && (
							<div className="flex items-center gap-2">
								<span className="w-2 h-2 rounded-full bg-indigo-400" />
								<span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
									{pausedCount} Paused
								</span>
							</div>
						)}

						{/* Total stats */}
						<div className="pl-4 border-l border-indigo-700/40 flex items-center gap-4">
							<span className="text-[10px] font-mono text-indigo-300/70">
								{totalMembers} member{totalMembers !== 1 ? "s" : ""}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Subtle horizontal scan lines for cyberpunk texture */}
			<div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
				{[...Array(8)].map((_, i) => (
					<div
						key={i}
						className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
						style={{ top: `${(i + 1) * 12}%` }}
					/>
				))}
			</div>
		</header>
	);
}
