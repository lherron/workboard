import { FiltersetDropdown } from "./FiltersetDropdown";
import type { FilterSet } from "./filtersets";
import type { CardSize, InboxSort } from "./types";

type SingleSearchMatch = {
	workspaceId: string;
	workspaceName: string;
	containerId: string;
	containerTitle: string;
	taskId: string;
	columnIndex: number;
} | null;

type InboxHubHeaderProps = {
	// Navigation
	goToGlobalDashboard: () => void;
	// Filter state
	filterReady: boolean;
	totalWorkspaceCount: number;
	visibleWorkspaceCount: number;
	inboxCount: number;
	isFilterActive: boolean;
	selectedProjectsCount: number;
	// Keyboard mode
	keyboardModeActive: boolean;
	// Card size
	cardSize: CardSize;
	cardSizeChanged: boolean;
	// Sort
	sort: InboxSort;
	sortChanged: boolean;
	onSortChange: (sort: InboxSort) => void;
	// View mode
	viewMode: "action" | "awaiting_ack" | "completed";
	onViewModeChange: (mode: "action" | "awaiting_ack" | "completed") => void;
	// Search
	searchQuery: string;
	onSearchChange: (query: string) => void;
	searchFocused: boolean;
	onSearchFocus: () => void;
	onSearchBlur: () => void;
	searchInputRef: React.RefObject<HTMLInputElement>;
	singleSearchMatch: SingleSearchMatch;
	onSearchEnter: (match: NonNullable<SingleSearchMatch>) => void;
	// Filterset
	filtersets: FilterSet[];
	activeFilterset: FilterSet | null;
	isFilterCustom: boolean;
	onFiltersetSelect: (filterset: FilterSet) => void;
	onFiltersetSaveNew: () => void;
	onFiltersetManage: () => void;
	// Filter modal
	workspacesLoading: boolean;
	onFilterModalOpen: () => void;
	// Settings
	onSettingsPanelOpen: () => void;
};

