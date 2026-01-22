/**
 * Filterset types and localStorage persistence for Inbox Hub
 */

export type FilterSet = {
	id: string;
	name: string;
	selected: string[];
	order: string[];
};

/** Current working filter state (not a saved filterset) */
export type CurrentFilterState = {
	selected: string[];
	order: string[];
};

export type FilterSetStorage = {
	filtersets: FilterSet[];
	activeId: string | null;
	defaultId: string | null;
	/** Current working filter state - takes precedence over defaultId on load */
	current: CurrentFilterState | null;
};

const FILTERSETS_STORAGE_KEY = "wrkq:inbox-hub-filtersets";

/**
 * Generate a unique ID for a new filterset using crypto for better uniqueness
 */
export function generateFiltersetId(): string {
	const randomBytes = new Uint8Array(4);
	crypto.getRandomValues(randomBytes);
	const randomPart = Array.from(randomBytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `fs-${Date.now().toString(36)}-${randomPart}`;
}

/**
 * Load filtersets from localStorage
 */
export function loadFiltersets(): FilterSetStorage {
	try {
		const stored = window.localStorage.getItem(FILTERSETS_STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			if (parsed && typeof parsed === "object" && Array.isArray(parsed.filtersets)) {
				// Parse current filter state if present
				let current: CurrentFilterState | null = null;
				if (
					parsed.current &&
					typeof parsed.current === "object" &&
					Array.isArray(parsed.current.selected) &&
					Array.isArray(parsed.current.order)
				) {
					current = {
						selected: parsed.current.selected.filter(
							(id: unknown): id is string => typeof id === "string",
						),
						order: parsed.current.order.filter(
							(id: unknown): id is string => typeof id === "string",
						),
					};
				}

				return {
					filtersets: parsed.filtersets.filter(
						(fs: unknown): fs is FilterSet =>
							typeof fs === "object" &&
							fs !== null &&
							typeof (fs as FilterSet).id === "string" &&
							typeof (fs as FilterSet).name === "string" &&
							Array.isArray((fs as FilterSet).selected) &&
							Array.isArray((fs as FilterSet).order),
					),
					activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
					defaultId: typeof parsed.defaultId === "string" ? parsed.defaultId : null,
					current,
				};
			}
		}
	} catch (err) {
		console.warn("Failed to load filtersets:", err);
	}
	return { filtersets: [], activeId: null, defaultId: null, current: null };
}

/**
 * Save filtersets to localStorage
 */
export function saveFiltersets(storage: FilterSetStorage): void {
	try {
		window.localStorage.setItem(FILTERSETS_STORAGE_KEY, JSON.stringify(storage));
	} catch (err) {
		console.warn("Failed to save filtersets:", err);
	}
}

/**
 * Create a new filterset
 */
export function createFilterset(
	storage: FilterSetStorage,
	name: string,
	selected: string[],
	order: string[],
): { storage: FilterSetStorage; filterset: FilterSet } {
	const filterset: FilterSet = {
		id: generateFiltersetId(),
		name,
		selected,
		order,
	};
	const newStorage: FilterSetStorage = {
		...storage,
		filtersets: [...storage.filtersets, filterset],
		activeId: filterset.id,
	};
	return { storage: newStorage, filterset };
}

/**
 * Update an existing filterset
 */
export function updateFilterset(
	storage: FilterSetStorage,
	id: string,
	updates: Partial<Omit<FilterSet, "id">>,
): FilterSetStorage {
	return {
		...storage,
		filtersets: storage.filtersets.map((fs) => (fs.id === id ? { ...fs, ...updates } : fs)),
	};
}

/**
 * Delete a filterset
 */
export function deleteFilterset(storage: FilterSetStorage, id: string): FilterSetStorage {
	const newFiltersets = storage.filtersets.filter((fs) => fs.id !== id);
	return {
		...storage,
		filtersets: newFiltersets,
		activeId: storage.activeId === id ? null : storage.activeId,
		defaultId: storage.defaultId === id ? null : storage.defaultId,
	};
}

/**
 * Set the active filterset (clears current state since we're using a saved filterset)
 */
export function setActiveFilterset(storage: FilterSetStorage, id: string | null): FilterSetStorage {
	return { ...storage, activeId: id, current: null };
}

/**
 * Set the default filterset
 */
export function setDefaultFilterset(
	storage: FilterSetStorage,
	id: string | null,
): FilterSetStorage {
	return { ...storage, defaultId: id };
}

/**
 * Set the current working filter state (clears activeId since it's a custom filter)
 */
export function setCurrentFilter(
	storage: FilterSetStorage,
	selected: string[],
	order: string[],
): FilterSetStorage {
	return {
		...storage,
		activeId: null,
		current: { selected, order },
	};
}

/**
 * Clear the current working filter state
 */
export function clearCurrentFilter(storage: FilterSetStorage): FilterSetStorage {
	return { ...storage, current: null };
}

/**
 * Check if current filter matches a saved filterset
 */
export function findMatchingFilterset(
	storage: FilterSetStorage,
	selected: Set<string>,
	order: string[],
): FilterSet | null {
	const selectedArray = Array.from(selected).sort();
	for (const fs of storage.filtersets) {
		const fsSelectedSorted = [...fs.selected].sort();
		if (
			selectedArray.length === fsSelectedSorted.length &&
			selectedArray.every((id, i) => id === fsSelectedSorted[i]) &&
			order.length === fs.order.length &&
			order.every((id, i) => id === fs.order[i])
		) {
			return fs;
		}
	}
	return null;
}
