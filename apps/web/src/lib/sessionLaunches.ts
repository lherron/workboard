import type { TerminalLaunchRequest } from "@/api/client";
import { CLOD_TERMINAL_COLORS } from "@/lib/terminalColors";

export type SessionLaunchScope = "inbox" | "task-detail" | "quick-add";

type SessionLaunchKind = "terminal" | "async-triage";
type ShortcutMap = Partial<Record<SessionLaunchScope, string>>;

type ColorOverride = {
	foregroundColor?: string;
	backgroundColor?: string;
};

export type SessionLaunchConfig = {
	id: string;
	label: string;
	kind?: SessionLaunchKind;
	harness: "clod" | "codex" | "shell";
	preset?: TerminalLaunchRequest["preset"];
	modelProvider?: string;
	modelName?: string;
	prompt?: string;
	foregroundColor?: string;
	backgroundColor?: string;
	shortcut?: string | ShortcutMap;
	colorOverrides?: Partial<Record<SessionLaunchScope, ColorOverride>>;
};

const CLOD_COLORS: ColorOverride = {
	foregroundColor: CLOD_TERMINAL_COLORS.foregroundColor,
	backgroundColor: CLOD_TERMINAL_COLORS.backgroundColor,
};

export const SESSION_LAUNCHES = [
	{
		id: "triage-clod",
		label: "Triage (Claude)",
		harness: "clod",
		preset: "wrkq.triage",
		...CLOD_COLORS,
	},
	{
		id: "triage-codex",
		label: "Triage (Codex)",
		harness: "codex",
		preset: "wrkq.triage",
		shortcut: { inbox: "T" },
		colorOverrides: { inbox: CLOD_COLORS },
	},
	{
		id: "implement-clod",
		label: "Implement (Claude)",
		harness: "clod",
		preset: "wrkq.implement",
		shortcut: {
			inbox: "i",
			"task-detail": "Alt+Shift+Enter",
			"quick-add": "Cmd/Ctrl+Shift+Enter",
		},
		...CLOD_COLORS,
	},
	{
		id: "implement-codex",
		label: "Implement (Codex)",
		harness: "codex",
		preset: "wrkq.implement",
		shortcut: { inbox: "I" },
		colorOverrides: { inbox: CLOD_COLORS },
	},
	{
		id: "interactive-clod",
		label: "Interactive (Claude)",
		harness: "clod",
		preset: "interactive",
		...CLOD_COLORS,
	},
	{
		id: "async-triage",
		label: "Async triage",
		kind: "async-triage",
		harness: "clod",
		shortcut: { inbox: "t" },
		...CLOD_COLORS,
	},
] as const satisfies SessionLaunchConfig[];

export type SessionLaunchId = (typeof SESSION_LAUNCHES)[number]["id"];

const SESSION_LAUNCH_BY_ID = SESSION_LAUNCHES.reduce(
	(acc, launch) => {
		acc[launch.id] = launch;
		return acc;
	},
	{} as Record<SessionLaunchId, SessionLaunchConfig>,
);

export function getSessionLaunch(id: SessionLaunchId): SessionLaunchConfig {
	return SESSION_LAUNCH_BY_ID[id];
}

export function getShortcutForScope(
	launch: SessionLaunchConfig,
	scope: SessionLaunchScope,
): string | null {
	if (!launch.shortcut) return null;
	if (typeof launch.shortcut === "string") return launch.shortcut;
	return launch.shortcut[scope] ?? null;
}

function getColorsForScope(launch: SessionLaunchConfig, scope?: SessionLaunchScope): ColorOverride {
	if (!scope) {
		return {
			foregroundColor: launch.foregroundColor,
			backgroundColor: launch.backgroundColor,
		};
	}
	const override = launch.colorOverrides?.[scope];
	return {
		foregroundColor: override?.foregroundColor ?? launch.foregroundColor,
		backgroundColor: override?.backgroundColor ?? launch.backgroundColor,
	};
}

