import { cn } from "@/lib/utils";

type ModeToggleProps = {
	mode: "execute" | "plan";
	onChange: (mode: "execute" | "plan") => void;
};

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
	return (
		<div className="flex items-center gap-1 font-mono text-[10px]">
			<span className="text-muted-foreground/40 mr-1 hidden sm:inline">mode:</span>
			<div className="flex border border-border/50 bg-black/30">
				<button
					onClick={() => onChange("execute")}
					className={cn(
						"relative px-3 py-1.5 transition-all duration-200 flex items-center gap-1.5",
						"hover:bg-primary/10",
						mode === "execute"
							? "text-primary bg-primary/10"
							: "text-muted-foreground/50 hover:text-muted-foreground",
					)}
				>
					<span className="font-bold">&gt;</span>
					<span className="tracking-[0.1em] uppercase">Execute</span>
					{mode === "execute" && (
						<span className="absolute -bottom-px left-0 right-0 h-[2px] bg-primary/80" />
					)}
				</button>
				<button
					onClick={() => onChange("plan")}
					className={cn(
						"relative px-3 py-1.5 transition-all duration-200 flex items-center gap-1.5 border-l border-border/50",
						"hover:bg-primary/10",
						mode === "plan"
							? "text-primary bg-primary/10"
							: "text-muted-foreground/50 hover:text-muted-foreground",
					)}
				>
					<span className="font-bold">#</span>
					<span className="tracking-[0.1em] uppercase">Plan</span>
					{mode === "plan" && (
						<span className="absolute -bottom-px left-0 right-0 h-[2px] bg-primary/80" />
					)}
				</button>
			</div>
		</div>
	);
}
