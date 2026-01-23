import type { ApiClientError } from "@/api/client";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/Skeleton";
import { cn } from "@/lib/utils";
import type { ContainerNode, CrossProjectContainersTreeResponse } from "@workboard/shared";
import { useState } from "react";

/**
 * Recursively filter containers to only include those with open tasks
 * (or descendants with open tasks)
 */
function filterNonEmpty(containers: ContainerNode[]): ContainerNode[] {
	return containers
		.map((node) => {
			const filteredChildren = filterNonEmpty(node.children);
			// Keep if this node has open tasks OR any child has open tasks
			const hasOpenTasks = node.open_task_count > 0;
			const hasChildrenWithTasks = filteredChildren.length > 0;
			if (hasOpenTasks || hasChildrenWithTasks) {
				return { ...node, children: filteredChildren };
			}
			return null;
		})
		.filter((node): node is ContainerNode => node !== null);
}

type ProjectTree = CrossProjectContainersTreeResponse["projects"][number];

type SidebarProps = {
	loading: boolean;
	error: ApiClientError | null;
	workspaces: ProjectTree[];
	expanded: Set<string>;
	selectedWorkspaceId: string | null;
	selectedContainerId: string | null;
	showGlobalDashboard?: boolean;
	onToggle: (workspaceId: string, containerId: string) => void;
	onSelect: (workspaceId: string, containerId: string) => void;
	onSelectWorkspace: (workspaceId: string) => void;
	onShowGlobalDashboard?: () => void;
	onRetry?: () => void;
};

type TreeNodeProps = {
	workspaceId: string;
	node: ContainerNode;
	depth: number;
	expanded: Set<string>;
	selectedId: string | null;
	onToggle: (workspaceId: string, id: string) => void;
	onSelect: (workspaceId: string, id: string) => void;
};

function CountBadge({ open, total }: { open: number; total: number }) {
	if (total === 0) return null;
	return (
		<div className="flex items-center gap-0.5 tabular-nums text-[10px] ml-auto shrink-0">
			<span
				className={cn(
					"min-w-[14px] text-right",
					open > 0 ? "text-primary font-medium" : "text-muted-foreground/40",
				)}
			>
				{open}
			</span>
			<span className="text-muted-foreground/20">/</span>
			<span className="min-w-[14px] text-muted-foreground/40">{total}</span>
		</div>
	);
}

