/**
 * Unified chat input component for sending prompts.
 *
 * Supports both Enter-to-submit (like QuickAskInput) and Cmd+Enter-to-submit
 * (like SessionCard/SpecChatPane) via the submitKey prop.
 */

import { cn } from "@/lib/utils";
import { Send } from "lucide-react";
import { useRef, useState } from "react";

export type ChatInputProps = {
	/** Callback when user submits a prompt */
	onSubmit: (value: string) => void;

	/** Placeholder text for the input */
	placeholder?: string;

	/** Whether a submission is in progress (shows spinner) */
	isSubmitting?: boolean;

	/** Whether input is disabled (e.g., run in progress) */
	disabled?: boolean;

	/** Message to show when disabled */
	disabledMessage?: string;

	/**
	 * Keyboard shortcut for submit:
	 * - "enter": Enter submits, Shift+Enter for newline (default)
	 * - "cmd-enter": Cmd/Ctrl+Enter submits, Enter for newline
	 */
	submitKey?: "enter" | "cmd-enter";

	/**
	 * Visual variant:
	 * - "default": Full styling with amber accents (like QuickAskInput)
	 * - "minimal": Lighter styling (like SessionCard inline)
	 */
	variant?: "default" | "minimal";

	/** Whether to auto-focus on mount */
	autoFocus?: boolean;

	/** Optional CSS class for the container */
	className?: string;
};

/**
 * ChatInput provides a textarea with send button for chat UIs.
 *
 * @example
 * ```tsx
 * <ChatInput
 *   onSubmit={handleSend}
 *   placeholder="Ask a question..."
 *   disabled={hasLiveRun}
 *   disabledMessage="Run in progress..."
 * />
 * ```
 */
export function ChatInput({
	onSubmit,
	placeholder = "Send a message...",
	isSubmitting = false,
	disabled = false,
	disabledMessage = "Run in progress...",
	submitKey = "enter",
	variant = "default",
	autoFocus = true,
	className,
}: ChatInputProps) {
	const [value, setValue] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSubmit = () => {
		if (!value.trim() || isSubmitting || disabled) return;

		const trimmed = value.trim();
		setValue("");

		// Schedule focus for next tick to ensure it happens after React updates
		setTimeout(() => textareaRef.current?.focus(), 0);

		onSubmit(trimmed);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (submitKey === "enter") {
			// Enter submits, Shift+Enter for newline
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSubmit();
			}
		} else {
			// Cmd/Ctrl+Enter submits, Enter for newline
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handleSubmit();
			}
		}
	};

	const isDefault = variant === "default";
	const keyHint = submitKey === "enter" ? "⏎" : "⌘⏎";

	return (
		<div
			className={cn(
				"shrink-0 border-t",
				isDefault
					? "px-4 py-3 border-slate-800/50 bg-slate-900/50"
					: "px-3 py-1.5 border-border/30 bg-secondary/10",
				className,
			)}
		>
			{/* Status message - above input to reduce reflow */}
			{disabled && disabledMessage && (
				<p className="text-[9px] text-amber-400/60 mb-2">{disabledMessage}</p>
			)}

			<div className={cn("flex items-end", isDefault ? "gap-3" : "gap-2")}>
				<div className="flex-1 relative">
					<textarea
						ref={textareaRef}
						autoFocus={autoFocus}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={placeholder}
						disabled={isSubmitting || disabled}
						rows={1}
						className={cn(
							"w-full resize-none transition-colors",
							isDefault
								? [
										"rounded-lg border bg-slate-900/80 px-4 py-2.5",
										"text-[12px] text-slate-200 placeholder:text-slate-600",
										"border-slate-700/50 focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20",
										"focus:outline-none",
									]
								: [
										"rounded border border-border/40 bg-background/50 px-2 py-1.5",
										"text-[11px] placeholder:text-muted-foreground/40",
										"focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20",
									],
							"disabled:opacity-50 disabled:cursor-not-allowed",
						)}
						style={{
							minHeight: isDefault ? "40px" : "32px",
							maxHeight: "120px",
						}}
					/>

					{/* Keyboard hint */}
					{isDefault && (
						<div className="absolute right-2 bottom-1.5 text-[8px] text-slate-600">
							<kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded">
								{keyHint}
							</kbd>
						</div>
					)}
				</div>

				<button
					onClick={handleSubmit}
					disabled={!value.trim() || isSubmitting || disabled}
					className={cn(
						"shrink-0 transition-all duration-200",
						isDefault
							? [
									"p-2.5 rounded-lg border",
									"bg-gradient-to-br from-amber-500/20 to-amber-600/10",
									"border-amber-500/30 text-amber-400",
									"hover:from-amber-500/30 hover:to-amber-600/20 hover:border-amber-500/50",
									"hover:shadow-lg hover:shadow-amber-500/10",
									"disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none",
									"disabled:from-slate-800 disabled:to-slate-800 disabled:border-slate-700 disabled:text-slate-500",
								]
							: [
									"p-2 rounded border border-border/40",
									"text-muted-foreground/70 hover:text-cyan-400 hover:border-cyan-500/40",
									"disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-muted-foreground/70",
								],
					)}
				>
					{isSubmitting ? (
						<div
							className={cn(
								"border-2 rounded-full animate-spin",
								isDefault
									? "w-4 h-4 border-amber-400/30 border-t-amber-400"
									: "w-4 h-4 border-muted-foreground/30 border-t-muted-foreground",
							)}
						/>
					) : (
						<Send className="w-4 h-4" />
					)}
				</button>
			</div>
		</div>
	);
}

/**
 * Re-export for backwards compatibility.
 * QuickAskInput is now an alias for ChatInput with default settings.
 */
export { ChatInput as QuickAskInput };