export function InboxHubHeader({
	goToGlobalDashboard,
	filterReady,
	totalWorkspaceCount,
	visibleWorkspaceCount,
	inboxCount,
	isFilterActive,
	selectedProjectsCount,
	keyboardModeActive,
	cardSize,
	cardSizeChanged,
	sort,
	sortChanged,
	onSortChange,
	viewMode,
	onViewModeChange,
	searchQuery,
	onSearchChange,
	searchFocused,
	onSearchFocus,
	onSearchBlur,
	searchInputRef,
	singleSearchMatch,
	onSearchEnter,
	filtersets,
	activeFilterset,
	isFilterCustom,
	onFiltersetSelect,
	onFiltersetSaveNew,
	onFiltersetManage,
	workspacesLoading,
	onFilterModalOpen,
	onSettingsPanelOpen,
}: InboxHubHeaderProps) {
	return (
		<header className="flex-shrink-0 border-b border-border/40 bg-secondary/50 backdrop-blur-sm">
			<div className="px-8 py-5 flex items-center justify-between">
				{/* Left: Logo + Title */}
				<div className="flex items-center gap-5">
					<button
						onClick={goToGlobalDashboard}
						className="group w-9 h-9 border border-primary/40 flex items-center justify-center bg-primary/5 hover:bg-primary/15 hover:border-primary/60 transition-all duration-200"
						title="Go to Dashboard"
					>
						<span className="text-primary/80 group-hover:text-primary text-[11px] font-mono font-semibold tracking-tight transition-colors">
							wq
						</span>
					</button>
					<div className="flex flex-col">
						<h1 className="text-[14px] font-mono font-medium text-foreground/90 tracking-wide uppercase">
							Inbox
						</h1>
						<p className="text-[10px] font-mono text-muted-foreground/50 tracking-wider mt-0.5">
							{filterReady && totalWorkspaceCount > 0
								? `${visibleWorkspaceCount}/${totalWorkspaceCount} projects`
								: `${inboxCount} project${inboxCount !== 1 ? "s" : ""}`}
						</p>
					</div>

					{/* Keyboard Mode Badge */}
					{keyboardModeActive && (
						<div className="flex items-center gap-3 ml-4 pl-5 border-l border-border/30">
							<span className="text-[9px] font-mono uppercase tracking-[0.25em] text-amber-400/80">
								nav
							</span>
							<div className="flex items-center gap-2 text-[9px] font-mono text-amber-400/40">
								<kbd
									className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400/60"
									data-tooltip="Navigate: h/l = columns, j/k = tasks"
								>
									hjkl
								</kbd>
								<kbd
									className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400/60"
									data-tooltip="Complete selected task"
								>
									c
								</kbd>
								<kbd
									className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400/60"
									data-tooltip="Archive selected task"
								>
									a
								</kbd>
								<kbd
									className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400/60"
									data-tooltip="Delete selected task"
								>
									⌫
								</kbd>
								<kbd
									className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400/60"
									data-tooltip="Triage: async (t) or Codex terminal (T)"
								>
									t
								</kbd>
								<kbd
									className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400/60"
									data-tooltip="Implement with Claude (i) or Codex (I)"
								>
									i
								</kbd>
								<kbd
									className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400/60"
									data-tooltip="New task in focused column"
								>
									n
								</kbd>
								<kbd
									className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400/60"
									data-tooltip="Toggle density: compact / default / expanded"
								>
									d
								</kbd>
							</div>
						</div>
					)}

					{/* Card Size Indicator */}
					{(cardSizeChanged || cardSize !== "default") && (
						<div
							className={`flex items-center gap-2 ml-2 pl-5 border-l border-border/30 transition-all duration-300 ${
								cardSizeChanged ? "animate-fade-in" : ""
							}`}
						>
							<span
								className={`text-[9px] font-mono uppercase tracking-[0.2em] ${
									cardSizeChanged ? "text-sky-400/80" : "text-muted-foreground/50"
								}`}
							>
								{cardSize}
							</span>
							<kbd
								className={`text-[9px] font-mono px-1.5 py-0.5 ${
									cardSizeChanged
										? "bg-sky-500/10 text-sky-400/60 border border-sky-500/20"
										: "bg-secondary/40 text-muted-foreground/40 border border-border/30"
								}`}
								data-tooltip="Toggle card density: compact / default / expanded"
							>
								d
							</kbd>
						</div>
					)}
				</div>

				{/* Right: Controls */}
				<div className="flex items-center gap-6">
					{/* Search */}
					<div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/40 bg-secondary/40 shadow-sm">
						<svg
							width="12"
							height="12"
							viewBox="0 0 16 16"
							fill="none"
							className="text-muted-foreground/60"
						>
							<circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
							<path
								d="M10.8 10.8L14 14"
								stroke="currentColor"
								strokeWidth="1.3"
								strokeLinecap="round"
							/>
						</svg>
						<input
							ref={searchInputRef}
							type="search"
							value={searchQuery}
							onChange={(e) => onSearchChange(e.target.value)}
							onFocus={onSearchFocus}
							onBlur={onSearchBlur}
							onKeyDown={(e) => {
								if (e.key === "Enter" && singleSearchMatch) {
									e.preventDefault();
									e.stopPropagation();
									onSearchEnter(singleSearchMatch);
									return;
								}
								if (e.key === "Escape") {
									e.preventDefault();
									e.stopPropagation();
									onSearchChange("");
								}
							}}
							placeholder="Search title or ID"
							spellCheck={false}
							className="bg-transparent outline-none text-[11px] font-mono text-foreground/80 placeholder:text-muted-foreground/40 w-[180px] md:w-[220px]"
							aria-label="Search inbox tasks by title or ID"
						/>
						{searchQuery ? (
							<button
								type="button"
								onClick={() => onSearchChange("")}
								className="text-muted-foreground/50 hover:text-foreground/80 transition-colors"
								aria-label="Clear search"
							>
								<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
									<path
										d="M2 2l8 8M10 2l-8 8"
										stroke="currentColor"
										strokeWidth="1.3"
										strokeLinecap="round"
									/>
								</svg>
							</button>
						) : (
							<kbd
								className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-opacity ${
									searchFocused ? "opacity-0" : "opacity-100"
								} bg-secondary/50 text-muted-foreground/40 border-border/30`}
							>
								/
							</kbd>
						)}
					</div>

					{/* Sort + View Mode Group */}
					<div className="flex items-center">
						{/* Sort toggle */}
						<div className="flex">
							{[
								{ value: "priority" as const, label: "PRI" },
								{ value: "state" as const, label: "STATE" },
							].map(({ value, label }, idx) => (
								<button
									key={value}
									onClick={() => onSortChange(value)}
									className={`px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] transition-all duration-150 border ${idx > 0 ? "-ml-px" : ""} ${
										sort === value
											? "text-primary bg-primary/10 border-primary/30 relative z-10"
											: "text-muted-foreground/50 hover:text-muted-foreground/80 hover:bg-white/[0.02] border-border/40"
									}`}
								>
									{label}
								</button>
							))}
							{/* Sort hotkey hint */}
							<kbd
								className={`ml-1.5 self-center text-[9px] font-mono px-1.5 py-0.5 transition-all duration-300 ${
									sortChanged
										? "bg-primary/15 text-primary/80 border border-primary/30"
										: "bg-secondary/40 text-muted-foreground/30 border border-border/20"
								}`}
								data-tooltip="Toggle sort: priority / state"
							>
								s
							</kbd>
						</div>

						{/* Separator */}
						<div className="w-px h-5 bg-border/20 mx-3" />

						{/* View mode toggle */}
						<div className="flex">
							{(
								[
									{ mode: "action", label: "Action" },
									{ mode: "awaiting_ack", label: "Ack" },
									{ mode: "completed", label: "Done" },
								] as const
							).map(({ mode, label }, idx) => (
								<button
									key={mode}
									onClick={() => onViewModeChange(mode)}
									className={`px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] transition-all duration-150 border ${idx > 0 ? "-ml-px" : ""} ${
										viewMode === mode
											? "text-primary bg-primary/10 border-primary/30 relative z-10"
											: "text-muted-foreground/50 hover:text-muted-foreground/80 hover:bg-white/[0.02] border-border/40"
									}`}
								>
									{label}
								</button>
							))}
						</div>
					</div>

					{/* Filter Controls */}
					<div className="flex items-center gap-3 pl-3 border-l border-border/20">
						<FiltersetDropdown
							filtersets={filtersets}
							activeFilterset={activeFilterset}
							isCustom={isFilterCustom}
							onSelect={onFiltersetSelect}
							onSaveNew={onFiltersetSaveNew}
							onManage={onFiltersetManage}
						/>
						<button
							onClick={onFilterModalOpen}
							disabled={workspacesLoading}
							className={`group flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono tracking-wide border transition-all duration-150 ${
								isFilterActive
									? "text-primary border-primary/50 bg-primary/10 hover:bg-primary/15"
									: "text-muted-foreground/70 border-border/50 hover:text-foreground/80 hover:border-primary/40"
							} ${workspacesLoading ? "opacity-40 cursor-not-allowed" : ""}`}
						>
							<svg
								width="10"
								height="10"
								viewBox="0 0 14 14"
								fill="none"
								className="opacity-60 group-hover:opacity-80 transition-opacity"
							>
								<path
									d="M2.5 3h9M4.5 7h5M6 11h2"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
								/>
							</svg>
							<span>Filter</span>
							{filterReady && totalWorkspaceCount > 0 && (
								<span
									className={`text-[9px] font-mono tabular-nums px-1 ${
										isFilterActive ? "text-primary/70" : "text-muted-foreground/40"
									}`}
								>
									{selectedProjectsCount}/{totalWorkspaceCount}
								</span>
							)}
						</button>

						{/* Settings Cog */}
						<button
							onClick={onSettingsPanelOpen}
							className="group w-8 h-8 flex items-center justify-center text-muted-foreground/50 hover:text-foreground/80 border border-border/40 hover:border-primary/40 bg-secondary/30 hover:bg-secondary/60 transition-all duration-150"
							title="System Settings"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 16 16"
								fill="none"
								className="opacity-60 group-hover:opacity-100 transition-opacity"
							>
								<path
									d="M6.5 1.5h3v1.7a4.5 4.5 0 011.3.5l1.2-1.2 2.1 2.1-1.2 1.2c.2.4.4.8.5 1.3h1.7v3h-1.7a4.5 4.5 0 01-.5 1.3l1.2 1.2-2.1 2.1-1.2-1.2c-.4.2-.8.4-1.3.5v1.7h-3v-1.7a4.5 4.5 0 01-1.3-.5l-1.2 1.2-2.1-2.1 1.2-1.2a4.5 4.5 0 01-.5-1.3H1.5v-3h1.7c.1-.5.3-.9.5-1.3L2.5 4.6l2.1-2.1 1.2 1.2c.4-.2.8-.4 1.3-.5V1.5z"
									stroke="currentColor"
									strokeWidth="1.2"
									strokeLinejoin="round"
								/>
								<circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
							</svg>
						</button>
					</div>
				</div>
			</div>
		</header>
	);
}
