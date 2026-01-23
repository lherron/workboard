import type { SpecDocument, SpecItem, SpecSection, SpecSectionKind } from "@workboard/shared";

/**
 * Parse diagnostic for markdown parsing issues
 */
export type ParseDiagnostic = {
	line: number;
	message: string;
	severity: "warning" | "error";
};

/**
 * Result of parsing markdown to spec
 */
export type MarkdownParseResult = {
	success: boolean;
	spec: Partial<SpecDocument> | null;
	diagnostics: ParseDiagnostic[];
};

/**
 * Render a spec document to markdown format.
 *
 * Format:
 * # {title}
 *
 * {overview}
 *
 * ## {section.label}
 *
 * ### {item.id}: {item.summary} [{status}]
 *
 * {item.body}
 */
export function specToMarkdown(spec: SpecDocument): string {
	const lines: string[] = [];

	// Title
	lines.push(`# ${spec.title}`);
	lines.push("");

	// Overview
	if (spec.overview.trim()) {
		lines.push(spec.overview.trim());
		lines.push("");
	}

	// Sections sorted by order
	const sortedSections = [...spec.sections].sort((a, b) => a.order - b.order);

	for (const section of sortedSections) {
		lines.push(`## ${section.label}`);
		lines.push("");

		// Items sorted by order
		const sortedItems = [...section.items].sort((a, b) => a.order - b.order);

		for (const item of sortedItems) {
			// Include status only if not draft (draft is default)
			const statusSuffix = item.status !== "draft" ? ` [${item.status}]` : "";
			lines.push(`### ${item.id}: ${item.summary}${statusSuffix}`);
			lines.push("");

			if (item.body.trim()) {
				lines.push(item.body.trim());
				lines.push("");
			}
		}

		lines.push("");
	}

	return lines.join("\n").trim();
}

// Section label to kind mapping
const SECTION_LABELS: Record<string, SpecSectionKind> = {
	goals: "goals",
	goal: "goals",
	"non-goals": "non-goals",
	"non goals": "non-goals",
	nongoals: "non-goals",
	features: "features",
	feature: "features",
	constraints: "constraints",
	constraint: "constraints",
	"open questions": "open-questions",
	"open question": "open-questions",
	questions: "open-questions",
	"data models": "data-models",
	"data model": "data-models",
	integrations: "integrations",
	dependencies: "dependencies",
	risks: "risks",
	testing: "testing",
	tests: "testing",
};

/**
 * Parse a section label to get its kind
 */
function parseSectionLabel(label: string): SpecSectionKind | null {
	const normalized = label.toLowerCase().trim();
	return SECTION_LABELS[normalized] || null;
}

const ALL_SECTION_KINDS: readonly SpecSectionKind[] = [
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
] as const;

function isSectionKind(value: string): value is SpecSectionKind {
	return (ALL_SECTION_KINDS as readonly string[]).includes(value);
}

/**
 * Parse item status from markdown
 */
function parseItemStatus(text: string): "draft" | "approved" | "deferred" {
	const match = text.match(/\[(draft|approved|deferred)\]\s*$/i);
	if (match) {
		return match[1].toLowerCase() as "draft" | "approved" | "deferred";
	}
	return "draft";
}

/**
 * Scroll target for editor navigation from graph clicks.
 */
export type ScrollTarget = {
	type: "root" | "section" | "item";
	id: string;
};

function slugifyHeading(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function parseHeadingWithMeta(raw: string): { label: string; meta: Record<string, string> } {
	// Supports: "Label <!-- kind:goals id:goals -->" (comment at end)
	const metaMatch = raw.match(/^(.*?)\s*<!--\s*([\s\S]*?)\s*-->\s*$/);
	if (!metaMatch) {
		return { label: raw.trim(), meta: {} };
	}

	const label = metaMatch[1].trim();
	const metaStr = metaMatch[2].trim();
	const meta: Record<string, string> = {};

	const kvRe = /(\w+)\s*[:=]\s*([^\s]+)/g;
	for (const m of metaStr.matchAll(kvRe)) {
		meta[m[1].toLowerCase()] = m[2];
	}

	return { label, meta };
}

/**
 * Find the line number for a section or item in markdown.
 * Returns 1-indexed line number, or null if not found.
 */
export function findTargetLine(markdown: string, target: ScrollTarget): number | null {
	const lines = markdown.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1; // 1-indexed

		if (target.type === "root") {
			// Title line: # ...
			if (line.startsWith("# ") && !line.startsWith("## ")) {
				return lineNum;
			}
		} else if (target.type === "section") {
			// Section heading: ## Label
			if (line.startsWith("## ") && !line.startsWith("### ")) {
				const raw = line.slice(3).trim();
				const { label, meta } = parseHeadingWithMeta(raw);

				// Prefer explicit id/kind markers, if present
				if (meta.id && meta.id.toLowerCase() === target.id.toLowerCase()) {
					return lineNum;
				}
				if (meta.kind && meta.kind.toLowerCase() === target.id.toLowerCase()) {
					return lineNum;
				}

				const normalizedTarget = target.id.toLowerCase().replace(/-/g, " ");
				const normalizedLabel = label.trim().toLowerCase();

				// Match on normalized label or id
				if (
					normalizedLabel === normalizedTarget ||
					slugifyHeading(normalizedLabel) === target.id.toLowerCase()
				) {
					return lineNum;
				}
			}
		} else if (target.type === "item") {
			// Item heading: ### ID: Summary
			if (line.startsWith("### ")) {
				const headingText = line.slice(4).trim();
				if (headingText.toUpperCase().startsWith(`${target.id.toUpperCase()}:`)) {
					return lineNum;
				}
			}
		}
	}

	return null;
}

