type LoadingStateProps = {
	message?: string;
};

export function LoadingState({ message = "Loading workspaces..." }: LoadingStateProps) {
	return (
		<div className="h-full flex items-center justify-center">
			<div className="text-center">
				<div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin mx-auto mb-3" />
				<p className="text-[12px] text-muted-foreground/70">{message}</p>
			</div>
		</div>
	);
}

type NoProjectsSelectedStateProps = {
	onOpenFilter: () => void;
};

export function NoProjectsSelectedState({ onOpenFilter }: NoProjectsSelectedStateProps) {
	return (
		<div className="h-full flex items-center justify-center">
			<div className="text-center max-w-md px-6">
				<div className="w-12 h-12 border border-border/60 rounded-lg flex items-center justify-center mx-auto mb-4 bg-secondary/40">
					<span className="text-[20px] text-muted-foreground/50">⌖</span>
				</div>
				<h2 className="text-[14px] text-foreground/90 font-medium mb-2">No Projects Selected</h2>
				<p className="text-[12px] text-muted-foreground/70 leading-relaxed mb-4">
					Choose which workspaces show up in Inbox Hub.
				</p>
				<button
					onClick={onOpenFilter}
					className="text-[11px] font-mono text-primary border border-primary/40 px-3 py-1.5 hover:bg-primary/10 transition-colors"
				>
					Open filter
				</button>
			</div>
		</div>
	);
}

export function NoInboxesFoundState() {
	return (
		<div className="h-full flex items-center justify-center">
			<div className="text-center max-w-md px-6">
				<div className="w-12 h-12 border border-border/60 rounded-lg flex items-center justify-center mx-auto mb-4 bg-secondary/40">
					<span className="text-[20px] text-muted-foreground/50">⌸</span>
				</div>
				<h2 className="text-[14px] text-foreground/90 font-medium mb-2">No Inboxes Found</h2>
				<p className="text-[12px] text-muted-foreground/70 leading-relaxed">
					Create an "inbox" container in your wrkq workspaces to see them here.
				</p>
			</div>
		</div>
	);
}
