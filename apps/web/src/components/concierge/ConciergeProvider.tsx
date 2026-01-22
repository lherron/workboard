/**
 * ConciergeProvider manages the global UI concierge state.
 *
 * Features:
 * - Open/closed state with localStorage persistence
 * - Session management for the implementer role
 * - Polling for roster member data (activeSessionId, runs)
 */

import {
	type ProjectAskResponse,
	type ProjectRosterMember,
	type RunSummary,
	clearProjectRoleSession,
	fetchProjectRoster,
	fetchProjectRuns,
	submitProjectRoleTurn,
} from "@/api/client";
import type { RunLike } from "@/lib/chat";
import {
	type ReactNode,
	createContext,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

const STORAGE_KEY_OPEN = "concierge-open";
const STORAGE_KEY_PINNED = "concierge-pinned";
const PROJECT_ID = "taskboard";
const ROLE_NAME = "ui-concierge";
const POLL_INTERVAL_MS = 5000;

export type ConciergeState = {
	isOpen: boolean;
	isPinned: boolean;
	sessionId: string | null;
	isConnecting: boolean;
	isSubmitting: boolean;
};

export type ConciergeContextValue = ConciergeState & {
	/** Toggle panel open/closed */
	toggle: () => void;
	/** Open the panel */
	open: () => void;
	/** Close the panel */
	close: () => void;
	/** Toggle pin state */
	togglePin: () => void;
	/** Submit a message to the concierge */
	submit: (prompt: string) => Promise<ProjectAskResponse | null>;
	/** Clear the current session and start fresh */
	newChat: () => Promise<void>;
	/** Runs for the current session (for groupEventsByRun) */
	runs: RunLike[];
	/** Whether we have an error */
	error: Error | null;
	/** Refresh roster/runs data */
	refresh: () => void;
};

const defaultContext: ConciergeContextValue = {
	isOpen: false,
	isPinned: false,
	sessionId: null,
	isConnecting: false,
	isSubmitting: false,
	runs: [],
	error: null,
	toggle: () => {},
	open: () => {},
	close: () => {},
	togglePin: () => {},
	submit: async () => null,
	newChat: async () => {},
	refresh: () => {},
};

export const ConciergeContext = createContext<ConciergeContextValue>(defaultContext);

type ConciergeProviderProps = {
	children: ReactNode;
};

export function ConciergeProvider({ children }: ConciergeProviderProps) {
	// Panel state - persisted in localStorage
	const [isOpen, setIsOpen] = useState(() => {
		if (typeof window === "undefined") return false;
		return localStorage.getItem(STORAGE_KEY_OPEN) === "true";
	});

	// Pin state - persisted in localStorage
	const [isPinned, setIsPinned] = useState(() => {
		if (typeof window === "undefined") return false;
		return localStorage.getItem(STORAGE_KEY_PINNED) === "true";
	});

	// Session and roster state
	const [member, setMember] = useState<ProjectRosterMember | null>(null);
	const [runs, setRuns] = useState<RunSummary[]>([]);
	const [isConnecting, setIsConnecting] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	// Track pending session ID (set by submit, before roster refresh)
	const pendingSessionIdRef = useRef<string | null>(null);

	const sessionId = member?.session.activeSessionId ?? null;

	// Persist open state
	useEffect(() => {
		localStorage.setItem(STORAGE_KEY_OPEN, String(isOpen));
	}, [isOpen]);

	// Persist pin state
	useEffect(() => {
		localStorage.setItem(STORAGE_KEY_PINNED, String(isPinned));
	}, [isPinned]);

	// Fetch roster and runs data
	const fetchData = useCallback(async () => {
		try {
			setIsConnecting(true);
			setError(null);

			const rosterResponse = await fetchProjectRoster(PROJECT_ID);
			const members = rosterResponse.roster?.members ?? rosterResponse.view?.members ?? [];
			const implementer = members.find((m) => m.roleName === ROLE_NAME);
			setMember(implementer ?? null);

			// Fetch runs for the session
			const activeSessionId = implementer?.session.activeSessionId;
			if (activeSessionId) {
				const runsData = await fetchProjectRuns(PROJECT_ID, activeSessionId);
				setRuns(runsData.runs ?? []);
			} else {
				setRuns([]);
			}

			// Clear pending session ref if it now matches
			if (pendingSessionIdRef.current === activeSessionId) {
				pendingSessionIdRef.current = null;
			}
		} catch (err) {
			console.error("[Concierge] Failed to fetch data:", err);
			setError(err instanceof Error ? err : new Error("Failed to fetch data"));
		} finally {
			setIsConnecting(false);
		}
	}, []);

	// Initial fetch and polling when open
	useEffect(() => {
		if (!isOpen) return;

		fetchData();

		const interval = setInterval(fetchData, POLL_INTERVAL_MS);
		return () => clearInterval(interval);
	}, [isOpen, fetchData]);

	// Panel toggle functions
	const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
	const open = useCallback(() => setIsOpen(true), []);
	const close = useCallback(() => setIsOpen(false), []);
	const togglePin = useCallback(() => setIsPinned((prev) => !prev), []);

	// Submit a message
	const submit = useCallback(
		async (prompt: string): Promise<ProjectAskResponse | null> => {
			if (isSubmitting) return null;

			setIsSubmitting(true);
			setError(null);

			try {
				const response = await submitProjectRoleTurn(PROJECT_ID, ROLE_NAME, prompt);

				// Track the new session ID for immediate switch
				if (response.sessionId) {
					pendingSessionIdRef.current = response.sessionId;
				}

				// Refresh to get updated data
				await fetchData();

				return response;
			} catch (err) {
				console.error("[Concierge] Submit failed:", err);
				setError(err instanceof Error ? err : new Error("Submit failed"));
				return null;
			} finally {
				setIsSubmitting(false);
			}
		},
		[isSubmitting, fetchData],
	);

	// Start a new chat (clear session)
	const newChat = useCallback(async () => {
		setError(null);

		try {
			await clearProjectRoleSession(PROJECT_ID, ROLE_NAME);
			await fetchData();
		} catch (err) {
			console.error("[Concierge] New chat failed:", err);
			setError(err instanceof Error ? err : new Error("Failed to clear session"));
		}
	}, [fetchData]);

	// Convert runs to RunLike format
	const runsForChat = useMemo((): RunLike[] => {
		return runs.map((r) => ({
			runId: r.runId,
			status: r.status,
			createdAt: r.createdAt,
			completedAt: r.completedAt,
		}));
	}, [runs]);

	const value: ConciergeContextValue = useMemo(
		() => ({
			isOpen,
			isPinned,
			sessionId,
			isConnecting,
			isSubmitting,
			runs: runsForChat,
			error,
			toggle,
			open,
			close,
			togglePin,
			submit,
			newChat,
			refresh: fetchData,
		}),
		[
			isOpen,
			isPinned,
			sessionId,
			isConnecting,
			isSubmitting,
			runsForChat,
			error,
			toggle,
			open,
			close,
			togglePin,
			submit,
			newChat,
			fetchData,
		],
	);

	return <ConciergeContext.Provider value={value}>{children}</ConciergeContext.Provider>;
}
