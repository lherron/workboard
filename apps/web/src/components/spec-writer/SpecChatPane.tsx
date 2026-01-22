import { formatTimestampShort } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { SpecDocument } from "@webwrkq/shared";
import {
	AlertTriangle,
	CheckCircle,
	Loader2,
	RefreshCw,
	Send,
	Wifi,
	WifiOff,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type ChatMessage, useArchitectChat } from "./hooks/useArchitectChat";

type Props = {
	workspaceId: string;
	spec: SpecDocument | null;
	onSpecUpdate: (spec: SpecDocument) => void;
	onSaveComplete: (spec: SpecDocument) => void;
	onConflict?: () => void;
};

/**
 * Chat message component
 */
function ChatMessageBubble({
	message,
	isStreaming,
	streamText,
}: {
	message: ChatMessage | null;
	isStreaming?: boolean;
	streamText?: string;
}) {
	// For streaming state, show partial content
	if (isStreaming && !message) {
		return (
			<div className="flex flex-col gap-1 max-w-[85%]">
				<div className="px-3 py-2 rounded bg-secondary/50 border border-border/30 text-sm font-mono whitespace-pre-wrap">
					{streamText || <span className="text-muted-foreground animate-pulse">...</span>}
				</div>
			</div>
		);
	}

	if (!message) return null;

	const isUser = message.role === "user";
	const hasMutations = message.mutations && message.mutations.length > 0;

	return (
		<div
			className={cn(
				"flex flex-col gap-1 max-w-[85%]",
				isUser ? "ml-auto items-end" : "items-start",
			)}
		>
			<div
				className={cn(
					"px-3 py-2 rounded text-sm font-mono whitespace-pre-wrap",
					isUser
						? "bg-primary/20 border border-primary/30 text-foreground"
						: "bg-secondary/50 border border-border/30 text-foreground",
				)}
			>
				{message.content}
			</div>

			{/* Metadata row */}
			<div className="flex items-center gap-2 px-1">
				<span className="text-[10px] font-mono text-muted-foreground/50">
					{formatTimestampShort(message.timestamp)}
				</span>

				{/* Mutation indicator */}
				{hasMutations && (
					<span
						className={cn(
							"flex items-center gap-1 text-[10px] font-mono",
							message.mutationsApplied ? "text-green-500" : "text-warning",
						)}
						title={message.mutationsApplied ? "Mutations applied" : "Mutations pending"}
					>
						{message.mutationsApplied ? (
							<>
								<CheckCircle size={10} />
								<span>{message.mutations!.length} applied</span>
							</>
						) : (
							<>
								<Zap size={10} />
								<span>{message.mutations!.length} mutations</span>
							</>
						)}
					</span>
				)}
			</div>
		</div>
	);
}

/**
 * Right pane for architect chat interface.
 * Maintains session continuity and can apply spec mutations.
 */
