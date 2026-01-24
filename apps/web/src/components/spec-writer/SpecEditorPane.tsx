import type { ApiClientError } from "@/api/client";
import { updateWorkspaceSpec } from "@/api/client";
import { cn } from "@/lib/utils";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import type { SpecDocument } from "@workboard/shared";
import { basicSetup } from "codemirror";
import { AlertTriangle, Code, Eye, FileText, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import {
	type ParseDiagnostic,
	type ScrollTarget,
	findTargetLine,
	markdownToSpec,
	specToMarkdown,
} from "./lib/markdown";

type Props = {
	workspaceId: string;
	spec: SpecDocument | null;
	loading: boolean;
	error: ApiClientError | null;
	isDirty: boolean;
	scrollTarget: ScrollTarget | null;
	onSpecUpdate: (spec: SpecDocument) => void;
	onSaveComplete: (spec: SpecDocument) => void;
	onReload?: () => void;
};

// Feature flag: "editor" for CodeMirror, "renderer" for ReactMarkdown
type ViewMode = "editor" | "renderer";

function loadViewModePreference(): ViewMode {
	try {
		if (typeof window === "undefined") return "editor";
		const raw = window.localStorage.getItem("specWriter.viewMode");
		return raw === "renderer" ? "renderer" : "editor";
	} catch {
		return "editor";
	}
}

function persistViewModePreference(value: ViewMode) {
	try {
		if (typeof window === "undefined") return;
		window.localStorage.setItem("specWriter.viewMode", value);
	} catch {
		// ignore
	}
}

// Debounce delay for parsing markdown changes (ms)
const PARSE_DEBOUNCE_MS = 500;
// Debounce delay for autosave after valid changes (ms)
const AUTOSAVE_DEBOUNCE_MS = 2000;

function computeSpecSignature(spec: SpecDocument): string {
	const sections = [...spec.sections]
		.sort((a, b) => a.order - b.order)
		.map((section) => ({
			id: section.id,
			kind: section.kind,
			label: section.label,
			order: section.order,
			items: [...section.items]
				.sort((a, b) => a.order - b.order)
				.map((item) => ({
					id: item.id,
					summary: item.summary,
					body: item.body,
					status: item.status,
					order: item.order,
				})),
		}));

	return JSON.stringify({
		title: spec.title,
		overview: spec.overview,
		sections,
	});
}

function computeSinglePatch(
	oldText: string,
	newText: string,
): { from: number; to: number; insert: string } | null {
	if (oldText === newText) return null;

	let start = 0;
	const minLen = Math.min(oldText.length, newText.length);
	while (start < minLen && oldText.charCodeAt(start) === newText.charCodeAt(start)) {
		start++;
	}

	let endOld = oldText.length;
	let endNew = newText.length;
	while (
		endOld > start &&
		endNew > start &&
		oldText.charCodeAt(endOld - 1) === newText.charCodeAt(endNew - 1)
	) {
		endOld--;
		endNew--;
	}

	return {
		from: start,
		to: endOld,
		insert: newText.slice(start, endNew),
	};
}

/**
 * Center pane for viewing/editing spec content.
 * Supports two modes:
 * - "editor": CodeMirror markdown editor with bidirectional sync
 * - "renderer": Read-only ReactMarkdown preview
 */
export function SpecEditorPane({
	workspaceId,
	spec,
	loading,
	error,
	isDirty,
	scrollTarget,
	onSpecUpdate,
	onSaveComplete,
	onReload,
}: Props) {
	const [viewMode, setViewMode] = useState<ViewMode>(loadViewModePreference);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<{ message: string; status?: number } | null>(null);
	const [diagnostics, setDiagnostics] = useState<ParseDiagnostic[]>([]);

	// Refs for CodeMirror (mutable ref for callback ref pattern)
	const editorContainerRef = useRef<HTMLDivElement | null>(null);
	const editorViewRef = useRef<EditorView | null>(null);

	// Ref for renderer scroll
	const rendererRef = useRef<HTMLDivElement>(null);

	// Track if we're syncing from external source to avoid feedback loops
	const isSyncingFromExternalRef = useRef(false);
	// Track the last spec ID to detect spec changes
	const lastSpecIdRef = useRef<string | null>(null);

	// Track if the most recent spec update originated from this editor
	const pendingEditorSpecUpdateRef = useRef(false);
	const lastEditorDrivenSignatureRef = useRef<string | null>(null);
	// Debounce timers
	const parseTimerRef = useRef<number | null>(null);
	const autosaveTimerRef = useRef<number | null>(null);
	// Store current spec for use in callbacks
	const specRef = useRef<SpecDocument | null>(null);
	specRef.current = spec;

	// Persist view mode preference
	useEffect(() => {
		persistViewModePreference(viewMode);
	}, [viewMode]);

	// Convert spec to markdown for renderer mode
	const markdownContent = useMemo(() => {
		if (!spec) return "";
		return specToMarkdown(spec);
	}, [spec]);

	// Handle save
	const handleSave = useCallback(async () => {
		const currentSpec = specRef.current;
		if (!currentSpec || !isDirty || isSaving) return;

		setIsSaving(true);
		setSaveError(null);

		try {
			const response = await updateWorkspaceSpec(
				workspaceId,
				currentSpec.slug,
				currentSpec,
				currentSpec.rev,
			);
			onSaveComplete(response.spec);
		} catch (err) {
			const apiError = err as ApiClientError;
			setSaveError({ message: apiError.message, status: apiError.status });
		} finally {
			setIsSaving(false);
		}
	}, [isDirty, isSaving, workspaceId, onSaveComplete]);

	// Handle reload after conflict
	const handleReload = useCallback(() => {
		setSaveError(null);
		onReload?.();
	}, [onReload]);

	// Check if we have a 409 conflict
	const isConflict = saveError?.status === 409;

	// CodeMirror theme customization
	const editorTheme = useMemo(
		() =>
			EditorView.theme({
				"&": {
					height: "100%",
					fontSize: "13px",
					fontFamily: "'JetBrains Mono', monospace",
				},
				".cm-content": {
					padding: "16px 0",
				},
				".cm-line": {
					padding: "0 16px",
				},
				".cm-gutters": {
					backgroundColor: "transparent",
					borderRight: "1px solid hsl(var(--border) / 0.3)",
					color: "hsl(var(--muted-foreground) / 0.5)",
				},
				".cm-activeLineGutter": {
					backgroundColor: "hsl(var(--secondary) / 0.3)",
				},
				".cm-activeLine": {
					backgroundColor: "hsl(var(--secondary) / 0.2)",
				},
				"&.cm-focused .cm-cursor": {
					borderLeftColor: "hsl(var(--primary))",
				},
				"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
					backgroundColor: "hsl(var(--primary) / 0.3)",
				},
			}),
		[],
	);

	// Track container mount state to trigger editor creation
	const [containerMounted, setContainerMounted] = useState(false);

	// Ref callback to detect when container is mounted
	const setContainerRef = useCallback((node: HTMLDivElement | null) => {
		editorContainerRef.current = node;
		setContainerMounted(!!node);
	}, []);

	// Stable refs for callbacks - allows effect to access latest without re-running
	const onSpecUpdateRef = useRef(onSpecUpdate);
	const onSaveCompleteRef = useRef(onSaveComplete);
	const handleSaveRef = useRef(handleSave);
	const workspaceIdRef = useRef(workspaceId);

	// Keep refs updated
	useEffect(() => {
		onSpecUpdateRef.current = onSpecUpdate;
		onSaveCompleteRef.current = onSaveComplete;
		handleSaveRef.current = handleSave;
		workspaceIdRef.current = workspaceId;
	});

	// Track spec ID separately to control when editor is recreated
	const specId = spec?.id ?? null;

	// Initialize/destroy CodeMirror editor based on view mode
	// IMPORTANT: Only recreate editor when viewMode or specId changes, NOT on every spec update
	useEffect(() => {
		// Only create editor in editor mode
		if (viewMode !== "editor") {
			// Destroy existing editor if switching to renderer
			if (editorViewRef.current) {
				editorViewRef.current.destroy();
				editorViewRef.current = null;
			}
			return;
		}

		// Wait for container to be mounted and spec to be loaded
		if (!editorContainerRef.current || !specRef.current) {
			return;
		}

		// If editor already exists, don't recreate (sync effect handles content updates)
		if (editorViewRef.current) {
			return;
		}

		const currentSpec = specRef.current;
		const initialContent = specToMarkdown(currentSpec);

		console.log("[SpecEditorPane] Creating CodeMirror editor", {
			hasContainer: !!editorContainerRef.current,
			containerDimensions: editorContainerRef.current
				? {
						width: editorContainerRef.current.offsetWidth,
						height: editorContainerRef.current.offsetHeight,
					}
				: null,
			specId: currentSpec.id,
			specTitle: currentSpec.title,
			contentLength: initialContent.length,
		});

		// Create update listener - uses refs to access latest values without causing effect re-runs
		const updateListener = EditorView.updateListener.of((update) => {
			if (update.docChanged) {
				const content = update.state.doc.toString();
				if (!isSyncingFromExternalRef.current) {
					if (parseTimerRef.current) {
						window.clearTimeout(parseTimerRef.current);
					}
					parseTimerRef.current = window.setTimeout(() => {
						const latestSpec = specRef.current;
						if (!latestSpec || isSyncingFromExternalRef.current) return;

						const result = markdownToSpec(content, latestSpec);
						setDiagnostics(result.diagnostics);

						if (!result.success || !result.spec) {
							if (autosaveTimerRef.current) {
								window.clearTimeout(autosaveTimerRef.current);
								autosaveTimerRef.current = null;
							}
							return;
						}

						const updatedSpec: SpecDocument = {
							...latestSpec,
							title: result.spec.title ?? latestSpec.title,
							overview: result.spec.overview ?? latestSpec.overview,
							sections: result.spec.sections ?? latestSpec.sections,
							metadata: {
								...latestSpec.metadata,
								updatedAt: Date.now(),
							},
						};

						lastEditorDrivenSignatureRef.current = computeSpecSignature(updatedSpec);
						pendingEditorSpecUpdateRef.current = true;

						onSpecUpdateRef.current(updatedSpec);

						if (autosaveTimerRef.current) {
							window.clearTimeout(autosaveTimerRef.current);
						}
						autosaveTimerRef.current = window.setTimeout(() => {
							const specToSave = specRef.current;
							if (specToSave) {
								updateWorkspaceSpec(
									workspaceIdRef.current,
									specToSave.slug,
									specToSave,
									specToSave.rev,
								)
									.then((response) => onSaveCompleteRef.current(response.spec))
									.catch((err) => {
										const apiError = err as ApiClientError;
										setSaveError({ message: apiError.message, status: apiError.status });
									});
							}
						}, AUTOSAVE_DEBOUNCE_MS);
					}, PARSE_DEBOUNCE_MS);
				}
			}
		});

		const view = new EditorView({
			doc: initialContent,
			extensions: [
				basicSetup,
				markdown(),
				oneDark,
				editorTheme,
				updateListener,
				keymap.of([
					{
						key: "Mod-s",
						run: () => {
							handleSaveRef.current();
							return true;
						},
					},
				]),
				EditorView.lineWrapping,
			],
			parent: editorContainerRef.current,
		});

		editorViewRef.current = view;
		lastSpecIdRef.current = currentSpec.id;

		console.log("[SpecEditorPane] CodeMirror editor created", {
			docLength: view.state.doc.length,
		});

		return () => {
			console.log("[SpecEditorPane] Destroying CodeMirror editor");
			view.destroy();
			editorViewRef.current = null;
		};
		// Only recreate editor when viewMode, specId, or container mount state changes
		// biome-ignore lint/correctness/useExhaustiveDependencies: specId and containerMounted are intentional triggers
	}, [viewMode, specId, containerMounted, editorTheme]);

	// Sync editor content when spec changes (only in editor mode)
	// IMPORTANT: Only update editor content when:
	// 1. Spec ID changes (user selected a different spec)
	// 2. Content changed externally (e.g., agent updated via API, NOT from our own save)
	// Never update the editor for our own save roundtrips - this disrupts cursor position.
	useEffect(() => {
		if (viewMode !== "editor") return;

		const view = editorViewRef.current;
		if (!view || !spec) {
			return;
		}

		const specIdChanged = lastSpecIdRef.current !== spec.id;
		lastSpecIdRef.current = spec.id;

		const incomingSignature = computeSpecSignature(spec);

		// Case 1: Different spec selected - full replacement is needed
		if (specIdChanged) {
			const nextDoc = specToMarkdown(spec);
			console.log("[SpecEditorPane] Sync: spec ID changed, replacing content", {
				newSpecId: spec.id,
				contentLength: nextDoc.length,
			});

			isSyncingFromExternalRef.current = true;
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: nextDoc,
				},
			});

			setDiagnostics([]);
			lastEditorDrivenSignatureRef.current = incomingSignature;
			pendingEditorSpecUpdateRef.current = false;

			requestAnimationFrame(() => {
				isSyncingFromExternalRef.current = false;
			});
			return;
		}

		// Case 2: This update was triggered by our own edit - don't touch editor
		if (pendingEditorSpecUpdateRef.current) {
			console.log("[SpecEditorPane] Sync: skipping (pending editor update)");
			pendingEditorSpecUpdateRef.current = false;
			lastEditorDrivenSignatureRef.current = incomingSignature;
			return;
		}

		// Case 3: Signature matches what we last sent - this is our save roundtrip, skip
		if (
			lastEditorDrivenSignatureRef.current &&
			lastEditorDrivenSignatureRef.current === incomingSignature
		) {
			console.log("[SpecEditorPane] Sync: skipping (signature unchanged)");
			return;
		}

		// Case 4: Content changed externally (agent, another user, etc.) - need to sync
		// Only update if semantic content actually changed
		const nextDoc = specToMarkdown(spec);
		const currentDoc = view.state.doc.toString();

		if (currentDoc === nextDoc) {
			// Markdown is identical, just update signature tracking
			console.log("[SpecEditorPane] Sync: skipping (markdown identical)");
			lastEditorDrivenSignatureRef.current = incomingSignature;
			return;
		}

		console.log("[SpecEditorPane] Sync: external change detected, applying patch", {
			oldSignature: lastEditorDrivenSignatureRef.current?.slice(0, 50),
			newSignature: incomingSignature.slice(0, 50),
		});

		isSyncingFromExternalRef.current = true;

		const patch = computeSinglePatch(currentDoc, nextDoc);
		if (patch) {
			view.dispatch({ changes: patch });
		}

		setDiagnostics([]);
		lastEditorDrivenSignatureRef.current = incomingSignature;

		requestAnimationFrame(() => {
			isSyncingFromExternalRef.current = false;
		});
	}, [spec, viewMode]);

	// Keyboard shortcut for save
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault();
				handleSave();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleSave]);

	// Cleanup timers on unmount
	useEffect(() => {
		return () => {
			if (parseTimerRef.current) window.clearTimeout(parseTimerRef.current);
			if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
		};
	}, []);

	// Handle scroll target from graph node clicks - editor mode
	useEffect(() => {
		if (viewMode !== "editor") return;

		const view = editorViewRef.current;
		if (!view || !scrollTarget || !spec) return;

		const markdown = view.state.doc.toString();
		const lineNum = findTargetLine(markdown, scrollTarget);

		if (lineNum !== null) {
			const line = view.state.doc.line(lineNum);
			const pos = line.from;

			view.dispatch({
				selection: { anchor: pos, head: pos },
				scrollIntoView: true,
				effects: EditorView.scrollIntoView(pos, { y: "center" }),
			});

			view.focus();
		}
	}, [scrollTarget, spec, viewMode]);

	// Handle scroll target from graph node clicks - renderer mode
	useEffect(() => {
		if (viewMode !== "renderer") return;
		if (!scrollTarget || !spec || !rendererRef.current) return;

		let selector = "";
		if (scrollTarget.type === "root") {
			selector = "h1";
		} else if (scrollTarget.type === "section") {
			selector = "h2";
		} else if (scrollTarget.type === "item") {
			selector = "h3";
		}

		const elements = Array.from(rendererRef.current.querySelectorAll(selector));
		for (const el of elements) {
			const text = el.textContent || "";
			if (
				scrollTarget.type === "item" &&
				text.toUpperCase().startsWith(scrollTarget.id.toUpperCase())
			) {
				el.scrollIntoView({ behavior: "smooth", block: "center" });
				el.classList.add("bg-primary/20");
				setTimeout(() => el.classList.remove("bg-primary/20"), 2000);
				return;
			}
			if (scrollTarget.type === "section") {
				const normalizedTarget = scrollTarget.id.toLowerCase().replace(/-/g, " ");
				const normalizedText = text.toLowerCase().trim();
				if (normalizedText === normalizedTarget || normalizedText.includes(normalizedTarget)) {
					el.scrollIntoView({ behavior: "smooth", block: "center" });
					el.classList.add("bg-primary/20");
					setTimeout(() => el.classList.remove("bg-primary/20"), 2000);
					return;
				}
			}
			if (scrollTarget.type === "root") {
				el.scrollIntoView({ behavior: "smooth", block: "start" });
				return;
			}
		}
	}, [scrollTarget, spec, viewMode]);

	// Loading state
	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<p className="text-sm font-mono text-muted-foreground animate-pulse">Loading spec...</p>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center space-y-2">
					<p className="text-sm font-mono text-destructive">{error.message}</p>
				</div>
			</div>
		);
	}

	// Empty state
	if (!spec) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center space-y-2">
					<p className="text-sm font-mono text-muted-foreground">Select or create a spec</p>
					<p className="text-xs font-mono text-muted-foreground/60">
						Use the left panel to get started
					</p>
				</div>
			</div>
		);
	}

	const hasErrors = diagnostics.some((d) => d.severity === "error");
	const hasWarnings = diagnostics.some((d) => d.severity === "warning");

	return (
		<div className="flex-1 flex flex-col min-h-0">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-border/30 flex-shrink-0">
				<div className="flex items-center gap-2 min-w-0">
					<FileText size={14} className="text-muted-foreground" />
					<span className="text-sm font-mono font-medium truncate">{spec.title}</span>
					{isDirty && (
						<span className="text-warning text-xs" title="Unsaved changes">
							*
						</span>
					)}
					<span className="text-xs font-mono text-muted-foreground/50">v{spec.version}</span>
				</div>

				<div className="flex items-center gap-2">
					{/* View mode toggle */}
					<div className="flex items-center border border-border/30 rounded">
						<button
							type="button"
							onClick={() => setViewMode("editor")}
							className={cn(
								"p-1.5 transition-colors",
								viewMode === "editor"
									? "bg-primary/20 text-primary"
									: "text-muted-foreground hover:text-foreground",
							)}
							title="Editor mode"
						>
							<Code size={12} />
						</button>
						<button
							type="button"
							onClick={() => setViewMode("renderer")}
							className={cn(
								"p-1.5 transition-colors",
								viewMode === "renderer"
									? "bg-primary/20 text-primary"
									: "text-muted-foreground hover:text-foreground",
							)}
							title="Preview mode"
						>
							<Eye size={12} />
						</button>
					</div>

					{saveError && !isConflict && (
						<span className="text-xs font-mono text-destructive">{saveError.message}</span>
					)}

					{isConflict && onReload && (
						<button
							type="button"
							onClick={handleReload}
							className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30 transition-colors"
							title="Reload latest version"
						>
							<RefreshCw size={12} />
							<span>reload</span>
						</button>
					)}

					{viewMode === "editor" && (
						<button
							type="button"
							onClick={handleSave}
							disabled={!isDirty || isSaving || isConflict || hasErrors}
							className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							title="Save (Cmd/Ctrl+S)"
						>
							<Save size={12} />
							<span>{isSaving ? "saving..." : "save"}</span>
						</button>
					)}
				</div>
			</div>

			{/* Conflict banner */}
			{isConflict && (
				<div className="flex items-center gap-2 px-4 py-2 border-b bg-warning/10 border-warning/30 text-xs font-mono text-warning">
					<AlertTriangle size={14} className="flex-shrink-0" />
					<span className="flex-1">
						This spec was modified externally. Your unsaved changes may conflict with the latest
						version.
					</span>
					{onReload && (
						<button
							type="button"
							onClick={handleReload}
							className="flex items-center gap-1 px-2 py-0.5 bg-warning/20 border border-warning/30 hover:bg-warning/30 transition-colors"
						>
							<RefreshCw size={10} />
							<span>Reload</span>
						</button>
					)}
				</div>
			)}

			{/* Parse diagnostics banner - only in editor mode */}
			{viewMode === "editor" && (hasErrors || hasWarnings) && (
				<div
					className={cn(
						"flex items-start gap-2 px-4 py-2 border-b text-xs font-mono",
						hasErrors
							? "bg-destructive/10 border-destructive/30 text-destructive"
							: "bg-warning/10 border-warning/30 text-warning",
					)}
				>
					<AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
					<div className="flex-1">
						{diagnostics.slice(0, 3).map((d, i) => (
							<div key={i}>
								Line {d.line}: {d.message}
							</div>
						))}
						{diagnostics.length > 3 && (
							<div className="opacity-70">...and {diagnostics.length - 3} more</div>
						)}
						{hasErrors && (
							<div className="mt-1 opacity-70">Autosave paused until errors are fixed.</div>
						)}
					</div>
				</div>
			)}

			{/* Content area - switches between editor and renderer */}
			{viewMode === "editor" ? (
				<div ref={setContainerRef} className="flex-1 min-h-0 overflow-hidden" />
			) : (
				<div ref={rendererRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
					<div
						className={cn(
							"max-w-none font-mono text-[13px]",
							"[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:border-b [&_h1]:border-border/30 [&_h1]:pb-2 [&_h1]:mb-4",
							"[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-primary [&_h2]:mt-6 [&_h2]:mb-3",
							"[&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground/90 [&_h3]:mt-4 [&_h3]:mb-2",
							"[&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:mb-3",
							"[&_strong]:text-foreground [&_strong]:font-semibold",
							"[&_em]:text-muted-foreground/80 [&_em]:italic",
							"[&_code]:text-primary [&_code]:bg-secondary/50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs",
							"[&_pre]:bg-secondary/30 [&_pre]:border [&_pre]:border-border/30 [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:mb-4",
							"[&_pre_code]:bg-transparent [&_pre_code]:p-0",
							"[&_ul]:text-muted-foreground [&_ul]:ml-4 [&_ul]:mb-3 [&_ul]:list-disc",
							"[&_ol]:text-muted-foreground [&_ol]:ml-4 [&_ol]:mb-3 [&_ol]:list-decimal",
							"[&_li]:mb-1 [&_li]:marker:text-primary/50",
							"[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80",
							"[&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground/80 [&_blockquote]:italic [&_blockquote]:mb-3",
							"[&_table]:w-full [&_table]:mb-4 [&_table]:text-xs",
							"[&_th]:text-left [&_th]:text-muted-foreground [&_th]:font-semibold [&_th]:pb-2 [&_th]:border-b [&_th]:border-border/30",
							"[&_td]:py-2 [&_td]:text-muted-foreground [&_td]:border-b [&_td]:border-border/20",
							"[&_h1]:transition-colors [&_h2]:transition-colors [&_h3]:transition-colors",
						)}
					>
						<ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
							{markdownContent}
						</ReactMarkdown>
					</div>
				</div>
			)}

			{/* Footer status bar */}
			<div className="flex items-center justify-between px-4 py-1.5 border-t border-border/20 bg-secondary/20 flex-shrink-0">
				<span className="text-[10px] font-mono text-muted-foreground/50">
					rev {spec.rev} | {spec.sections.reduce((acc, s) => acc + s.items.length, 0)} items
				</span>
				<span className="text-[10px] font-mono text-muted-foreground/50">
					{new Date(spec.metadata.updatedAt).toLocaleString()}
				</span>
			</div>
		</div>
	);
}
