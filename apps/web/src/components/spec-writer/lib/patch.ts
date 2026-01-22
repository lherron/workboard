import {
	DEFAULT_SPEC_SECTIONS,
	type SpecDocument,
	type SpecMutation,
	type SpecSectionKind,
} from "@webwrkq/shared";
import { generateItemId, getNextItemOrder } from "./ids";

/**
 * Deep clone a spec document for immutable updates
 */
function cloneSpec(spec: SpecDocument): SpecDocument {
	return JSON.parse(JSON.stringify(spec));
}

/**
 * Apply a single mutation to a spec document.
 * Returns a new spec document (immutable update).
 *
 * @param spec The current spec document
 * @param mutation The mutation to apply
 * @returns The updated spec document
 */
export function applyMutation(spec: SpecDocument, mutation: SpecMutation): SpecDocument {
	const newSpec = cloneSpec(spec);

	switch (mutation.type) {
		case "add_item": {
			// Find or create the target section
			let section = newSpec.sections.find((s) => s.kind === mutation.section);

			if (!section) {
				// Create the section if it doesn't exist
				const template = DEFAULT_SPEC_SECTIONS.find((s) => s.kind === mutation.section);
				const newOrder = Math.max(0, ...newSpec.sections.map((s) => s.order)) + 1;

				section = {
					id: mutation.section,
					kind: mutation.section,
					label: template?.label || mutation.section,
					order: newOrder,
					items: [],
				};
				newSpec.sections.push(section);
			}

			// Generate new item ID
			const newId = generateItemId(newSpec, mutation.section);
			const newOrder = getNextItemOrder(newSpec, section.id);

			// Add the new item
			section.items.push({
				id: newId,
				summary: mutation.summary,
				body: mutation.body || "",
				status: mutation.status || "draft",
				order: newOrder,
			});

			break;
		}

		case "update_item": {
			// Find the item across all sections
			for (const section of newSpec.sections) {
				const item = section.items.find((i) => i.id === mutation.itemId);
				if (item) {
					if (mutation.summary !== undefined) {
						item.summary = mutation.summary;
					}
					if (mutation.body !== undefined) {
						item.body = mutation.body;
					}
					if (mutation.status !== undefined) {
						item.status = mutation.status;
					}
					break;
				}
			}
			break;
		}

		case "delete_item": {
			// Find and remove the item
			for (const section of newSpec.sections) {
				const index = section.items.findIndex((i) => i.id === mutation.itemId);
				if (index !== -1) {
					section.items.splice(index, 1);
					break;
				}
			}
			break;
		}

		case "update_overview": {
			newSpec.overview = mutation.overview;
			break;
		}

		case "set_title": {
			newSpec.title = mutation.title;
			break;
		}
	}

	// Update timestamp
	newSpec.metadata.updatedAt = Date.now();

	return newSpec;
}

/**
 * Apply multiple mutations to a spec document.
 * Mutations are applied in order.
 *
 * @param spec The current spec document
 * @param mutations Array of mutations to apply
 * @returns The updated spec document
 */
export function applyMutations(spec: SpecDocument, mutations: SpecMutation[]): SpecDocument {
	return mutations.reduce((current, mutation) => applyMutation(current, mutation), spec);
}

/**
 * Create a new empty spec document with default sections.
 *
 * @param id Unique ID for the spec
 * @param title Title of the spec
 * @param slug URL slug
 * @param projectId Project/workspace ID
 * @param createdBy Actor who created the spec
 * @returns A new spec document
 */
export function createEmptySpec(
	id: string,
	title: string,
	slug: string,
	projectId: string,
	createdBy: string,
): SpecDocument {
	const now = Date.now();

	return {
		schemaVersion: 1,
		id,
		slug,
		title,
		version: "0.1.0",
		rev: 0,
		overview: "",
		sections: DEFAULT_SPEC_SECTIONS.map((template, index) => ({
			id: template.kind,
			kind: template.kind as SpecSectionKind,
			label: template.label,
			order: index,
			items: [],
		})),
		metadata: {
			projectId,
			createdAt: now,
			updatedAt: now,
			createdBy,
			updatedBy: createdBy,
			sessionId: null,
		},
	};
}
