import {
	DEFAULT_SPEC_SECTIONS,
	SECTION_ID_PREFIX,
	type SpecDocument,
	type SpecItem,
	type SpecSection,
	type SpecSectionKind,
} from "@workboard/shared";

export type SpecTemplateId = "feature" | "api-integration" | "migration" | "blank";

type TemplateItem = {
	summary: string;
	body?: string;
	status?: SpecItem["status"];
};

type TemplateSection = {
	kind: SpecSectionKind;
	label: string;
	items?: TemplateItem[];
};

export type SpecTemplate = {
	id: SpecTemplateId;
	name: string;
	description: string;
	hint?: string;
	sections: TemplateSection[];
	overview?: string;
};

function pad3(n: number): string {
	return String(n).padStart(3, "0");
}

function buildSections(templateSections: TemplateSection[]): SpecSection[] {
	return templateSections.map((section, sectionOrder) => {
		const prefix = SECTION_ID_PREFIX[section.kind] || "I";

		const items: SpecItem[] = (section.items || []).map((item, idx) => ({
			id: `${prefix}-${pad3(idx + 1)}`,
			summary: item.summary,
			body: item.body || "",
			status: item.status || "draft",
			order: idx,
		}));

		return {
			id: section.kind,
			kind: section.kind,
			label: section.label,
			order: sectionOrder,
			items,
		};
	});
}

export const SPEC_TEMPLATES: SpecTemplate[] = [
	{
		id: "feature",
		name: "Feature spec",
		description: "Default structure for product/engineering features.",
		hint: "Good for a single feature or a small bundle of related changes.",
		overview: "",
		sections: [
			{
				kind: "goals",
				label: "Goals",
				items: [
					{
						summary: "Define the user and business outcomes",
						body: "Who benefits? What measurable outcomes change?",
					},
				],
			},
			{
				kind: "non-goals",
				label: "Non-goals",
				items: [
					{
						summary: "Explicitly list what is out of scope",
						body: "Clarify boundaries to prevent scope creep.",
					},
				],
			},
			{
				kind: "features",
				label: "Features",
				items: [
					{
						summary: "Describe the key functionality",
						body: "Include behavior, edge cases, and UX notes if relevant.",
					},
				],
			},
			{
				kind: "constraints",
				label: "Constraints",
				items: [
					{
						summary: "List technical, legal, or operational constraints",
						body: "Performance targets, compatibility, rollout constraints, etc.",
					},
				],
			},
			{
				kind: "open-questions",
				label: "Open Questions",
				items: [
					{
						summary: "Questions blocking implementation decisions",
						body: "Capture unknowns; resolve before build.",
					},
				],
			},
		],
	},
	{
		id: "api-integration",
		name: "API / integration",
		description: "Good for new endpoints, third-party integrations, and data contracts.",
		hint: "Emphasizes data models, dependencies, and testing.",
		overview: "",
		sections: [
			{
				kind: "goals",
				label: "Goals",
				items: [{ summary: "What are we enabling or improving?", body: "" }],
			},
			{
				kind: "non-goals",
				label: "Non-goals",
				items: [{ summary: "Explicitly out of scope", body: "" }],
			},
			{
				kind: "integrations",
				label: "Integrations",
				items: [
					{
						summary: "Describe external systems and contracts",
						body: "Auth, rate limits, SLAs, failure handling, retries, idempotency.",
					},
				],
			},
			{
				kind: "data-models",
				label: "Data Models",
				items: [
					{
						summary: "Define request/response schemas and persistence models",
						body: "Include field semantics, optionality, and versioning plan.",
					},
				],
			},
			{
				kind: "dependencies",
				label: "Dependencies",
				items: [{ summary: "Upstream/downstream dependencies and ownership", body: "" }],
			},
			{
				kind: "constraints",
				label: "Constraints",
				items: [{ summary: "Security, compliance, latency, and rollout constraints", body: "" }],
			},
			{
				kind: "risks",
				label: "Risks",
				items: [{ summary: "Identify risks and mitigations", body: "" }],
			},
			{
				kind: "testing",
				label: "Testing",
				items: [{ summary: "Test plan: unit, integration, load, and failure modes", body: "" }],
			},
			{
				kind: "open-questions",
				label: "Open Questions",
				items: [{ summary: "Unknowns to resolve", body: "" }],
			},
		],
	},
	{
		id: "migration",
		name: "Migration / refactor",
		description: "For architectural changes, migrations, and risky refactors.",
		hint: "Centers plan, dependencies, and risk management.",
		overview: "",
		sections: [
			{
				kind: "goals",
				label: "Goals",
				items: [{ summary: "Target end state and success criteria", body: "" }],
			},
			{
				kind: "non-goals",
				label: "Non-goals",
				items: [{ summary: "What we are not changing", body: "" }],
			},
			{
				kind: "features",
				label: "Plan",
				items: [
					{
						summary: "Step-by-step migration / refactor plan",
						body: "Include sequencing, gating, and rollback strategy.",
					},
				],
			},
			{
				kind: "dependencies",
				label: "Dependencies",
				items: [{ summary: "Systems, teams, and prerequisite work", body: "" }],
			},
			{
				kind: "constraints",
				label: "Constraints",
				items: [{ summary: "Operational limits: downtime, backfills, compatibility", body: "" }],
			},
			{
				kind: "risks",
				label: "Risks",
				items: [{ summary: "Risks, detection signals, mitigations", body: "" }],
			},
			{
				kind: "testing",
				label: "Testing",
				items: [{ summary: "Verification strategy and rollout checks", body: "" }],
			},
			{
				kind: "open-questions",
				label: "Open Questions",
				items: [{ summary: "Unknowns to resolve", body: "" }],
			},
		],
	},
	{
		id: "blank",
		name: "Blank",
		description: "Start from the minimal default sections with no items.",
		hint: "Useful when you want full control over structure and content.",
		overview: "",
		sections: DEFAULT_SPEC_SECTIONS.map((s) => ({
			kind: s.kind,
			label: s.label,
			items: [],
		})),
	},
];

export function applyTemplateToSpec(spec: SpecDocument, templateId: SpecTemplateId): SpecDocument {
	const template = SPEC_TEMPLATES.find((t) => t.id === templateId) || SPEC_TEMPLATES[0];

	return {
		...spec,
		overview: template.overview ?? spec.overview ?? "",
		sections: buildSections(template.sections),
		metadata: {
			...spec.metadata,
			updatedAt: Date.now(),
		},
	};
}
