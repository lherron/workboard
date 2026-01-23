import type { TaskState } from "@workboard/shared";
import {
	CARD_SIZES,
	type CardSize,
	INBOX_HUB_CARD_SIZE_KEY,
	INBOX_HUB_SORT_KEY,
	type InboxSort,
	STATE_SORT_ORDER,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Card Size Persistence
// ─────────────────────────────────────────────────────────────────────────────

export function loadCardSize(): CardSize {
	try {
		const stored = window.localStorage.getItem(INBOX_HUB_CARD_SIZE_KEY);
		if (stored && CARD_SIZES.includes(stored as CardSize)) {
			return stored as CardSize;
		}
	} catch (err) {
		console.warn("Failed to load card size preference:", err);
	}
	return "default";
}

export function saveCardSize(size: CardSize): void {
	try {
		if (size === "default") {
			window.localStorage.removeItem(INBOX_HUB_CARD_SIZE_KEY);
		} else {
			window.localStorage.setItem(INBOX_HUB_CARD_SIZE_KEY, size);
		}
	} catch (err) {
		console.warn("Failed to save card size preference:", err);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort Persistence
// ─────────────────────────────────────────────────────────────────────────────

export function loadSort(): InboxSort {
	try {
		const stored = window.localStorage.getItem(INBOX_HUB_SORT_KEY);
		if (stored === "state") return "state";
	} catch (err) {
		console.warn("Failed to load sort preference:", err);
	}
	return "priority";
}

export function saveSort(sort: InboxSort): void {
	try {
		if (sort === "priority") {
			window.localStorage.removeItem(INBOX_HUB_SORT_KEY);
		} else {
			window.localStorage.setItem(INBOX_HUB_SORT_KEY, sort);
		}
	} catch (err) {
		console.warn("Failed to save sort preference:", err);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Sorting
// ─────────────────────────────────────────────────────────────────────────────

export function sortTasksByState<T extends { state: TaskState; priority: number }>(
	tasks: T[],
): T[] {
	return [...tasks].sort((a, b) => {
		const aOrder = STATE_SORT_ORDER[a.state] ?? 99;
		const bOrder = STATE_SORT_ORDER[b.state] ?? 99;
		if (aOrder !== bOrder) return aOrder - bOrder;
		// Secondary sort by priority within the same state
		return a.priority - b.priority;
	});
}
