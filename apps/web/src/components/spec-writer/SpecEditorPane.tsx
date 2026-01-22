import type { ApiClientError } from "@/api/client";
import { updateWorkspaceSpec } from "@/api/client";
import { cn } from "@/lib/utils";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import type { SpecDocument } from "@webwrkq/shared";
import { basicSetup } from "codemirror";
import { AlertTriangle, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// Debounce delay for parsing markdown changes (ms)
const PARSE_DEBOUNCE_MS = 500;
// Debounce delay for autosave after valid changes (ms)
const AUTOSAVE_DEBOUNCE_MS = 2000;

/**
 * Center pane for viewing/editing spec content with CodeMirror 6.
 * Supports bidirectional sync between markdown editor and spec JSON.
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
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<{ message: string; status?: number } | null>(null);
	const [diagnostics, setDiagnostics] = useState<ParseDiagnostic[]>([]);

	// Refs for CodeMirror
	const editorContainerRef = useRef<HTMLDivElement>(null);
	const editorViewRef = useRef<EditorView | null>(null);

	// Track if we're syncing from external source to avoid feedback loops
	const isSyncingFromExternalRef = useRef(false);
	// Track the last spec ID to detect spec changes
	const lastSpecIdRef = useRef<string | null>(null);
	// Debounce timers
	const parseTimerRef = useRef<number | null>(null);
	const autosaveTimerRef = useRef<number | null>(null);
	// Store current spec for use in callbacks
	const specRef = useRef<SpecDocument | null>(null);
	specRef.current = spec;

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

	// Parse markdown and update spec (debounced)
	const parseAndUpdate = useCallback(
		(markdownContent: string) => {
			const currentSpec = specRef.current;
			if (!currentSpec || isSyncingFromExternalRef.current) return;

			const result = markdownToSpec(markdownContent, currentSpec);
			setDiagnostics(result.diagnostics);

			if (result.success && result.spec) {
				// Merge parsed changes with existing spec
				const updatedSpec: SpecDocument = {
					...currentSpec,
					title: result.spec.title ?? currentSpec.title,
					overview: result.spec.overview ?? currentSpec.overview,
					sections: result.spec.sections ?? currentSpec.sections,
					metadata: {
						...currentSpec.metadata,
						updatedAt: Date.now(),
					},
				};

				onSpecUpdate(updatedSpec);

				// Schedule autosave
				if (autosaveTimerRef.current) {
					window.clearTimeout(autosaveTimerRef.current);
				}
				autosaveTimerRef.current = window.setTimeout(() => {
					handleSave();
				}, AUTOSAVE_DEBOUNCE_MS);
			}
		},
		[onSpecUpdate, handleSave],
	);

	// Handle editor content changes
	const handleEditorChange = useCallback(
		(content: string) => {
			if (isSyncingFromExternalRef.current) return;

			// Debounce parsing
			if (parseTimerRef.current) {
				window.clearTimeout(parseTimerRef.current);
			}
			parseTimerRef.current = window.setTimeout(() => {
				parseAndUpdate(content);
			}, PARSE_DEBOUNCE_MS);
		},
		[parseAndUpdate],
	);

	// CodeMirror theme customization for terminal aesthetic
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

	// Initialize CodeMirror editor
	// biome-ignore lint/correctness/useExhaustiveDependencies: editorTheme is stable (empty deps useMemo)
	useEffect(() => {
		if (!editorContainerRef.current || editorViewRef.current) return;

		const initialContent = spec ? specToMarkdown(spec) : "";

		const view = new EditorView({
			doc: initialContent,
			extensions: [
				basicSetup,
				markdown(),
				oneDark,
				editorTheme,
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						handleEditorChange(update.state.doc.toString());
					}
				}),
				// Custom keybinding for save
				keymap.of([
					{
						key: "Mod-s",
						run: () => {
							handleSave();
							return true;
						},
					},
				]),
				EditorView.lineWrapping,
			],
			parent: editorContainerRef.current,
		});

		editorViewRef.current = view;
		lastSpecIdRef.current = spec?.id ?? null;

		return () => {
			view.destroy();
			editorViewRef.current = null;
		};
		// Only run once on mount - we handle spec changes separately
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Sync editor content when spec changes from external source
	useEffect(() => {
		const view = editorViewRef.current;
		if (!view || !spec) return;

		// Only sync if spec ID changed (different spec loaded) or content changed externally
		const specChanged = lastSpecIdRef.current !== spec.id;
		lastSpecIdRef.current = spec.id;

		if (specChanged) {
			isSyncingFromExternalRef.current = true;
			const newContent = specToMarkdown(spec);

			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: newContent,
				},
			});

			// Reset diagnostics on spec change
			setDiagnostics([]);

			// Small delay before allowing changes to prevent feedback loop
			requestAnimationFrame(() => {
				isSyncingFromExternalRef.current = false;
			});
		}
	}, [spec]);

	// Keyboard shortcut for save (backup for non-editor focus)
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

	// Handle scroll target from graph node clicks
	useEffect(() => {
		const view = editorViewRef.current;
		if (!view || !scrollTarget || !spec) return;

		const markdown = view.state.doc.toString();
		const lineNum = findTargetLine(markdown, scrollTarget);

		if (lineNum !== null) {
			// Get the position at the start of the target line
			const line = view.state.doc.line(lineNum);
			const pos = line.from;

			// Scroll to the line and highlight it briefly
			view.dispatch({
				selection: { anchor: pos, head: pos },
				scrollIntoView: true,
				effects: EditorView.scrollIntoView(pos, { y: "center" }),
			});

			// Focus the editor
			view.focus();
		}
	}, [scrollTarget, spec]);

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
					<span className="text-sm font-mono font-medium truncate">{spec.title}</span>
					{isDirty && (
						<span className="text-warning text-xs" title="Unsaved changes">
							*
						</span>
					)}
					<span className="text-xs font-mono text-muted-foreground/50">v{spec.version}</span>
				</div>

				<div className="flex items-center gap-2">
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

					<button
						type="button"
						onClick={handleSave}
						disabled={!isDirty || isSaving || isConflict}
						className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						title="Save (Cmd/Ctrl+S)"
					>
						<Save size={12} />
						<span>{isSaving ? "saving..." : "save"}</span>
					</button>
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

			{/* Parse diagnostics banner */}
			{(hasErrors || hasWarnings) && (
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
					</div>
				</div>
			)}

			{/* CodeMirror Editor */}
			<div ref={editorContainerRef} className="flex-1 min-h-0 overflow-hidden" />

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
