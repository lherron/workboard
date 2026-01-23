import {
	type ApiClientError,
	createWorkspaceSpec,
	deleteWorkspaceSpec,
	fetchWorkspaceSpec,
	fetchWorkspaceSpecs,
	updateWorkspaceSpec,
} from "@/api/client";
import type { SpecDocument, SpecManifest } from "@workboard/shared";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { type SpecTemplateId, applyTemplateToSpec } from "../lib/templates";

export type SpecListState = {
	specs: SpecManifest[];
	loading: boolean;
	error: ApiClientError | null;
};

export type SpecState = {
	spec: SpecDocument | null;
	loading: boolean;
	error: ApiClientError | null;
	isDirty: boolean;
};

type UseSpecDocumentOptions = {
	workspaceId: string;
	specSlug: string | null;
};

type UseSpecDocumentReturn = {
	// State
	specListState: SpecListState;
	specState: SpecState;
	isCreating: boolean;

	// Actions
	loadSpecList: (isRefresh?: boolean) => () => void;
	loadSpec: (slug: string) => () => void;
	handleSelectSpec: (slug: string) => void;
	handleCreateSpec: (title: string, templateId?: SpecTemplateId) => Promise<void>;
	handleDeleteSpec: (slug: string) => Promise<void>;
	handleSpecUpdate: (updatedSpec: SpecDocument) => void;
	handleSaveComplete: (savedSpec: SpecDocument) => void;
	handleReload: () => void;
};

/**
 * Hook for managing spec document CRUD operations and state.
 * Handles spec list loading, individual spec loading, and mutations.
 */
export function useSpecDocument({
	workspaceId,
	specSlug,
}: UseSpecDocumentOptions): UseSpecDocumentReturn {
	const [, navigate] = useLocation();

	// Spec list state
	const [specListState, setSpecListState] = useState<SpecListState>({
		specs: [],
		loading: true,
		error: null,
	});

	// Current spec state
	const [specState, setSpecState] = useState<SpecState>({
		spec: null,
		loading: false,
		error: null,
		isDirty: false,
	});

	// Creating state
	const [isCreating, setIsCreating] = useState(false);

	// Load spec list
	const loadSpecList = useCallback(
		(isRefresh = false) => {
			const controller = new AbortController();

			if (!isRefresh) {
				setSpecListState((prev) => ({ ...prev, loading: true }));
			}

			fetchWorkspaceSpecs(workspaceId, controller.signal)
				.then((response) => {
					setSpecListState({
						specs: response.specs,
						loading: false,
						error: null,
					});
				})
				.catch((err) => {
					if ((err as Error).name === "AbortError") return;
					setSpecListState((prev) => ({
						...prev,
						loading: false,
						error: err as ApiClientError,
					}));
				});

			return () => controller.abort();
		},
		[workspaceId],
	);

	// Load current spec when slug changes
	const loadSpec = useCallback(
		(slug: string) => {
			const controller = new AbortController();

			setSpecState({
				spec: null,
				loading: true,
				error: null,
				isDirty: false,
			});

			fetchWorkspaceSpec(workspaceId, slug, controller.signal)
				.then((response) => {
					setSpecState({
						spec: response.spec,
						loading: false,
						error: null,
						isDirty: false,
					});
				})
				.catch((err) => {
					if ((err as Error).name === "AbortError") return;
					setSpecState({
						spec: null,
						loading: false,
						error: err as ApiClientError,
						isDirty: false,
					});
				});

			return () => controller.abort();
		},
		[workspaceId],
	);

	// Initial load of spec list
	useEffect(() => {
		const abort = loadSpecList();
		return abort;
	}, [loadSpecList]);

	// Load spec when slug changes
	useEffect(() => {
		if (!specSlug) {
			setSpecState({
				spec: null,
				loading: false,
				error: null,
				isDirty: false,
			});
			return;
		}

		const abort = loadSpec(specSlug);
		return abort;
	}, [specSlug, loadSpec]);

	// Navigate to first spec if none selected and specs exist
	useEffect(() => {
		if (specSlug) return;
		if (specListState.loading) return;
		if (specListState.specs.length === 0) return;

		// Sort by updatedAt descending to get most recent
		const sorted = [...specListState.specs].sort((a, b) => b.updatedAt - a.updatedAt);
		const firstSlug = sorted[0].slug;

		navigate(`/workspace/${workspaceId}/spec-writer/${firstSlug}`, { replace: true });
	}, [specSlug, specListState, workspaceId, navigate]);

	// Handle spec selection
	const handleSelectSpec = useCallback(
		(slug: string) => {
			navigate(`/workspace/${workspaceId}/spec-writer/${slug}`);
		},
		[workspaceId, navigate],
	);

	// Handle create new spec

	const handleCreateSpec = useCallback(
		async (title: string, templateId: SpecTemplateId = "feature") => {
			if (!workspaceId) return;
			setIsCreating(true);
			setSpecListState((prev) => ({ ...prev, error: null }));
			try {
				const response = await createWorkspaceSpec(workspaceId, { title });
				let created = response.spec;

				// Apply template after creation (server creates a minimal default spec)
				if (templateId && templateId !== "blank") {
					try {
						const templated = applyTemplateToSpec(created, templateId);
						const saveResponse = await updateWorkspaceSpec(
							workspaceId,
							templated.slug,
							templated,
							created.rev,
						);
						created = saveResponse.spec;
					} catch (templateErr) {
						// Template application failure should not block spec creation
						console.error("[SpecWriter] Failed to apply template:", templateErr);
					}
				}

				// Refresh spec list + navigate
				loadSpecList(true);
				navigate(`/workspace/${workspaceId}/spec-writer/${created.slug}`);
			} catch (err) {
				setSpecListState((prev) => ({ ...prev, error: err as ApiClientError }));
			} finally {
				setIsCreating(false);
			}
		},
		[workspaceId, loadSpecList, navigate],
	);

	const handleDeleteSpec = useCallback(
		async (slug: string) => {
			try {
				await deleteWorkspaceSpec(workspaceId, slug);
				loadSpecList(true);

				// Navigate away if we deleted the current spec
				if (slug === specSlug) {
					navigate(`/workspace/${workspaceId}/spec-writer`);
				}
			} catch (err) {
				console.error("Failed to delete spec:", err);
				throw err;
			}
		},
		[workspaceId, specSlug, loadSpecList, navigate],
	);

	// Handle spec update from editor
	const handleSpecUpdate = useCallback((updatedSpec: SpecDocument) => {
		setSpecState((prev) => ({
			...prev,
			spec: updatedSpec,
			isDirty: true,
		}));
	}, []);

	// Handle save complete
	const handleSaveComplete = useCallback(
		(savedSpec: SpecDocument) => {
			setSpecState((prev) => ({
				...prev,
				spec: savedSpec,
				isDirty: false,
			}));
			// Refresh list to get updated timestamps
			loadSpecList(true);
		},
		[loadSpecList],
	);

	// Handle reload after conflict - fetches the latest spec from server
	const handleReload = useCallback(() => {
		if (specSlug) {
			loadSpec(specSlug);
		}
	}, [specSlug, loadSpec]);

	return {
		specListState,
		specState,
		isCreating,
		loadSpecList,
		loadSpec,
		handleSelectSpec,
		handleCreateSpec,
		handleDeleteSpec,
		handleSpecUpdate,
		handleSaveComplete,
		handleReload,
	};
}
