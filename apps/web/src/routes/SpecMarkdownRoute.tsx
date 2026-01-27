import { fetchWorkspaceSpec } from "@/api/client";
import { specToMarkdown } from "@/components/spec-writer/lib/markdown";
import { useEffect, useState } from "react";
import { useParams } from "wouter";

/**
 * Route that outputs raw markdown for a spec.
 * Handles /projects/:projectId/spec-writer/:specSlug.md
 */
export function SpecMarkdownRoute() {
	const params = useParams<{ projectId?: string; specSlug?: string }>();
	const { projectId } = params;
	// Remove .md extension from specSlug
	const specSlug = params.specSlug?.replace(/\.md$/, "");

	const [markdown, setMarkdown] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!projectId || !specSlug) return;

		const controller = new AbortController();

		fetchWorkspaceSpec(projectId, specSlug, controller.signal)
			.then((response) => {
				const md = specToMarkdown(response.spec);
				setMarkdown(md);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setError(err.message || "Failed to load spec");
			});

		return () => controller.abort();
	}, [projectId, specSlug]);

	if (!projectId || !specSlug) {
		return <pre>Missing project ID or spec slug</pre>;
	}

	if (error) {
		return <pre>Error: {error}</pre>;
	}

	if (markdown === null) {
		return <pre>Loading...</pre>;
	}

	return (
		<pre
			style={{
				margin: 0,
				padding: "1rem",
				whiteSpace: "pre-wrap",
				fontFamily: "monospace",
				background: "#0a0a0a",
				color: "#e0e0e0",
				minHeight: "100vh",
			}}
		>
			{markdown}
		</pre>
	);
}
