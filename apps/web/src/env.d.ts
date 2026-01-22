/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_BASE?: string;
	/** Set to 'dev' to activate amber-rust dev-mode color scheme */
	readonly TOOL_STACK?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
