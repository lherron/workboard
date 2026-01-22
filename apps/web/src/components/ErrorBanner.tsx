import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, RefreshCcw } from "lucide-react";

type ErrorBannerProps = {
	title?: string;
	message: string;
	detail?: string;
	onRetry?: () => void;
	className?: string;
};

export function ErrorBanner({
	title = "Something went wrong",
	message,
	detail,
	onRetry,
	className,
}: ErrorBannerProps) {
	return (
		<div
			className={cn(
				"flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900",
				className,
			)}
			role="alert"
		>
			<AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
			<div className="flex flex-col gap-1">
				<div className="font-medium leading-tight">{title}</div>
				<div className="text-sm text-red-800">{message}</div>
				{detail ? <div className="text-xs text-red-700/90">{detail}</div> : null}
			</div>
			{onRetry ? (
				<Button
					size="sm"
					variant="ghost"
					className="ml-auto h-8 px-2 text-red-900 hover:bg-red-100"
					onClick={onRetry}
				>
					<RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
					Retry
				</Button>
			) : null}
		</div>
	);
}
