import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FilterSet } from "./filtersets";

type FiltersetDropdownProps = {
	filtersets: FilterSet[];
	activeFilterset: FilterSet | null;
	isCustom: boolean;
	onSelect: (filterset: FilterSet) => void;
	onSaveNew: () => void;
	onManage: () => void;
};

export function FiltersetDropdown({
	filtersets,
	activeFilterset,
	isCustom,
	onSelect,
	onSaveNew,
	onManage,
}: FiltersetDropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
	const buttonRef = useRef<HTMLButtonElement>(null);

	const updatePosition = useCallback(() => {
		if (buttonRef.current) {
			const rect = buttonRef.current.getBoundingClientRect();
			setDropdownPosition({
				top: rect.bottom + 4,
				left: rect.left,
			});
		}
	}, []);

	const handleKeyDown = useCallback((e: KeyboardEvent) => {
		if (e.key === "Escape") {
			setIsOpen(false);
		}
	}, []);

	useEffect(() => {
		if (isOpen) {
			updatePosition();
			document.addEventListener("keydown", handleKeyDown);
			return () => {
				document.removeEventListener("keydown", handleKeyDown);
			};
		}
	}, [isOpen, handleKeyDown, updatePosition]);

	const displayName = isCustom ? "Custom" : activeFilterset?.name || "All Projects";

	return (
		<div className="relative">
			<button
				ref={buttonRef}
				onClick={() => setIsOpen(!isOpen)}
				className={cn(
					"flex items-center gap-2 px-3 py-1.5 border transition-all",
					"text-[11px] font-mono tracking-wide",
					isOpen
						? "border-primary/60 bg-primary/20 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
						: isCustom
							? "border-amber-500/50 bg-amber-950 text-amber-400 hover:border-amber-500/70 hover:bg-amber-900"
							: "border-border/50 bg-secondary text-foreground/80 hover:border-primary/40 hover:bg-secondary",
				)}
			>
				<svg
					width="10"
					height="10"
					viewBox="0 0 10 10"
					fill="none"
					className={cn("transition-colors", isCustom ? "text-amber-500/60" : "text-primary/50")}
				>
					<rect x="1" y="1" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
					<path d="M3 5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
				</svg>
				<span className="max-w-[120px] truncate">{displayName}</span>
				{isCustom && <span className="text-[9px] text-amber-500/70 font-bold">*</span>}
				<svg
					width="8"
					height="8"
					viewBox="0 0 8 8"
					fill="none"
					className={cn("transition-transform ml-1", isOpen && "rotate-180")}
				>
					<path
						d="M1.5 2.5L4 5.5L6.5 2.5"
						stroke="currentColor"
						strokeWidth="1.2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>

			{isOpen &&
				createPortal(
					<>
						{/* Backdrop to capture clicks */}
						<div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
						<div
							className="fixed z-[9999] min-w-[200px] border border-border/60 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
							style={{
								backgroundColor: "#121212",
								top: dropdownPosition.top,
								left: dropdownPosition.left,
							}}
						>
							{/* Header */}
							<div
								className="px-3 py-2 border-b border-border/40"
								style={{ backgroundColor: "#1a1a1a" }}
							>
								<span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
									Filtersets
								</span>
							</div>

							{/* Filterset list */}
							<div className="max-h-[240px] overflow-y-auto py-1">
								{filtersets.length === 0 ? (
									<div className="px-3 py-4 text-center">
										<span className="text-[10px] font-mono text-muted-foreground/40">
											No saved presets
										</span>
									</div>
								) : (
									filtersets.map((fs) => (
										<button
											key={fs.id}
											onClick={() => {
												onSelect(fs);
												setIsOpen(false);
											}}
											className={cn(
												"w-full px-3 py-2 text-left flex items-center gap-2 transition-colors",
												activeFilterset?.id === fs.id && !isCustom
													? "text-primary"
													: "text-foreground/80 hover:text-foreground",
											)}
											style={{
												backgroundColor:
													activeFilterset?.id === fs.id && !isCustom ? "#1a2e1a" : undefined,
											}}
											onMouseEnter={(e) => {
												if (!(activeFilterset?.id === fs.id && !isCustom)) {
													e.currentTarget.style.backgroundColor = "#1a1a1a";
												}
											}}
											onMouseLeave={(e) => {
												if (!(activeFilterset?.id === fs.id && !isCustom)) {
													e.currentTarget.style.backgroundColor = "";
												}
											}}
										>
											<span
												className={cn(
													"w-4 h-4 flex items-center justify-center border text-[9px]",
													activeFilterset?.id === fs.id && !isCustom
														? "border-primary/60 text-primary"
														: "border-border/40 text-transparent",
												)}
												style={{
													backgroundColor:
														activeFilterset?.id === fs.id && !isCustom ? "#1a2e1a" : undefined,
												}}
											>
												{activeFilterset?.id === fs.id && !isCustom ? ">" : ""}
											</span>
											<span className="text-[11px] font-mono tracking-wide truncate flex-1">
												{fs.name}
											</span>
											<span className="text-[9px] font-mono text-muted-foreground/40 tabular-nums">
												{fs.selected.length}
											</span>
										</button>
									))
								)}
							</div>

							{/* Divider */}
							<div className="border-t border-border/40" />

							{/* Actions */}
							<div className="py-1">
								<button
									onClick={() => {
										onSaveNew();
										setIsOpen(false);
									}}
									className="w-full px-3 py-2 text-left flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors"
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor = "#1a1a1a";
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = "";
									}}
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 14 14"
										fill="none"
										className="text-primary/60"
									>
										<path
											d="M7 3v8M3 7h8"
											stroke="currentColor"
											strokeWidth="1.3"
											strokeLinecap="round"
										/>
									</svg>
									<span className="text-[11px] font-mono tracking-wide">Save current...</span>
								</button>
								{filtersets.length > 0 && (
									<button
										onClick={() => {
											onManage();
											setIsOpen(false);
										}}
										className="w-full px-3 py-2 text-left flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors"
										onMouseEnter={(e) => {
											e.currentTarget.style.backgroundColor = "#1a1a1a";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.backgroundColor = "";
										}}
									>
										<svg
											width="14"
											height="14"
											viewBox="0 0 14 14"
											fill="none"
											className="text-muted-foreground/50"
										>
											<path
												d="M2 4h10M2 7h10M2 10h10"
												stroke="currentColor"
												strokeWidth="1.3"
												strokeLinecap="round"
											/>
										</svg>
										<span className="text-[11px] font-mono tracking-wide">Manage presets...</span>
									</button>
								)}
							</div>
						</div>
					</>,
					document.body,
				)}
		</div>
	);
}
