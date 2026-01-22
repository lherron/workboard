import { cn } from "@/lib/utils";
import type { CrossProjectContainersTreeResponse } from "@webwrkq/shared";
import {
	CheckSquare,
	ChevronDown,
	ChevronRight,
	Eye,
	EyeOff,
	Filter,
	Layers,
	Maximize2,
	Minimize2,
	RefreshCw,
	Square,
	Tag,
} from "lucide-react";
import { useState } from "react";
import type { PlanFilters } from "./PlanModeView";

type ProjectTree = CrossProjectContainersTreeResponse["projects"][number];

type PlanSidebarProps = {
	workspaces: ProjectTree[];
	selectedWorkspaces: Set<string>;
	onToggleWorkspace: (id: string) => void;
	onSelectAll: () => void;
	onSelectNone: () => void;
	filters: PlanFilters;
	onFiltersChange: (filters: PlanFilters) => void;
	allLabels: string[];
	showDone: boolean;
	onShowDoneChange: (show: boolean) => void;
	compactMode: boolean;
	onCompactModeChange: (compact: boolean) => void;
	onRefresh: () => void;
	isRefreshing: boolean;
};

type SectionProps = {
	title: string;
	icon?: React.ReactNode;
	defaultExpanded?: boolean;
	badge?: React.ReactNode;
	children: React.ReactNode;
};

function Section({ title, icon, defaultExpanded = true, badge, children }: SectionProps) {
	const [expanded, setExpanded] = useState(defaultExpanded);

	return (
		<div className="border-b border-border/20">
			<button
				onClick={() => setExpanded(!expanded)}
				className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/20 transition-colors"
			>
				<div className="w-4 flex items-center justify-center">
					{expanded ? (
						<ChevronDown className="w-3 h-3 text-primary/60" />
					) : (
						<ChevronRight className="w-3 h-3 text-muted-foreground/40" />
					)}
				</div>
				{icon}
				<span className="text-[11px] font-mono uppercase tracking-[0.15em] text-foreground/70 flex-1 text-left">
					{title}
				</span>
				{badge}
			</button>
			{expanded && <div className="px-4 pb-4">{children}</div>}
		</div>
	);
}

function Checkbox({
	checked,
	onChange,
	label,
	count,
	color,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label: string;
	count?: number;
	color?: string;
}) {
	return (
		<label className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
			<div
				className={cn(
					"w-4 h-4 border flex items-center justify-center transition-all",
					checked ? "border-primary/60" : "border-border/50 hover:border-primary/30",
				)}
				style={{
					backgroundColor: checked ? `${color || "hsl(80 60% 55%)"}20` : "transparent",
					borderColor: checked ? color || "hsl(80 60% 55%)" : undefined,
				}}
				onClick={() => onChange(!checked)}
			>
				{checked && (
					<span className="text-[10px] font-bold" style={{ color: color || "hsl(80 60% 55%)" }}>
						✓
					</span>
				)}
			</div>
			<span
				className={cn(
					"text-[11px] font-mono transition-colors truncate flex-1",
					checked ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground/80",
				)}
			>
				{label}
			</span>
			{count !== undefined && (
				<span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums">{count}</span>
			)}
		</label>
	);
}

function TogglePill({
	label,
	symbol,
	selected,
	onClick,
	color,
}: {
	label: string;
	symbol?: string;
	selected: boolean;
	onClick: () => void;
	color?: string;
}) {
	const defaultColor = "hsl(80 60% 55%)";
	const activeColor = color || defaultColor;

	return (
		<button
			onClick={onClick}
			className={cn(
				"px-2 py-1 text-[10px] font-mono border transition-all flex items-center gap-1.5",
			)}
			style={{
				color: selected ? activeColor : "hsl(0 0% 45%)",
				borderColor: selected ? `${activeColor}50` : "hsl(0 0% 20%)",
				backgroundColor: selected ? `${activeColor}15` : "transparent",
				boxShadow: selected ? `0 0 10px ${activeColor}20` : "none",
			}}
		>
			{symbol && <span>{symbol}</span>}
			<span className="uppercase tracking-wider">{label}</span>
		</button>
	);
}

