/**
 * ConciergeToggle - floating button on the right edge to open the concierge panel.
 *
 * Shows a chevron icon that indicates the panel can be opened.
 * Hidden when panel is open (the panel has its own close button).
 */

import { cn } from "@/lib/utils";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { useConcierge } from "./useConcierge";

export function ConciergeToggle() {
	const { isOpen, toggle } = useConcierge();

	// Hide toggle when panel is open
	if (isOpen) return null;

	return (
		<button
			onClick={toggle}
			className={cn(
				"fixed right-0 top-1/2 -translate-y-1/2 z-40",
				"flex items-center gap-1 px-1.5 py-3",
				"bg-slate-900/95 border border-r-0 border-slate-700/50 rounded-l-lg",
				"text-slate-400 hover:text-amber-400 hover:border-amber-500/30",
				"hover:bg-slate-800/95",
				"transition-all duration-200",
				"shadow-lg shadow-black/20",
				"group",
			)}
			title="Open UI Concierge"
		>
			{/* Icon that hints at chat functionality */}
			<MessageCircle className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />

			{/* Chevron indicating slide direction */}
			<ChevronLeft className="w-3 h-3 opacity-40 group-hover:opacity-70 transition-opacity" />
		</button>
	);
}