/**
 * Parse markdown to a spec document structure.
 *
 * This parser is intentionally *safe*: if a formatting issue would cause a structural drop
 * (e.g. invalid item headings), it emits an "error" diagnostic so callers can block autosave.
 */
export function markdownToSpec(markdown: string, existingSpec?: SpecDocument): MarkdownParseResult {
	const lines = markdown.split("\n");
	const diagnostics: ParseDiagnostic[] = [];

	const existingSectionsByOrder = existingSpec
		? [...existingSpec.sections].sort((a, b) => a.order - b.order)
		: [];

	let title = existingSpec?.title || "";
	let overview = "";
	const sections: SpecSection[] = [];

	let currentSection: SpecSection | null = null;
	let currentItem: SpecItem | null = null;
	let bodyLines: string[] = [];
	let overviewLines: string[] = [];

	let inOverview = false;
	let sectionOrder = 0;
	let itemOrder = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;

		// Title (# ...)
		if (line.startsWith("# ") && !line.startsWith("## ")) {
			title = line.slice(2).trim();
			inOverview = true;
			continue;
		}

		// Section heading (## ...)
		if (line.startsWith("## ") && !line.startsWith("### ")) {
			// Save previous item body
			if (currentItem && bodyLines.length > 0) {
				currentItem.body = bodyLines.join("\n").trim();
				bodyLines = [];
			}

			// Save overview if we were collecting it
			if (inOverview && overviewLines.length > 0) {
				overview = overviewLines.join("\n").trim();
				overviewLines = [];
				inOverview = false;
			}

			// Save previous section
			if (currentSection) {
				sections.push(currentSection);
			}

			const rawHeading = line.slice(3).trim();
			const { label, meta } = parseHeadingWithMeta(rawHeading);

			let kind: SpecSectionKind | null = null;
			const metaKind = (meta.kind || "").toLowerCase();
			if (metaKind && isSectionKind(metaKind)) {
				kind = metaKind;
			} else {
				kind = parseSectionLabel(label);
			}

			let inferredFromExisting = false;
			if (!kind && existingSectionsByOrder[sectionOrder]) {
				kind = existingSectionsByOrder[sectionOrder].kind;
				inferredFromExisting = true;
				diagnostics.push({
					line: lineNum,
					message: `Unrecognized section label: "${label}". Assuming this is "${existingSectionsByOrder[sectionOrder].label}" (${kind}).`,
					severity: "warning",
				});
			}

			if (!kind) {
				diagnostics.push({
					line: lineNum,
					message: `Unknown section: "${label}". Use a supported section heading (e.g., Goals, Features, Constraints, Open Questions).`,
					severity: "error",
				});
			}

			const safeKind = (kind || "features") as SpecSectionKind;
			const id =
				meta.id ||
				(inferredFromExisting && existingSectionsByOrder[sectionOrder]
					? existingSectionsByOrder[sectionOrder].id
					: safeKind || slugifyHeading(label));

			currentSection = {
				id,
				kind: safeKind,
				label,
				order: sectionOrder++,
				items: [],
			};
			currentItem = null;
			itemOrder = 0;
			continue;
		}

		// Item heading (### ID: Summary [status])
		if (line.startsWith("### ")) {
			// Save previous item body
			if (currentItem && bodyLines.length > 0) {
				currentItem.body = bodyLines.join("\\n").trim();
				bodyLines = [];
			}

			// Parse item heading: ### F-001: Summary [status]
			const headingText = line.slice(4).trim();
			const match = headingText.match(
				/^([A-Z]+-\d+):\s*(.+?)(?:\s*\[(draft|approved|deferred)\])?\s*$/i,
			);

			if (match) {
				const [, id, summary] = match;
				const status = parseItemStatus(headingText);

				currentItem = {
					id: id.toUpperCase(),
					summary: summary.replace(/\s*\[(draft|approved|deferred)\]\s*$/i, "").trim(),
					body: "",
					status,
					order: itemOrder++,
				};

				if (currentSection) {
					currentSection.items.push(currentItem);
				} else {
					diagnostics.push({
						line: lineNum,
						message: "Item found outside of a section. Add a '## Section' heading above it.",
						severity: "error",
					});
				}
			} else {
				diagnostics.push({
					line: lineNum,
					message: `Invalid item format: "${headingText}". Expected "ID: Summary" (e.g., "F-001: Add login").`,
					severity: "error",
				});
			}
			continue;
		}

		// Content line - add to appropriate buffer
		if (inOverview && !currentSection) {
			overviewLines.push(line);
		} else if (currentItem) {
			bodyLines.push(line);
		} else if (currentSection) {
			// Content between section heading and first item - could be a section description.
			// The schema does not currently support section bodies, so we ignore it.
		}
	}

	// Save final item body
	if (currentItem && bodyLines.length > 0) {
		currentItem.body = bodyLines.join("\\n").trim();
	}

	// Save final section
	if (currentSection) {
		sections.push(currentSection);
	}

	// Save overview if still collecting
	if (inOverview && overviewLines.length > 0) {
		overview = overviewLines.join("\\n").trim();
	}

	// Guardrail: avoid accidental wipe of sections
	if (existingSpec && sections.length === 0) {
		diagnostics.push({
			line: 1,
			message: "No sections found. Specs require at least one '## Section' heading.",
			severity: "error",
		});
	}

	return {
		success: diagnostics.filter((d) => d.severity === "error").length === 0,
		spec: {
			title,
			overview,
			sections,
		},
		diagnostics,
	};
}
