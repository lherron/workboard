import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Debug logging utility that only logs in development mode.
 * Use this instead of console.log for debug output.
 */
export function debugLog(prefix: string, ...args: unknown[]): void {
	if (import.meta.env.DEV) {
		console.log(prefix, ...args);
	}
}
