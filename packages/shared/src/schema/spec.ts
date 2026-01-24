/**
 * Spec Writer Schemas
 *
 * Zod schemas for the Spec Writer feature - AI-assisted technical design specifications.
 * These define the canonical data model for specs, sections, and items.
 */
import { z } from "zod";

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Status of a spec item - tracks approval lifecycle
 */
export const specItemStatusSchema = z.enum(["draft", "approved", "deferred"]);
export type SpecItemStatus = z.infer<typeof specItemStatusSchema>;

/**
 * Section kinds - categorizes different parts of a specification
 */
export const specSectionKindSchema = z.enum([
	"goals",
	"non-goals",
	"features",
	"constraints",
	"open-questions",
	"data-models",
	"integrations",
	"dependencies",
	"risks",
	"testing",
]);
export type SpecSectionKind = z.infer<typeof specSectionKindSchema>;

// ============================================================================
// ITEM SCHEMA
// ============================================================================

/**
 * A single item within a spec section (e.g., F-001, C-002, Q-001)
 */
export const specItemSchema = z.object({
	id: z.string(), // e.g., "F-001", "C-002", "Q-001"
	summary: z.string(), // Short description (node label)
	body: z.string().default(""), // Markdown body content
	status: specItemStatusSchema.default("draft"),
	order: z.number().int().nonnegative(), // Ordering within section
});
export type SpecItem = z.infer<typeof specItemSchema>;

// ============================================================================
// SECTION SCHEMA
// ============================================================================

/**
 * A section within a spec document (Goals, Features, Constraints, etc.)
 */
export const specSectionSchema = z.object({
	id: z.string(), // Stable identifier, e.g., "features", "goals"
	kind: specSectionKindSchema,
	label: z.string(), // Display name, e.g., "Features", "Goals"
	order: z.number().int().nonnegative(), // Ordering within document
	items: z.array(specItemSchema).default([]),
});
export type SpecSection = z.infer<typeof specSectionSchema>;

// ============================================================================
// METADATA SCHEMA
// ============================================================================

/**
 * Metadata for a spec document
 */
export const specMetadataSchema = z.object({
	projectId: z.string(), // Workspace/project ID
	createdAt: z.number(), // Timestamp
	updatedAt: z.number(), // Timestamp
	createdBy: z.string().optional(), // Actor slug or ID (optional)
	updatedBy: z.string().optional(), // Actor slug or ID (optional)
	sessionId: z.string().nullable().default(null), // Architect chat session for continuity
});
export type SpecMetadata = z.infer<typeof specMetadataSchema>;

// ============================================================================
// DOCUMENT SCHEMA
// ============================================================================

/**
 * Complete spec document with all content
 */
export const specDocumentSchema = z.object({
	schemaVersion: z.number().int().positive().default(1),
	id: z.string(), // Internal UUID
	slug: z.string(), // Human-readable URL slug
	title: z.string(),
	version: z.string().default("0.1.0"), // Human document version
	rev: z.number().int().nonnegative(), // Monotonic integer for optimistic concurrency
	overview: z.string().default(""), // Derived from markdown, appears before sections
	sections: z.array(specSectionSchema).default([]),
	metadata: specMetadataSchema,
});
export type SpecDocument = z.infer<typeof specDocumentSchema>;

// ============================================================================
// MANIFEST SCHEMA (Lightweight List View)
// ============================================================================

/**
 * Lightweight spec manifest for list views (avoids shipping full bodies)
 */
export const specManifestSchema = z.object({
	id: z.string(),
	slug: z.string(),
	title: z.string(),
	version: z.string(),
	rev: z.number().int().nonnegative(),
	createdAt: z.number(),
	updatedAt: z.number(),
	sessionId: z.string().nullable().optional(),
});
export type SpecManifest = z.infer<typeof specManifestSchema>;

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

/**
 * Response for listing specs
 */
export const specListResponseSchema = z.object({
	specs: z.array(specManifestSchema),
});
export type SpecListResponse = z.infer<typeof specListResponseSchema>;

/**
 * Response for single spec
 */
export const specResponseSchema = z.object({
	spec: specDocumentSchema,
});
export type SpecResponse = z.infer<typeof specResponseSchema>;

/**
 * Request to create a new spec
 */
export const createSpecRequestSchema = z.object({
	title: z.string().min(1),
	slug: z.string().optional(), // Auto-derived from title if not provided
});
export type CreateSpecRequest = z.infer<typeof createSpecRequestSchema>;

/**
 * Request to update an existing spec
 */
export const updateSpecRequestSchema = z.object({
	spec: specDocumentSchema,
	rev: z.number().int().nonnegative(), // For optimistic concurrency
});
export type UpdateSpecRequest = z.infer<typeof updateSpecRequestSchema>;

// ============================================================================
// MUTATION SCHEMAS (Architect Chat Protocol)
// ============================================================================

/**
 * Add a new item to a section
 */
export const addItemMutationSchema = z.object({
	type: z.literal("add_item"),
	section: specSectionKindSchema, // Section kind to add to
	summary: z.string(),
	body: z.string().optional(),
	status: specItemStatusSchema.optional(),
});
export type AddItemMutation = z.infer<typeof addItemMutationSchema>;

/**
 * Update an existing item
 */
export const updateItemMutationSchema = z.object({
	type: z.literal("update_item"),
	itemId: z.string(), // e.g., "F-001"
	summary: z.string().optional(),
	body: z.string().optional(),
	status: specItemStatusSchema.optional(),
});
export type UpdateItemMutation = z.infer<typeof updateItemMutationSchema>;

/**
 * Delete an item
 */
export const deleteItemMutationSchema = z.object({
	type: z.literal("delete_item"),
	itemId: z.string(),
});
export type DeleteItemMutation = z.infer<typeof deleteItemMutationSchema>;

/**
 * Update the overview section
 */
export const updateOverviewMutationSchema = z.object({
	type: z.literal("update_overview"),
	overview: z.string(),
});
export type UpdateOverviewMutation = z.infer<typeof updateOverviewMutationSchema>;

/**
 * Set the document title
 */
export const setTitleMutationSchema = z.object({
	type: z.literal("set_title"),
	title: z.string(),
});
export type SetTitleMutation = z.infer<typeof setTitleMutationSchema>;

/**
 * Union of all mutation types
 */
export const specMutationSchema = z.discriminatedUnion("type", [
	addItemMutationSchema,
	updateItemMutationSchema,
	deleteItemMutationSchema,
	updateOverviewMutationSchema,
	setTitleMutationSchema,
]);
export type SpecMutation = z.infer<typeof specMutationSchema>;

/**
 * Mutations block from architect chat
 */
export const specMutationsBlockSchema = z.object({
	mutations: z.array(specMutationSchema),
});
export type SpecMutationsBlock = z.infer<typeof specMutationsBlockSchema>;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default sections for a new spec document
 */
export const DEFAULT_SPEC_SECTIONS: Array<{ kind: SpecSectionKind; label: string }> = [
	{ kind: "goals", label: "Goals" },
	{ kind: "non-goals", label: "Non-goals" },
	{ kind: "features", label: "Features" },
	{ kind: "constraints", label: "Constraints" },
	{ kind: "open-questions", label: "Open Questions" },
];

/**
 * ID prefix mapping by section kind
 */
export const SECTION_ID_PREFIX: Record<SpecSectionKind, string> = {
	goals: "G",
	"non-goals": "NG",
	features: "F",
	constraints: "C",
	"open-questions": "Q",
	"data-models": "D",
	integrations: "I",
	dependencies: "DEP",
	risks: "R",
	testing: "T",
};
