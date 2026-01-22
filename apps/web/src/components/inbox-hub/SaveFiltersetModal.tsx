import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type SaveFiltersetModalProps = {
	isOpen: boolean;
	selectedCount: number;
	onClose: () => void;
	onSave: (name: string) => void;
};

export function SaveFiltersetModal({
	isOpen,
	selectedCount,
	onClose,
	onSave,
}: SaveFiltersetModalProps) {
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			setName("");
			setError(null);
			// Focus input after modal animation
			setTimeout(() => inputRef.current?.focus(), 50);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
			if (e.key === "Enter" && name.trim()) {
				handleSave();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose, name]);

	const handleSave = () => {
		const trimmed = name.trim();
		if (!trimmed) {
			setError("Name is required");
			return;
		}
		if (trimmed.length > 32) {
			setError("Name must be 32 characters or less");
			return;
		}
		onSave(trimmed);
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[4px]">
			<div
				className="relative w-full max-w-sm overflow-hidden border border-border/60 bg-background/95 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
				role="dialog"
				aria-modal="true"
				aria-labelledby="save-filterset-title"
			>
				{/* Scanline overlay */}
				<div
					className="absolute inset-0 pointer-events-none opacity-[0.04]"
					style={{
						backgroundImage:
							"repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(80 60% 55% / 0.2) 2px, hsl(80 60% 55% / 0.2) 4px)",
					}}
				/>

				<div className="relative">
					{/* Header */}
					<div className="flex items-center justify-between border-b border-border/50 px-4 py-3 bg-secondary/40">
						<div className="flex items-center gap-2">
							<div className="h-6 w-6 border border-primary/40 bg-primary/10 flex items-center justify-center">
								<svg
									width="12"
									height="12"
									viewBox="0 0 12 12"
									fill="none"
									className="text-primary"
								>
									<path
										d="M6 2v8M2 6h8"
										stroke="currentColor"
										strokeWidth="1.4"
										strokeLinecap="round"
									/>
								</svg>
							</div>
							<h2
								id="save-filterset-title"
								className="text-[12px] font-mono uppercase tracking-[0.15em] text-foreground"
							>
								Save Filterset
							</h2>
						</div>
						<button
							onClick={onClose}
							className="text-[10px] font-mono text-muted-foreground/60 hover:text-foreground transition-colors"
						>
							esc
						</button>
					</div>

					{/* Content */}
					<div className="p-4 space-y-4">
						<div className="space-y-2">
							<label
								htmlFor="filterset-name"
								className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60"
							>
								Preset Name
							</label>
							<input
								ref={inputRef}
								id="filterset-name"
								type="text"
								value={name}
								onChange={(e) => {
									setName(e.target.value);
									setError(null);
								}}
								placeholder="e.g., Work Projects"
								maxLength={32}
								className={cn(
									"w-full px-3 py-2 text-[12px] font-mono",
									"bg-black/40 border transition-colors",
									"placeholder:text-muted-foreground/30",
									"focus:outline-none",
									error
										? "border-red-500/50 focus:border-red-500/70"
										: "border-border/50 focus:border-primary/60",
								)}
							/>
							{error && <p className="text-[10px] font-mono text-red-400">{error}</p>}
						</div>

						<div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/50">
							<span className="px-1.5 py-0.5 border border-border/40 bg-secondary/30 tabular-nums">
								{selectedCount}
							</span>
							<span>project{selectedCount !== 1 ? "s" : ""} selected</span>
						</div>
					</div>

					{/* Footer */}
					<div className="flex items-center justify-end gap-3 border-t border-border/50 px-4 py-3 bg-secondary/40">
						<button
							onClick={onClose}
							className="text-[11px] font-mono text-muted-foreground/70 hover:text-foreground transition-colors"
						>
							cancel
						</button>
						<button
							onClick={handleSave}
							disabled={!name.trim()}
							className={cn(
								"text-[11px] font-mono px-3 py-1.5 border transition-colors",
								name.trim()
									? "text-primary border-primary/40 hover:bg-primary/10"
									: "text-muted-foreground/40 border-border/40 cursor-not-allowed",
							)}
						>
							save preset
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