export function SpecChatPane({
	workspaceId,
	spec,
	onSpecUpdate,
	onSaveComplete,
	onConflict,
}: Props) {
	const [inputValue, setInputValue] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const {
		messages,
		isConnected,
		isConnecting,
		isStreaming,
		currentStreamText,
		error,
		mutationError,
		sendMessage,
		isSending,
		clearMutationError,
	} = useArchitectChat({
		workspaceId,
		spec,
		onSpecUpdate,
		onSaveComplete,
		onConflict,
	});

	// Auto-scroll to bottom on new messages
	// biome-ignore lint/correctness/useExhaustiveDependencies: messages and currentStreamText trigger scroll
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, currentStreamText]);

	// Handle send
	const handleSend = useCallback(async () => {
		const trimmed = inputValue.trim();
		if (!trimmed || isSending || isStreaming) return;

		setInputValue("");
		await sendMessage(trimmed);
	}, [inputValue, isSending, isStreaming, sendMessage]);

	// Handle keyboard shortcuts
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	// Handle quick action buttons
	const handleQuickAction = useCallback((prompt: string) => {
		setInputValue(prompt);
		inputRef.current?.focus();
	}, []);

	// No spec selected
	if (!spec) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<p className="text-xs font-mono text-muted-foreground/60">
					Select a spec to start chatting
				</p>
			</div>
		);
	}

	const sessionId = spec.metadata.sessionId;
	const hasSession = !!sessionId;

	return (
		<div className="flex-1 flex flex-col min-h-0">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-border/30 flex-shrink-0">
				<div className="flex items-center gap-2">
					<span className="text-sm font-mono text-muted-foreground">architect</span>
					{/* Connection status */}
					{hasSession && (
						<span
							className={cn(
								"flex items-center gap-1 text-[10px] font-mono",
								isConnected
									? "text-green-500"
									: isConnecting
										? "text-warning"
										: "text-muted-foreground/50",
							)}
							title={isConnected ? "Connected" : isConnecting ? "Connecting..." : "Disconnected"}
						>
							{isConnected ? (
								<Wifi size={10} />
							) : isConnecting ? (
								<Loader2 size={10} className="animate-spin" />
							) : (
								<WifiOff size={10} />
							)}
						</span>
					)}
				</div>

				{/* Session ID badge */}
				{hasSession && (
					<span className="text-[10px] font-mono text-muted-foreground/40 truncate max-w-[100px]">
						{sessionId.slice(0, 8)}...
					</span>
				)}
			</div>

			{/* Quick actions (shown when no messages) */}
			{messages.length === 0 && !isStreaming && (
				<div className="px-4 py-3 border-b border-border/20 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => handleQuickAction("Add a feature: ")}
						className="px-2 py-1 text-[10px] font-mono bg-secondary/50 border border-border/30 hover:bg-secondary hover:border-border/50 transition-colors"
					>
						+ feature
					</button>
					<button
						type="button"
						onClick={() => handleQuickAction("Add a question: ")}
						className="px-2 py-1 text-[10px] font-mono bg-secondary/50 border border-border/30 hover:bg-secondary hover:border-border/50 transition-colors"
					>
						+ question
					</button>
					<button
						type="button"
						onClick={() => handleQuickAction("Review and improve the spec")}
						className="px-2 py-1 text-[10px] font-mono bg-secondary/50 border border-border/30 hover:bg-secondary hover:border-border/50 transition-colors"
					>
						review
					</button>
				</div>
			)}

			{/* Messages list */}
			<div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
				{messages.length === 0 && !isStreaming ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-center space-y-2">
							<p className="text-xs font-mono text-muted-foreground/60">
								{hasSession
									? "Session connected. Start chatting with the architect."
									: "Send a message to start a new architect session."}
							</p>
						</div>
					</div>
				) : (
					<>
						{messages.map((msg) => (
							<ChatMessageBubble key={msg.id} message={msg} />
						))}

						{/* Streaming message */}
						{isStreaming && (
							<ChatMessageBubble message={null} isStreaming streamText={currentStreamText} />
						)}
					</>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Error display */}
			{error && (
				<div className="px-4 py-2 bg-destructive/10 border-t border-destructive/30">
					<p className="text-xs font-mono text-destructive">{error.message}</p>
				</div>
			)}

			{/* Mutation save error display */}
			{mutationError && (
				<div
					className={cn(
						"px-4 py-2 border-t flex items-center gap-2",
						mutationError.isConflict
							? "bg-warning/10 border-warning/30"
							: "bg-destructive/10 border-destructive/30",
					)}
				>
					<AlertTriangle
						size={14}
						className={mutationError.isConflict ? "text-warning" : "text-destructive"}
					/>
					<p
						className={cn(
							"text-xs font-mono flex-1",
							mutationError.isConflict ? "text-warning" : "text-destructive",
						)}
					>
						{mutationError.isConflict
							? "Changes were not saved - spec was modified externally."
							: mutationError.message}
					</p>
					{mutationError.isConflict && onConflict && (
						<button
							type="button"
							onClick={() => {
								clearMutationError();
								onConflict();
							}}
							className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-warning/20 border border-warning/30 text-warning hover:bg-warning/30 transition-colors"
						>
							<RefreshCw size={10} />
							<span>Reload</span>
						</button>
					)}
				</div>
			)}

			{/* Input area */}
			<div className="border-t border-border/30 p-3 flex-shrink-0">
				<div className="flex gap-2">
					<textarea
						ref={inputRef}
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Ask the architect..."
						className={cn(
							"flex-1 px-3 py-2 text-sm font-mono",
							"bg-background border border-border/50 rounded",
							"placeholder:text-muted-foreground/40",
							"focus:outline-none focus:border-primary/50",
							"resize-none min-h-[60px] max-h-[120px]",
						)}
						disabled={isSending || isStreaming}
						rows={2}
					/>
					<button
						type="button"
						onClick={handleSend}
						disabled={!inputValue.trim() || isSending || isStreaming}
						className={cn(
							"px-3 py-2 self-end",
							"bg-primary/20 border border-primary/30 rounded",
							"hover:bg-primary/30 transition-colors",
							"disabled:opacity-50 disabled:cursor-not-allowed",
						)}
						title="Send (Cmd/Ctrl+Enter)"
					>
						{isSending || isStreaming ? (
							<Loader2 size={16} className="animate-spin text-primary" />
						) : (
							<Send size={16} className="text-primary" />
						)}
					</button>
				</div>
				<p className="text-[10px] font-mono text-muted-foreground/40 mt-1.5">
					Cmd/Ctrl+Enter to send
				</p>
			</div>
		</div>
	);
}
