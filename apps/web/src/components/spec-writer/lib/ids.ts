import { SECTION_ID_PREFIX, type SpecDocument, type SpecSectionKind } from "@webwrkq/shared";

/**
 * Generate a new item ID for a section.
 * Format: PREFIX-NNN (e.g., F-001, C-002, Q-003)
 *
 * @param spec The current spec document
 * @param sectionKind The kind of section to add the item to
 * @returns A new unique ID
 */
export function generateItemId(spec: SpecDocument, sectionKind: SpecSectionKind): string {
	const prefix = SECTION_ID_PREFIX[sectionKind] || "X";

	// Find all existing IDs with this prefix across all sections
	const existingIds = spec.sections
		.flatMap((section) => section.items)
		.map((item) => item.id)
		.filter((id) => id.startsWith(`${prefix}-`));

	// Extract numbers and find max
	const numbers = existingIds.map((id) => {
		const match = id.match(/-(\d+)$/);
		return match ? Number.parseInt(match[1], 10) : 0;
	});

	const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
	const nextNum = maxNum + 1;

	// Pad to 3 digits
	return `${prefix}-${String(nextNum).padStart(3, "0")}`;
}

/**
 * Convert a string to a URL-safe slug.
 *
 * @param text The text to slugify
 * @returns URL-safe lowercase slug
 */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.substring(0, 64);
}

/**
 * Calculate the next order value for a new item in a section.
 *
 * @param spec The current spec document
 * @param sectionId The section ID to add the item to
 * @returns The next order value
 */
export function getNextItemOrder(spec: SpecDocument, sectionId: string): number {
	const section = spec.sections.find((s) => s.id === sectionId);
	if (!section || section.items.length === 0) return 0;

	const maxOrder = Math.max(...section.items.map((item) => item.order));
	return maxOrder + 1;
}

/**
 * Find the section that contains a given item ID.
 *
 * @param spec The spec document
 * @param itemId The item ID to find
 * @returns The section containing the item, or undefined
 */
export function findSectionForItem(
	spec: SpecDocument,
	itemId: string,
): { section: SpecDocument["sections"][number]; itemIndex: number } | undefined {
	for (const section of spec.sections) {
		const itemIndex = section.items.findIndex((item) => item.id === itemId);
		if (itemIndex !== -1) {
			return { section, itemIndex };
		}
	}
	return undefined;
}