export function PlanSidebar({
	workspaces,
	selectedWorkspaces,
	onToggleWorkspace,
	onSelectAll,
	onSelectNone,
	filters,
	onFiltersChange,
	allLabels,
	showDone,
	onShowDoneChange,
	compactMode,
	onCompactModeChange,
	onRefresh,
	isRefreshing,
}: PlanSidebarProps) {
	const [showAllLabels, setShowAllLabels] = useState(false);

	const togglePriority = (p: number) => {
		const current = filters.priorities;
		const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
		onFiltersChange({ ...filters, priorities: next });
	};

	const toggleKind = (k: string) => {
		const current = filters.kinds;
		const next = current.includes(k) ? current.filter((x) => x !== k) : [...current, k];
		onFiltersChange({ ...filters, kinds: next });
	};

	const toggleLabel = (l: string) => {
		const current = filters.labels;
		const next = current.includes(l) ? current.filter((x) => x !== l) : [...current, l];
		onFiltersChange({ ...filters, labels: next });
	};

	const clearFilters = () => {
		onFiltersChange({ priorities: [], kinds: [], labels: [] });
	};

	const activeFilterCount =
		filters.priorities.length + filters.kinds.length + filters.labels.length;

	const allSelected = selectedWorkspaces.size === workspaces.length;
	const noneSelected = selectedWorkspaces.size === 0;

	// Priority colors
	const priorityColors: Record<number, string> = {
		1: "hsl(0 70% 55%)",
		2: "hsl(35 85% 55%)",
		3: "hsl(0 0% 50%)",
		4: "hsl(0 0% 40%)",
	};

	// Kind config
	const kindConfig: Record<string, { symbol: string; color: string }> = {
		task: { symbol: "□", color: "hsl(200 70% 55%)" },
		bug: { symbol: "●", color: "hsl(0 70% 55%)" },
		spike: { symbol: "◇", color: "hsl(280 60% 60%)" },
		chore: { symbol: "○", color: "hsl(0 0% 55%)" },
	};

	const displayedLabels = showAllLabels ? allLabels : allLabels.slice(0, 8);

	return (
		<div className="h-full flex flex-col bg-secondary/60">
			{/* Header */}
			<div className="px-4 py-4 border-b border-border/30">
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2">
						<div
							className="w-6 h-6 flex items-center justify-center"
							style={{
								border: "1px solid hsl(80 60% 55% / 0.5)",
								background: "linear-gradient(135deg, hsl(80 60% 55% / 0.15) 0%, transparent 50%)",
							}}
						>
							<span className="text-primary text-[10px] font-bold">#</span>
						</div>
						<div>
							<div className="text-[12px] font-semibold text-foreground tracking-wide">
								PLAN MODE
							</div>
						</div>
					</div>

					{/* Refresh button */}
					<button
						onClick={onRefresh}
						disabled={isRefreshing}
						className="p-1.5 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
					>
						<RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
					</button>
				</div>

				<div className="text-[9px] font-mono text-muted-foreground/40 tracking-wider">
					Configure board filters
				</div>
			</div>

			{/* Scrollable content */}
			<div className="flex-1 overflow-y-auto">
				{/* Workspaces */}
				<Section
					title="Workspaces"
					icon={<Layers className="w-3.5 h-3.5 text-muted-foreground/50" />}
					badge={
						<span className="text-[9px] font-mono text-muted-foreground/40">
							{selectedWorkspaces.size}/{workspaces.length}
						</span>
					}
				>
					{/* Quick select buttons */}
					<div className="flex items-center gap-2 mb-3">
						<button
							onClick={onSelectAll}
							disabled={allSelected}
							className={cn(
								"flex items-center gap-1 px-2 py-1 text-[9px] font-mono border transition-all",
								allSelected
									? "text-muted-foreground/30 border-border/30 cursor-not-allowed"
									: "text-primary/80 border-primary/30 hover:bg-primary/10",
							)}
						>
							<CheckSquare className="w-3 h-3" />
							<span>ALL</span>
						</button>
						<button
							onClick={onSelectNone}
							disabled={noneSelected}
							className={cn(
								"flex items-center gap-1 px-2 py-1 text-[9px] font-mono border transition-all",
								noneSelected
									? "text-muted-foreground/30 border-border/30 cursor-not-allowed"
									: "text-muted-foreground/60 border-border/40 hover:bg-muted/20",
							)}
						>
							<Square className="w-3 h-3" />
							<span>NONE</span>
						</button>
					</div>

					<div className="space-y-0.5">
						{workspaces.map(({ projectId, projectName, containers }) => {
							const openCount = containers.reduce((s, c) => s + c.open_task_count, 0);
							return (
								<Checkbox
									key={projectId}
									checked={selectedWorkspaces.has(projectId)}
									onChange={() => onToggleWorkspace(projectId)}
									label={projectName}
									count={openCount}
								/>
							);
						})}
					</div>
				</Section>

				{/* Filters */}
				<Section
					title="Filters"
					icon={<Filter className="w-3.5 h-3.5 text-muted-foreground/50" />}
					badge={
						activeFilterCount > 0 ? (
							<span
								className="text-[9px] font-mono px-1.5 py-0.5"
								style={{
									color: "hsl(80 60% 55%)",
									background: "hsl(80 60% 55% / 0.15)",
									border: "1px solid hsl(80 60% 55% / 0.3)",
								}}
							>
								{activeFilterCount}
							</span>
						) : null
					}
				>
					<div className="space-y-4">
						{/* Priority */}
						<div>
							<div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider mb-2">
								Priority
							</div>
							<div className="flex gap-1.5 flex-wrap">
								{[1, 2, 3, 4].map((p) => (
									<TogglePill
										key={p}
										label={`P${p}`}
										selected={filters.priorities.includes(p)}
										onClick={() => togglePriority(p)}
										color={priorityColors[p]}
									/>
								))}
							</div>
						</div>

						{/* Kind */}
						<div>
							<div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider mb-2">
								Kind
							</div>
							<div className="flex gap-1.5 flex-wrap">
								{Object.entries(kindConfig).map(([kind, config]) => (
									<TogglePill
										key={kind}
										label={kind}
										symbol={config.symbol}
										selected={filters.kinds.includes(kind)}
										onClick={() => toggleKind(kind)}
										color={config.color}
									/>
								))}
							</div>
						</div>

						{/* Labels */}
						{allLabels.length > 0 && (
							<div>
								<div className="flex items-center justify-between mb-2">
									<div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider flex items-center gap-1.5">
										<Tag className="w-3 h-3" />
										Labels
									</div>
									{allLabels.length > 8 && (
										<button
											onClick={() => setShowAllLabels(!showAllLabels)}
											className="text-[9px] font-mono text-primary/70 hover:text-primary"
										>
											{showAllLabels ? "less" : `+${allLabels.length - 8} more`}
										</button>
									)}
								</div>
								<div className="flex gap-1.5 flex-wrap max-h-32 overflow-y-auto">
									{displayedLabels.map((label) => (
										<button
											key={label}
											onClick={() => toggleLabel(label)}
											className={cn("px-2 py-0.5 text-[9px] font-mono border transition-all")}
											style={{
												color: filters.labels.includes(label) ? "hsl(80 60% 55%)" : "hsl(0 0% 50%)",
												borderColor: filters.labels.includes(label)
													? "hsl(80 60% 55% / 0.4)"
													: "hsl(0 0% 20%)",
												backgroundColor: filters.labels.includes(label)
													? "hsl(80 60% 55% / 0.1)"
													: "transparent",
											}}
										>
											{label}
										</button>
									))}
								</div>
							</div>
						)}

						{/* Clear filters */}
						{activeFilterCount > 0 && (
							<button
								onClick={clearFilters}
								className="text-[10px] font-mono text-destructive/70 hover:text-destructive flex items-center gap-1"
							>
								<span>×</span>
								<span>clear all filters</span>
							</button>
						)}
					</div>
				</Section>

				{/* View Settings */}
				<Section
					title="View"
					icon={
						showDone ? (
							<Eye className="w-3.5 h-3.5 text-muted-foreground/50" />
						) : (
							<EyeOff className="w-3.5 h-3.5 text-muted-foreground/50" />
						)
					}
					defaultExpanded={true}
				>
					<div className="space-y-3">
						{/* Show completed toggle */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								{showDone ? (
									<Eye className="w-3.5 h-3.5 text-primary/70" />
								) : (
									<EyeOff className="w-3.5 h-3.5 text-muted-foreground/40" />
								)}
								<span className="text-[11px] font-mono text-foreground/70">Show completed</span>
							</div>
							<button
								onClick={() => onShowDoneChange(!showDone)}
								className={cn("w-10 h-5 rounded-full transition-all relative")}
								style={{
									backgroundColor: showDone ? "hsl(80 60% 55% / 0.3)" : "hsl(0 0% 15%)",
									border: `1px solid ${showDone ? "hsl(80 60% 55% / 0.5)" : "hsl(0 0% 25%)"}`,
								}}
							>
								<div
									className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-all")}
									style={{
										left: showDone ? "20px" : "2px",
										backgroundColor: showDone ? "hsl(80 60% 55%)" : "hsl(0 0% 40%)",
										boxShadow: showDone ? "0 0 8px hsl(80 60% 55% / 0.5)" : "none",
									}}
								/>
							</button>
						</div>

						{/* Compact mode toggle */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								{compactMode ? (
									<Minimize2 className="w-3.5 h-3.5 text-primary/70" />
								) : (
									<Maximize2 className="w-3.5 h-3.5 text-muted-foreground/40" />
								)}
								<span className="text-[11px] font-mono text-foreground/70">Compact cards</span>
							</div>
							<button
								onClick={() => onCompactModeChange(!compactMode)}
								className={cn("w-10 h-5 rounded-full transition-all relative")}
								style={{
									backgroundColor: compactMode ? "hsl(80 60% 55% / 0.3)" : "hsl(0 0% 15%)",
									border: `1px solid ${compactMode ? "hsl(80 60% 55% / 0.5)" : "hsl(0 0% 25%)"}`,
								}}
							>
								<div
									className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-all")}
									style={{
										left: compactMode ? "20px" : "2px",
										backgroundColor: compactMode ? "hsl(80 60% 55%)" : "hsl(0 0% 40%)",
										boxShadow: compactMode ? "0 0 8px hsl(80 60% 55% / 0.5)" : "none",
									}}
								/>
							</button>
						</div>
					</div>
				</Section>
			</div>

			{/* Footer */}
			<div className="px-4 py-3 border-t border-border/20 bg-secondary/40">
				<div className="text-[9px] font-mono text-muted-foreground/30 tracking-wider flex items-center gap-1">
					<span className="text-primary">$</span>
					<span>wrkq plan --view kanban</span>
				</div>
			</div>
		</div>
	);
}