function TreeNode({
	workspaceId,
	node,
	depth,
	expanded,
	selectedId,
	onSelect,
	onToggle,
}: TreeNodeProps) {
	const isExpanded = expanded.has(`${workspaceId}:${node.id}`);
	const isSelected = selectedId === node.id;
	const hasChildren = node.children.length > 0;

	return (
		<div>
			<div
				className={cn(
					"group relative flex items-center h-7 cursor-pointer select-none transition-colors duration-100",
					isSelected
						? "text-foreground"
						: "text-muted-foreground/70 hover:text-foreground hover:bg-muted/20",
				)}
				style={{ paddingLeft: `${12 + depth * 12}px` }}
				onClick={() => {
					if (hasChildren) onToggle(workspaceId, node.id);
					onSelect(workspaceId, node.id);
				}}
			>
				{/* Selection indicator */}
				{isSelected && (
					<div className="absolute left-0 top-1 bottom-1 w-[2px] bg-primary rounded-full" />
				)}

				{/* Expand chevron */}
				{hasChildren ? (
					<span
						className={cn(
							"w-4 h-4 flex items-center justify-center text-[9px] text-muted-foreground/50 transition-transform duration-150 mr-1",
							isExpanded && "rotate-90",
						)}
					>
						▶
					</span>
				) : (
					<span className="w-4 h-4 flex items-center justify-center mr-1">
						<span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
					</span>
				)}

				{/* Node name */}
				<span
					className={cn("truncate text-[11px] flex-1", isSelected && "text-primary font-medium")}
				>
					{node.title || node.slug}
				</span>

				{/* Count badge */}
				<div className="pr-3">
					<CountBadge open={node.open_task_count} total={node.total_task_count} />
				</div>
			</div>

			{/* Children */}
			{hasChildren && isExpanded && (
				<div>
					{node.children.map((child: ContainerNode) => (
						<TreeNode
							key={child.id}
							workspaceId={workspaceId}
							node={child}
							depth={depth + 1}
							expanded={expanded}
							selectedId={selectedId}
							onSelect={onSelect}
							onToggle={onToggle}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function WorkspaceSection({
	projectId,
	projectName,
	containers,
	isActive,
	selectedContainerId,
	expanded,
	onSelectWorkspace,
	onSelect,
	onToggle,
}: {
	projectId: string;
	projectName: string;
	containers: ContainerNode[];
	isActive: boolean;
	selectedContainerId: string | null;
	expanded: Set<string>;
	onSelectWorkspace: () => void;
	onSelect: (workspaceId: string, containerId: string) => void;
	onToggle: (workspaceId: string, containerId: string) => void;
}) {
	const totalOpen = containers.reduce((sum, c) => sum + c.open_task_count, 0);

	return (
		<div className={cn("mb-1", isActive && "bg-secondary/40 rounded-sm")}>
			{/* Workspace header */}
			<button
				className={cn(
					"w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors duration-100 rounded-sm",
					isActive
						? "text-foreground"
						: "text-muted-foreground hover:text-foreground hover:bg-muted/20",
				)}
				onClick={onSelectWorkspace}
			>
				{/* Workspace icon/indicator */}
				<div
					className={cn(
						"w-1.5 h-1.5 rounded-sm shrink-0 transition-colors",
						isActive ? "bg-primary" : "bg-muted-foreground/30",
					)}
				/>

				{/* Name */}
				<span
					className={cn(
						"flex-1 min-w-0 text-[12px] font-medium truncate",
						isActive && "text-primary",
					)}
				>
					{projectName || projectId}
				</span>

				{/* Open task count */}
				{totalOpen > 0 ? (
					<span className="tabular-nums text-[10px] text-primary/70 shrink-0">{totalOpen}</span>
				) : null}
			</button>

			{/* Container tree */}
			{isActive && containers.length > 0 && (
				<div className="pb-2">
					{containers.map((node) => (
						<TreeNode
							key={`${projectId}:${node.id}`}
							workspaceId={projectId}
							node={node}
							depth={0}
							expanded={expanded}
							selectedId={selectedContainerId}
							onSelect={onSelect}
							onToggle={onToggle}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export function Sidebar({
	loading,
	error,
	workspaces,
	selectedWorkspaceId,
	selectedContainerId,
	showGlobalDashboard,
	expanded,
	onToggle,
	onSelect,
	onSelectWorkspace,
	onShowGlobalDashboard,
	onRetry,
}: SidebarProps) {
	const [hideEmpty, setHideEmpty] = useState(true);
	if (loading) {
		return (
			<div className="space-y-3 px-3 py-4">
				<Skeleton className="h-4 w-16" />
				<div className="space-y-2">
					{[...Array(4)].map((_, i) => (
						<div key={i} className="space-y-1">
							<Skeleton className="h-8 w-full" />
							<Skeleton className="h-6 w-[85%] ml-3" />
							<Skeleton className="h-6 w-[75%] ml-3" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="px-3 py-4">
				<ErrorBanner
					title="Could not load projects"
					message={error.message}
					detail={typeof error.details === "string" ? error.details : undefined}
					onRetry={onRetry}
				/>
			</div>
		);
	}

	if (!workspaces.length) {
		return (
			<div className="px-3 py-4">
				<EmptyState
					title="No projects yet"
					description="Use `wrkq mkdir <project>` and `wrkq touch <project>/<task>` to seed tasks, then refresh."
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-3 border-b border-border/30">
				<button
					onClick={onShowGlobalDashboard}
					className={cn(
						"flex items-center gap-2 transition-colors duration-150 hover:opacity-80",
						showGlobalDashboard && "opacity-100",
						!showGlobalDashboard && "opacity-70 hover:opacity-100",
					)}
					title="View all tasks across workspaces"
				>
					<div
						className={cn(
							"w-2 h-2 rounded-sm transition-colors",
							showGlobalDashboard ? "bg-primary animate-pulse" : "bg-primary",
						)}
					/>
					<span
						className={cn(
							"text-[11px] font-medium tracking-wide transition-colors",
							showGlobalDashboard ? "text-primary" : "text-muted-foreground",
						)}
					>
						WORKSPACES
					</span>
				</button>
				<button
					onClick={() => setHideEmpty(!hideEmpty)}
					className={cn(
						"flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-medium transition-all duration-150",
						hideEmpty
							? "bg-primary/15 text-primary border border-primary/30"
							: "bg-muted/40 text-muted-foreground/60 border border-transparent hover:bg-muted/60",
					)}
				>
					<span
						className={cn(
							"w-1.5 h-1.5 rounded-full transition-colors",
							hideEmpty ? "bg-primary" : "bg-muted-foreground/40",
						)}
					/>
					{hideEmpty ? "Active" : "All"}
				</button>
			</div>

			{/* Workspace list */}
			<div className="flex-1 overflow-y-auto py-2 px-1.5">
				{workspaces.map(({ projectId, projectName, containers }) => {
					const filteredContainers = hideEmpty ? filterNonEmpty(containers) : containers;
					return (
						<WorkspaceSection
							key={projectId}
							projectId={projectId}
							projectName={projectName}
							containers={filteredContainers}
							isActive={projectId === selectedWorkspaceId}
							selectedContainerId={selectedContainerId}
							expanded={expanded}
							onSelectWorkspace={() => onSelectWorkspace(projectId)}
							onSelect={onSelect}
							onToggle={onToggle}
						/>
					);
				})}
			</div>

			{/* Quick Actions */}
			<div className="px-3 py-2 border-t border-border/20 space-y-0.5">
				<a
					href="/projects"
					className={cn(
						"flex items-center gap-2 px-2 py-1.5 rounded-sm text-[11px] transition-colors",
						"text-muted-foreground/70 hover:text-foreground hover:bg-muted/30",
						"group",
					)}
				>
					<svg
						className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-cyan-400 transition-colors"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<circle cx="5" cy="5" r="2" />
						<circle cx="19" cy="5" r="2" />
						<circle cx="12" cy="12" r="2.5" />
						<circle cx="5" cy="19" r="2" />
						<circle cx="19" cy="19" r="2" />
						<path d="M7 5h10M5 7v10M19 7v10M7 19h10" strokeOpacity="0.4" />
						<path d="M6.5 6.5l4 4M13.5 13.5l4 4M17.5 6.5l-4 4M10.5 13.5l-4 4" strokeOpacity="0.4" />
					</svg>
					<span>Projects</span>
					<span className="ml-auto text-[9px] text-muted-foreground/40 group-hover:text-muted-foreground/60">
						⌘P
					</span>
				</a>
			</div>

			{/* Footer */}
			<div className="px-3 py-2 border-t border-border/20 text-[9px] text-muted-foreground/30 flex items-center justify-between">
				<span>wrkq v0.1</span>
				<span>
					{workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
				</span>
			</div>
		</div>
	);
}