export function buildTerminalLaunchRequest(
	launch: SessionLaunchConfig,
	base: TerminalLaunchRequest,
	scope?: SessionLaunchScope,
): TerminalLaunchRequest {
	if (launch.kind === "async-triage") {
		throw new Error(`Session launch "${launch.id}" is not a terminal launch`);
	}

	const colors = getColorsForScope(launch, scope);
	const env: Record<string, string> = {
		...(launch.modelProvider ? { WRKQ_MODEL_PROVIDER: launch.modelProvider } : {}),
		...(launch.modelName ? { WRKQ_MODEL_NAME: launch.modelName } : {}),
		...(base.env ?? {}),
	};

	return {
		...base,
		preset: launch.preset ?? base.preset,
		prompt: launch.prompt ?? base.prompt,
		foregroundColor: colors.foregroundColor ?? base.foregroundColor,
		backgroundColor: colors.backgroundColor ?? base.backgroundColor,
		tool: {
			...(base.tool ?? {}),
			kind: launch.harness,
		},
		env,
	};
}

type ShortcutEvent = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

type ParsedShortcut = {
	key: string;
	shift: boolean;
	alt: boolean;
	meta: boolean;
	ctrl: boolean;
	metaOrCtrl: boolean;
};

function normalizeKeyToken(token: string): string {
	const normalized = token.trim();
	const key = normalized.toLowerCase().replace(/\s+/g, "");
	const aliasMap: Record<string, string> = {
		enter: "Enter",
		return: "Enter",
		esc: "Escape",
		escape: "Escape",
		tab: "Tab",
		space: " ",
		spacebar: " ",
		backspace: "Backspace",
		delete: "Delete",
		del: "Delete",
	};
	if (aliasMap[key]) return aliasMap[key];
	if (normalized.length === 1) return normalized;
	return normalized;
}

function parseShortcut(shortcut: string): ParsedShortcut | null {
	if (!shortcut) return null;
	const parts = shortcut
		.split("+")
		.map((part) => part.trim())
		.filter(Boolean);
	if (!parts.length) return null;

	const keyToken = parts.pop();
	if (!keyToken) return null;

	let shift = false;
	let alt = false;
	let meta = false;
	let ctrl = false;
	let metaOrCtrl = false;

	for (const raw of parts) {
		const token = raw.toLowerCase().replace(/\s+/g, "");
		if (token === "shift") {
			shift = true;
			continue;
		}
		if (token === "alt" || token === "option") {
			alt = true;
			continue;
		}
		if (token === "cmd" || token === "command" || token === "meta") {
			meta = true;
			continue;
		}
		if (token === "ctrl" || token === "control") {
			ctrl = true;
			continue;
		}
		if (
			token === "cmd/ctrl" ||
			token === "cmdorctrl" ||
			token === "commandorcontrol" ||
			token === "meta/ctrl" ||
			token === "metaorctrl"
		) {
			metaOrCtrl = true;
		}
	}

	const key = normalizeKeyToken(keyToken);
	const isAlpha = /^[a-z]$/i.test(key);
	if (isAlpha && key === key.toUpperCase() && !shift) {
		shift = true;
	}

	return {
		key,
		shift,
		alt,
		meta,
		ctrl,
		metaOrCtrl,
	};
}

export function matchesShortcut(event: ShortcutEvent, shortcut?: string | null): boolean {
	if (!shortcut) return false;
	const parsed = parseShortcut(shortcut);
	if (!parsed) return false;

	if (parsed.metaOrCtrl && !(event.metaKey || event.ctrlKey)) return false;
	if (!parsed.metaOrCtrl && parsed.meta && !event.metaKey) return false;
	if (!parsed.metaOrCtrl && parsed.ctrl && !event.ctrlKey) return false;

	if (parsed.shift !== event.shiftKey) return false;
	if (parsed.alt !== event.altKey) return false;

	if (!parsed.metaOrCtrl) {
		if (parsed.meta !== event.metaKey) return false;
		if (parsed.ctrl !== event.ctrlKey) return false;
	}

	return event.key === parsed.key;
}
