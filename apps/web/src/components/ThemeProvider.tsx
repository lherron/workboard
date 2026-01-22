import { useEffect } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		// Set dark mode as default
		document.documentElement.classList.add("dark");

		// Apply dev-mode color scheme when TOOL_STACK=dev
		if (import.meta.env.TOOL_STACK === "dev") {
			document.documentElement.classList.add("dev-mode");
		}
	}, []);

	return <>{children}</>;
}
