/**
 * Auto-scroll hook for chat/conversation UIs.
 *
 * Handles the complex scroll-to-bottom behavior needed for live-updating
 * chat interfaces, including:
 * - Initial scroll on mount
 * - Scroll when entries first become available (SSE connects)
 * - Scroll on new entries
 * - Fallback delayed scroll for async content rendering
 *
 * Extracted from SessionCard and ProjectRosterConversation.
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

export type UseAutoScrollOptions = {
	/**
	 * Number that changes when new content arrives.
	 * Typically the length of the entries array.
	 */
	dependency: number;

	/**
	 * Key that resets scroll tracking when changed.
	 * Typically the sessionId - when switching sessions, we want to re-scroll.
	 */
	resetKey?: string | null;

	/**
	 * Whether auto-scroll is enabled.
	 * Set to false to disable all scroll behavior.
	 * @default true
	 */
	enabled?: boolean;

	/**
	 * Delay in ms for fallback scroll.
	 * Helps catch async content rendering.
	 * @default 100
	 */
	fallbackDelay?: number;
};

export type UseAutoScrollResult = {
	/**
	 * Ref to attach to the scrollable container element.
	 */
	scrollRef: React.RefObject<HTMLDivElement>;

	/**
	 * Manually trigger scroll to bottom.
	 * Uses requestAnimationFrame for smooth scrolling.
	 */
	scrollToBottom: () => void;
};

/**
 * Hook for auto-scrolling chat containers to bottom on new content.
 *
 * @example
 * ```tsx
 * const { scrollRef, scrollToBottom } = useAutoScroll({
 *   dependency: entries.length,
 *   resetKey: sessionId,
 * });
 *
 * return (
 *   <div ref={scrollRef} className="overflow-y-auto">
 *     {entries.map(...)}
 *   </div>
 * );
 * ```
 */
export function useAutoScroll(options: UseAutoScrollOptions): UseAutoScrollResult {
	const { dependency, resetKey, enabled = true, fallbackDelay = 100 } = options;

	const scrollRef = useRef<HTMLDivElement>(null);
	const hasInitialScrolled = useRef(false);

	// Scroll to bottom using requestAnimationFrame for better timing with rendering
	const scrollToBottom = useCallback(() => {
		if (!enabled) return;

		requestAnimationFrame(() => {
			if (scrollRef.current) {
				scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
			}
		});
	}, [enabled]);

	// Reset scroll tracking when resetKey changes (e.g., switching sessions)
	// biome-ignore lint/correctness/useExhaustiveDependencies: resetKey triggers reset on session switch
	useEffect(() => {
		hasInitialScrolled.current = false;
	}, [resetKey]);

	// Auto-scroll when dependency changes (new entries arrive)
	// biome-ignore lint/correctness/useExhaustiveDependencies: dependency triggers scroll on new entries
	useEffect(() => {
		if (!enabled) return;
		scrollToBottom();
	}, [dependency, scrollToBottom, enabled]);

	// Initial scroll to bottom on mount - use useLayoutEffect for synchronous scroll before paint
	useLayoutEffect(() => {
		if (!enabled) return;

		if (!hasInitialScrolled.current && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
			hasInitialScrolled.current = true;
		}
	}, [enabled]);

	// Scroll when entries first become available (after SSE connects)
	useLayoutEffect(() => {
		if (!enabled) return;

		if (dependency > 0 && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [dependency, enabled]);

	// Fallback: scroll after a brief delay to catch async content rendering
	// biome-ignore lint/correctness/useExhaustiveDependencies: dependency triggers fallback scroll
	useEffect(() => {
		if (!enabled) return;

		const timer = setTimeout(() => {
			if (scrollRef.current) {
				scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
			}
		}, fallbackDelay);

		return () => clearTimeout(timer);
	}, [dependency, fallbackDelay, enabled]);

	return {
		scrollRef,
		scrollToBottom,
	};
}
