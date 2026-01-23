import { SessionEventRow } from "@/components/session-events";
import type { SessionStreamEntry } from "@/hooks/useCpSessionStream";
import { toRenderableEvent } from "@/session-events";

type EventBlockProps = {
	entry: SessionStreamEntry;
	roleColor: string;
	isNew?: boolean;
};

/**
 * Legacy wrapper kept to minimize churn in work-items code.
 * All rendering is delegated to the shared SessionEventRow pipeline.
 */
export function EventBlock({ entry, roleColor: _roleColor, isNew = false }: EventBlockProps) {
	const renderable = toRenderableEvent(entry);
	if (!renderable) return null;
	return <SessionEventRow event={renderable} variant="work-item" isNew={isNew} />;
}
