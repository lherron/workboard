import type { SpecDocument, SpecItem, SpecSection, SpecSectionKind } from "@webwrkq/shared";

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
	}

	return lines.join("\n");
}

/**
 * Section kind to label mapping
 */
const SECTION_LABELS: Record<string, SpecSectionKind> = {
	goals: "goals",
	"non-goals": "non-goals",
	"non goals": "non-goals",
	nongoals: "non-goals",
	features: "features",
	constraints: "constraints",
	"open questions": "open-questions",
	"open-questions": "open-questions",
	questions: "open-questions",
	"data models": "data-models",
	"data-models": "data-models",
	datamodels: "data-models",
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
 * Parse markdown to a spec document structure.
 * This is a tolerant parser that tries to preserve as much structure as possible.
 *
 * Note: This returns partial updates to merge with existing spec.
 * The caller should handle merging with the canonical JSON.
 */
/**
 * Scroll target for editor navigation from graph clicks.
 */
export type ScrollTarget = {
	type: "root" | "section" | "item";
	id: string;
};

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
			// The target.id is the section.id (e.g., "features", "goals")
			if (line.startsWith("## ") && !line.startsWith("### ")) {
				const label = line.slice(3).trim().toLowerCase();
				const normalizedTarget = target.id.toLowerCase().replace(/-/g, " ");
				// Match on normalized label or id
				if (label === normalizedTarget || label.replace(/\s+/g, "-") === target.id.toLowerCase()) {
					return lineNum;
				}
			}
		} else if (target.type === "item") {
			// Item heading: ### ID: Summary
			if (line.startsWith("### ")) {
				const headingText = line.slice(4).trim();
				// Check if the line starts with the item ID
				if (headingText.toUpperCase().startsWith(`${target.id.toUpperCase()}:`)) {
					return lineNum;
				}
			}
		}
	}

	return null;
}

export function markdownToSpec(markdown: string, existingSpec?: SpecDocument): MarkdownParseResult {
	const lines = markdown.split("\n");
	const diagnostics: ParseDiagnostic[] = [];

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

			const label = line.slice(3).trim();
			const kind = parseSectionLabel(label);

			if (!kind) {
				diagnostics.push({
					line: lineNum,
					message: `Unknown section: "${label}"`,
					severity: "warning",
				});
			}

			currentSection = {
				id: kind || label.toLowerCase().replace(/\s+/g, "-"),
				kind: kind || "features", // Default to features for unknown sections
				label: label,
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
				currentItem.body = bodyLines.join("\n").trim();
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
						message: "Item found outside of a section",
						severity: "warning",
					});
				}
			} else {
				diagnostics.push({
					line: lineNum,
					message: `Invalid item format: "${headingText}". Expected "ID: Summary" format.`,
					severity: "warning",
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
			// Content between section heading and first item - could be section description
			// For now, ignore it
		}
	}

	// Save final item body
	if (currentItem && bodyLines.length > 0) {
		currentItem.body = bodyLines.join("\n").trim();
	}

	// Save final section
	if (currentSection) {
		sections.push(currentSection);
	}

	// Save overview if still collecting
	if (inOverview && overviewLines.length > 0) {
		overview = overviewLines.join("\n").trim();
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
