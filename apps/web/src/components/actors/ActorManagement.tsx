import { type ApiClientError, fetchActors } from "@/api/client";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { WrkqActor } from "@workboard/shared";
import { useCallback, useEffect, useState } from "react";
import { CreateActorModal } from "./CreateActorModal";
import { EditActorModal } from "./EditActorModal";

function formatDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function RoleBadge({ role }: { role: "human" | "agent" | "system" }) {
	const styles = {
		human: "border-blue-500/60 text-blue-400 bg-blue-500/10",
		agent: "border-violet-500/60 text-violet-400 bg-violet-500/10",
		system: "border-zinc-500/60 text-zinc-400 bg-zinc-500/10",
	};

	const icons = {
		human: "◉",
		agent: "◈",
		system: "◎",
	};

	return (
		<span
			className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${styles[role]}`}
		>
			<span className="opacity-70">{icons[role]}</span>
			{role}
		</span>
	);
}

function ActorRow({
	actor,
	index,
	onClick,
}: {
	actor: WrkqActor;
	index: number;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			className="group w-full text-left grid grid-cols-[1fr,1fr,100px,90px] gap-4 px-4 py-3 border-b border-border/30 hover:bg-primary/5 transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
			style={{ animationDelay: `${index * 30}ms` }}
		>
			<div className="flex items-center gap-3 min-w-0">
				<span className="text-[10px] text-muted-foreground/40 font-mono w-5 shrink-0">
					{String(index + 1).padStart(2, "0")}
				</span>
				<span className="text-[13px] font-mono text-foreground truncate group-hover:text-primary transition-colors">
					{actor.slug}
				</span>
			</div>
			<div className="text-[12px] text-muted-foreground/70 font-mono truncate">
				{actor.display_name || "—"}
			</div>
			<div>
				<RoleBadge role={actor.role} />
			</div>
			<div className="text-[11px] text-muted-foreground/50 font-mono text-right">
				{formatDate(actor.created_at)}
			</div>
		</button>
	);
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center py-20 px-4">
			<div className="text-[11px] font-mono text-muted-foreground/30 mb-6 text-center leading-relaxed">
				<pre className="inline-block text-left">
					{`┌─────────────────────────┐
│                         │
│   no actors registered  │
│                         │
│   actors represent      │
│   humans, agents, and   │
│   system processes      │
│                         │
└─────────────────────────┘`}
				</pre>
			</div>
			<button
				onClick={onCreateClick}
				className="text-[11px] font-mono text-primary hover:underline"
			>
				+ create first actor
			</button>
		</div>
	);
}

function LoadingSkeleton() {
	return (
		<div className="space-y-0">
			{[...Array(5)].map((_, i) => (
				<div
					key={i}
					className="grid grid-cols-[1fr,1fr,100px,90px] gap-4 px-4 py-3 border-b border-border/30 animate-pulse"
					style={{ animationDelay: `${i * 100}ms` }}
				>
					<div className="flex items-center gap-3">
						<div className="w-5 h-3 bg-muted/30 rounded" />
						<div className="w-24 h-3 bg-muted/30 rounded" />
					</div>
					<div className="w-32 h-3 bg-muted/20 rounded" />
					<div className="w-16 h-5 bg-muted/20 rounded" />
					<div className="w-16 h-3 bg-muted/20 rounded ml-auto" />
				</div>
			))}
		</div>
	);
}

export function ActorManagement() {
	const [actors, setActors] = useState<WrkqActor[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<ApiClientError | null>(null);
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [editingActor, setEditingActor] = useState<WrkqActor | null>(null);
	const [requestId, setRequestId] = useState(0);

	const loadActors = useCallback(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(null);

		fetchActors(controller.signal)
			.then((resp) => {
				setActors(resp.actors);
				setLoading(false);
			})
			.catch((err) => {
				if ((err as Error).name === "AbortError") return;
				setError(err as ApiClientError);
				setLoading(false);
			});

		return () => controller.abort();
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: requestId is intentionally used to force re-fetch
	useEffect(() => {
		const abort = loadActors();
		return abort;
	}, [loadActors, requestId]);

	const handleRefresh = () => setRequestId((n) => n + 1);

	const handleBackToHub = () => {
		const url = new URL(window.location.href);
		url.searchParams.set("view", "inbox-hub");
		window.history.pushState({}, "", url.toString());
		window.dispatchEvent(new PopStateEvent("popstate"));
	};

	return (
		<div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
			{/* Scan line overlay */}
			<div
				className="pointer-events-none fixed inset-0 z-50 opacity-[0.015]"
				style={{
					backgroundImage:
						"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
				}}
			/>

			{/* Header */}
			<header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-secondary/40 backdrop-blur-sm shrink-0">
				<div className="flex items-center gap-4">
					<button
						onClick={handleBackToHub}
						className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
					>
						← hub
					</button>
					<div className="w-px h-4 bg-border/50" />
					<div className="flex items-center gap-3">
						<span className="text-[13px] font-mono text-foreground">
							<span className="text-primary/70">›</span> actors
						</span>
						{!loading && (
							<span className="text-[10px] font-mono px-1.5 py-0.5 bg-muted/30 text-muted-foreground border border-border/50">
								{actors.length}
							</span>
						)}
					</div>
				</div>

				<div className="flex items-center gap-3">
					<button
						onClick={handleRefresh}
						disabled={loading}
						className="text-[10px] font-mono text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
					>
						refresh
					</button>
					<button
						onClick={() => setCreateModalOpen(true)}
						className="text-[11px] font-mono px-3 py-1.5 border border-primary/50 text-primary hover:bg-primary/10 transition-colors"
					>
						+ new actor
					</button>
				</div>
			</header>

			{/* Table header */}
			<div className="grid grid-cols-[1fr,1fr,100px,90px] gap-4 px-4 py-2 border-b border-border/50 bg-secondary/20 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 shrink-0">
				<div className="pl-8">slug</div>
				<div>display name</div>
				<div>role</div>
				<div className="text-right">created</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto">
				{error && (
					<div className="p-4">
						<ErrorBanner
							title="Failed to load actors"
							message={error.message}
							onRetry={handleRefresh}
						/>
					</div>
				)}

				{loading && !error && <LoadingSkeleton />}

				{!loading && !error && actors.length === 0 && (
					<EmptyState onCreateClick={() => setCreateModalOpen(true)} />
				)}

				{!loading && !error && actors.length > 0 && (
					<div className="divide-y divide-border/20">
						{actors.map((actor, i) => (
							<ActorRow
								key={actor.actor_id}
								actor={actor}
								index={i}
								onClick={() => setEditingActor(actor)}
							/>
						))}
					</div>
				)}
			</div>

			{/* Footer status bar */}
			<footer className="px-6 py-2 border-t border-border/30 bg-secondary/20 shrink-0">
				<div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">
					<span>actor directory</span>
					<span>
						{loading
							? "loading..."
							: `${actors.length} actor${actors.length !== 1 ? "s" : ""} registered`}
					</span>
				</div>
			</footer>

			{/* Modals */}
			<CreateActorModal
				isOpen={createModalOpen}
				onClose={() => setCreateModalOpen(false)}
				onSuccess={handleRefresh}
			/>

			{editingActor && (
				<EditActorModal
					isOpen={!!editingActor}
					actor={editingActor}
					onClose={() => setEditingActor(null)}
					onSuccess={handleRefresh}
				/>
			)}
		</div>
	);
}
