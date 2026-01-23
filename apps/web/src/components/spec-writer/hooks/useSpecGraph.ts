import type { SpecDocument } from "@workboard/shared";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	type Edge,
	type Node,
	type ReactFlowInstance,
	useEdgesState,
	useNodesState,
} from "reactflow";

// Node data types
export type RootNodeData = { label: string; specId: string };
export type SectionNodeData = { label: string; sectionId: string; kind: string };
export type ItemNodeData = { label: string; itemId: string; status: string };

// Layout constants
const ROOT_Y = 20;
const SECTION_Y = 100;
const ITEM_START_Y = 180;
const SECTION_SPACING = 180;
const ITEM_SPACING = 40;
const ROOT_X = 400;

/**
 * Build nodes and edges from a spec document for React Flow visualization.
 */
export function buildGraph(spec: SpecDocument): { nodes: Node[]; edges: Edge[] } {
	const nodes: Node[] = [];
	const edges: Edge[] = [];

	// Root node (spec title)
	const rootId = `root-${spec.id}`;
	nodes.push({
		id: rootId,
		type: "root",
		position: { x: ROOT_X, y: ROOT_Y },
		data: { label: spec.title, specId: spec.id },
	});

	// Sort sections by order
	const sortedSections = [...spec.sections].sort((a, b) => a.order - b.order);

	// Calculate total width needed for centering
	const totalSections = sortedSections.length;
	const startX = ROOT_X - ((totalSections - 1) * SECTION_SPACING) / 2;

	// Section nodes
	sortedSections.forEach((section, sectionIndex) => {
		const sectionId = `section-${section.id}`;
		const sectionX = startX + sectionIndex * SECTION_SPACING;

		nodes.push({
			id: sectionId,
			type: "section",
			position: { x: sectionX, y: SECTION_Y },
			data: { label: section.label, sectionId: section.id, kind: section.kind },
		});

		// Edge from root to section
		edges.push({
			id: `edge-root-${section.id}`,
			source: rootId,
			target: sectionId,
			style: { stroke: "hsl(var(--border))", strokeWidth: 1 },
		});

		// Sort items by order
		const sortedItems = [...section.items].sort((a, b) => a.order - b.order);

		// Item nodes
		sortedItems.forEach((item, itemIndex) => {
			const itemNodeId = `item-${item.id}`;

			nodes.push({
				id: itemNodeId,
				type: "item",
				position: {
					x: sectionX,
					y: ITEM_START_Y + itemIndex * ITEM_SPACING,
				},
				data: { label: item.summary, itemId: item.id, status: item.status },
			});

			// Edge from section to item
			edges.push({
				id: `edge-${section.id}-${item.id}`,
				source: sectionId,
				target: itemNodeId,
				style: { stroke: "hsl(var(--border) / 0.5)", strokeWidth: 1 },
			});
		});
	});

	return { nodes, edges };
}

type UseSpecGraphOptions = {
	spec: SpecDocument | null;
	onNodeClick?: (nodeId: string, type: "root" | "section" | "item") => void;
};

type UseSpecGraphReturn = {
	// State
	nodes: Node[];
	edges: Edge[];
	containerRef: React.RefObject<HTMLDivElement>;
	reactFlowInstance: React.RefObject<ReactFlowInstance | null>;

	// Handlers
	onNodesChange: ReturnType<typeof useNodesState>[2];
	onEdgesChange: ReturnType<typeof useEdgesState>[2];
	handleNodeClick: (event: React.MouseEvent, node: Node) => void;
	onInit: (instance: ReactFlowInstance) => void;
};

/**
 * Hook for managing React Flow graph state and interactions.
 * Handles node/edge building, resize responsiveness, and click navigation.
 */
export function useSpecGraph({ spec, onNodeClick }: UseSpecGraphOptions): UseSpecGraphReturn {
	const containerRef = useRef<HTMLDivElement>(null);
	const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

	const { initialNodes, initialEdges } = useMemo(() => {
		if (!spec) return { initialNodes: [], initialEdges: [] };
		const { nodes, edges } = buildGraph(spec);
		return { initialNodes: nodes, initialEdges: edges };
	}, [spec]);

	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

	// Update nodes/edges when spec changes
	useMemo(() => {
		if (!spec) {
			setNodes([]);
			setEdges([]);
			return;
		}
		const { nodes: newNodes, edges: newEdges } = buildGraph(spec);
		setNodes(newNodes);
		setEdges(newEdges);
	}, [spec, setNodes, setEdges]);

	// Handle React Flow initialization
	const onInit = useCallback((instance: ReactFlowInstance) => {
		reactFlowInstance.current = instance;
	}, []);

	// Re-fit view on container resize
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const resizeObserver = new ResizeObserver(() => {
			// Debounce fitView to avoid excessive calls during resize
			if (reactFlowInstance.current) {
				requestAnimationFrame(() => {
					reactFlowInstance.current?.fitView({ padding: 0.2 });
				});
			}
		});

		resizeObserver.observe(container);
		return () => resizeObserver.disconnect();
	}, []);

	const handleNodeClick = useCallback(
		(_event: React.MouseEvent, node: Node) => {
			if (!onNodeClick) return;

			if (node.type === "root") {
				onNodeClick(node.id, "root");
			} else if (node.type === "section") {
				onNodeClick((node.data as SectionNodeData).sectionId, "section");
			} else if (node.type === "item") {
				onNodeClick((node.data as ItemNodeData).itemId, "item");
			}
		},
		[onNodeClick],
	);

	return {
		nodes,
		edges,
		containerRef,
		reactFlowInstance,
		onNodesChange,
		onEdgesChange,
		handleNodeClick,
		onInit,
	};
}
