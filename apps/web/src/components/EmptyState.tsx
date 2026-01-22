import { cn } from "@/lib/utils";

type EmptyStateProps = {
	title: string;
	description?: string;
	children?: React.ReactNode;
	className?: string;
};

export function EmptyState({ title, description, children, className }: EmptyStateProps) {
	return (
		<div
			className={cn(
				"rounded-lg border border-dashed border-border bg-secondary/60 p-6 text-center",
				className,
			)}
		>
			<p className="text-base font-semibold text-foreground">{title}</p>
			{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
			{children ? <div className="mt-3 flex justify-center gap-2">{children}</div> : null}
		</div>
	);
}
