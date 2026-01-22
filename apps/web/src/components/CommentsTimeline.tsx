import type { ApiClientError } from "@/api/client";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Skeleton } from "@/components/Skeleton";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { TaskComment } from "@webwrkq/shared";
import { Bot, MessageSquareText, ShieldQuestion, UserRound } from "lucide-react";

type CommentsTimelineProps = {
	comments: TaskComment[];
	loading: boolean;
	error: ApiClientError | null;
	onRetry?: () => void;
};

function ActorBadge({ role }: { role: TaskComment["actor_role"] }) {
	const palette: Record<TaskComment["actor_role"], string> = {
		human:
			"bg-sky-50 text-sky-800 border border-sky-100 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-900",
		agent:
			"bg-violet-50 text-violet-800 border border-violet-100 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-900",
		system: "bg-muted text-muted-foreground border border-border",
	};

	const iconMap = {
		human: <UserRound className="h-3.5 w-3.5" />,
		agent: <Bot className="h-3.5 w-3.5" />,
		system: <ShieldQuestion className="h-3.5 w-3.5" />,
	};

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
				palette[role],
			)}
		>
			{iconMap[role]}
			{role}
		</span>
	);
}

function CommentSkeleton() {
	return (
		<div className="relative pl-8">
			<span className="absolute left-[7px] top-0 h-full w-px bg-border" aria-hidden />
			<span className="absolute left-1 top-2 h-2 w-2 rounded-full bg-muted" aria-hidden />
			<div className="mb-5 rounded-lg border border-border bg-secondary p-4 shadow-sm transition">
				<div className="mb-3 flex items-center justify-between gap-2">
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-3 w-24" />
				</div>
				<Skeleton className="mb-2 h-3 w-5/6" />
				<Skeleton className="h-3 w-2/3" />
			</div>
		</div>
	);
}

export function CommentsTimeline({ comments, loading, error, onRetry }: CommentsTimelineProps) {
	if (error) {
		return (
			<ErrorBanner
				title="Could not load comments"
				message={error.message}
				detail={typeof error.details === "string" ? error.details : undefined}
				onRetry={onRetry}
			/>
		);
	}

	if (loading) {
		return (
			<div className="space-y-4">
				{[...Array(3)].map((_, idx) => (
					<CommentSkeleton key={idx} />
				))}
			</div>
		);
	}

	if (!comments.length) {
		return (
			<EmptyState
				title="No comments yet"
				description="Comments added from the CLI or agents will appear here in chronological order."
				className="bg-secondary"
			/>
		);
	}

	return (
		<div className="space-y-5">
			{comments.map((comment, idx) => (
				<div key={comment.id} className="relative pl-8">
					<span className="absolute left-[7px] top-0 h-full w-px bg-border" aria-hidden />
					<span className="absolute left-1 top-2 h-2 w-2 rounded-full bg-primary" aria-hidden />
					<div className="rounded-lg border border-border bg-secondary p-4 shadow-sm transition hover:shadow">
						<div className="mb-2 flex flex-wrap items-center justify-between gap-3">
							<div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
								<MessageSquareText className="h-4 w-4 text-primary" />
								<span className="font-mono text-xs text-muted-foreground">{comment.id}</span>
								<span className="text-foreground">{comment.actor_slug}</span>
								<ActorBadge role={comment.actor_role} />
							</div>
							<span className="text-xs text-muted-foreground">
								{formatDateTime(comment.created_at)}
							</span>
						</div>
						<div className="markdown-body text-sm leading-relaxed">
							<MarkdownContent content={comment.body} />
						</div>
						{comment.meta ? (
							<details className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
								<summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
									Meta
								</summary>
								<pre className="mt-2 overflow-x-auto rounded bg-secondary px-3 py-2 text-xs text-foreground shadow-inner">
									{JSON.stringify(comment.meta, null, 2)}
								</pre>
							</details>
						) : null}
					</div>
					{idx !== comments.length - 1 ? (
						<span
							className="absolute left-[7px] top-[calc(100%_+_4px)] h-4 w-px bg-border"
							aria-hidden
						/>
					) : null}
				</div>
			))}
		</div>
	);
}
