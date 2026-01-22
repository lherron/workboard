import { cn } from "@/lib/utils";
import type { SpecDocument } from "@webwrkq/shared";
import ReactFlow, { Background, Handle, type NodeProps, Position } from "reactflow";
import "reactflow/dist/style.css";
import {
	type ItemNodeData,
	type RootNodeData,
	type SectionNodeData,
	useSpecGraph,
} from "./hooks/useSpecGraph";

type Props = {
	spec: SpecDocument | null;
	onNodeClick?: (nodeId: string, type: "root" | "section" | "item") => void;
};

// Custom node components
function RootNode({ data }: NodeProps<RootNodeData>) {
	return (
		<div className="px-4 py-2 bg-primary/20 border-2 border-primary/50 text-primary font-mono text-sm font-bold">
			<Handle type="source" position={Position.Bottom} className="!bg-primary/50" />
			{data.label}
		</div>
	);
}

function SectionNode({ data }: NodeProps<SectionNodeData>) {
	return (
		<div className="px-3 py-1.5 bg-secondary/60 border border-border/50 text-foreground/80 font-mono text-xs">
			<Handle type="target" position={Position.Top} className="!bg-border/50" />
			<Handle type="source" position={Position.Bottom} className="!bg-border/50" />
			{data.label}
		</div>
	);
}

function ItemNode({ data }: NodeProps<ItemNodeData>) {
	const statusStyles = {
		draft: "border-dashed border-muted-foreground/40 text-muted-foreground",
		approved: "border-solid border-emerald-500/50 text-emerald-400",
		deferred: "border-solid border-zinc-500/40 text-zinc-500 opacity-60",
	};

	const style = statusStyles[data.status as keyof typeof statusStyles] || statusStyles.draft;

	return (
		<div className={cn("px-2 py-1 bg-background/80 border font-mono text-[10px]", style)}>
			<Handle type="target" position={Position.Top} className="!bg-border/30" />
			<span className="font-medium">{data.itemId}</span>
			<span className="ml-1 opacity-70 truncate max-w-[100px] inline-block align-middle">
				{data.label}
			</span>
		</div>
	);
}

const nodeTypes = {
	root: RootNode,
	section: SectionNode,
	item: ItemNode,
};

/**
 * React Flow graph visualization for spec structure.
 * Shows hierarchical view: Root -> Sections -> Items
 */
export function SpecGraphPane({ spec, onNodeClick }: Props) {
	const { nodes, edges, containerRef, onNodesChange, onEdgesChange, handleNodeClick, onInit } =
		useSpecGraph({ spec, onNodeClick });

	if (!spec) {
		return (
			<div className="h-full flex items-center justify-center">
				<p className="text-xs font-mono text-muted-foreground/60">No spec loaded</p>
			</div>
		);
	}

	return (
		<div ref={containerRef} className="h-full w-full">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onNodeClick={handleNodeClick}
				onInit={onInit}
				nodeTypes={nodeTypes}
				fitView
				fitViewOptions={{ padding: 0.2 }}
				minZoom={0.3}
				maxZoom={1.5}
				defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
				proOptions={{ hideAttribution: true }}
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable={true}
			>
				<Background color="hsl(var(--border) / 0.2)" gap={20} size={1} />
			</ReactFlow>
		</div>
	);
}
