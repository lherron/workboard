import { type ApiClientError, createActor } from "@/api/client";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { ActorRole } from "@workboard/shared";
import { useEffect, useState } from "react";

type CreateActorModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
};

export function CreateActorModal({ isOpen, onClose, onSuccess }: CreateActorModalProps) {
	const [slug, setSlug] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [role, setRole] = useState<ActorRole>("human");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<ApiClientError | null>(null);

	// Reset form when modal opens
	useEffect(() => {
		if (isOpen) {
			setSlug("");
			setDisplayName("");
			setRole("human");
			setError(null);
		}
	}, [isOpen]);

	// Handle escape key
	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !loading) onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, loading, onClose]);

	if (!isOpen) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			await createActor({
				slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
				display_name: displayName || undefined,
				role,
			});
			onSuccess();
			onClose();
		} catch (err) {
			setError(err as ApiClientError);
		} finally {
			setLoading(false);
		}
	};

	const roleOptions: { value: ActorRole; label: string; icon: string; desc: string }[] = [
		{ value: "human", label: "human", icon: "◉", desc: "real person" },
		{ value: "agent", label: "agent", icon: "◈", desc: "ai/automation" },
		{ value: "system", label: "system", icon: "◎", desc: "internal process" },
	];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[3px]">
			<div
				className="w-full max-w-md border border-border bg-background shadow-2xl font-mono animate-in fade-in zoom-in-95 duration-150"
				role="dialog"
				aria-labelledby="create-actor-title"
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-border px-4 py-3 bg-secondary/50">
					<h2
						id="create-actor-title"
						className="text-[13px] font-medium tracking-wide text-foreground"
					>
						<span className="text-primary/70">›</span> new actor
					</h2>
					<button
						onClick={onClose}
						disabled={loading}
						className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
					>
						esc
					</button>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="p-5 space-y-5">
					{error && (
						<ErrorBanner
							title="Failed to create actor"
							message={error.message}
							detail={typeof error.details === "string" ? error.details : undefined}
						/>
					)}

					{/* Slug field */}
					<div className="space-y-1.5">
						<label className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
							slug <span className="text-primary/50">*</span>
						</label>
						<div className="relative">
							<span className="absolute left-0 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground/40">
								@
							</span>
							<input
								type="text"
								required
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
								className="w-full border-b border-border/50 bg-transparent pl-4 pr-0 py-1.5 text-[13px] placeholder:text-muted-foreground/30 focus-visible:outline-none focus-visible:border-primary transition-colors"
								placeholder="unique-identifier"
								autoFocus
								pattern="[a-z0-9-]+"
								title="Lowercase letters, numbers, and hyphens only"
							/>
						</div>
						<p className="text-[9px] text-muted-foreground/40">
							lowercase, alphanumeric, hyphens only
						</p>
					</div>

					{/* Display name field */}
					<div className="space-y-1.5">
						<label className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
							display name
						</label>
						<input
							type="text"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							className="w-full border-b border-border/50 bg-transparent px-0 py-1.5 text-[13px] placeholder:text-muted-foreground/30 focus-visible:outline-none focus-visible:border-primary transition-colors"
							placeholder="Human-readable name (optional)"
						/>
					</div>

					{/* Role selection */}
					<div className="space-y-2">
						<label className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
							role
						</label>
						<div className="grid grid-cols-3 gap-2">
							{roleOptions.map((opt) => (
								<button
									key={opt.value}
									type="button"
									onClick={() => setRole(opt.value)}
									className={`p-3 border text-center transition-all duration-150 ${
										role === opt.value
											? "border-primary bg-primary/10 text-primary"
											: "border-border/50 text-muted-foreground hover:border-border hover:bg-secondary/30"
									}`}
								>
									<div className="text-[14px] mb-1">{opt.icon}</div>
									<div className="text-[11px] font-medium">{opt.label}</div>
									<div className="text-[8px] mt-0.5 opacity-60">{opt.desc}</div>
								</button>
							))}
						</div>
					</div>

					{/* Actions */}
					<div className="flex justify-end gap-4 pt-4 border-t border-border/30">
						<button
							type="button"
							onClick={onClose}
							disabled={loading}
							className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
						>
							cancel
						</button>
						<button
							type="submit"
							disabled={loading || !slug.trim()}
							className="text-[11px] text-primary hover:underline disabled:opacity-50 disabled:no-underline font-medium transition-colors"
						>
							{loading ? (
								<span className="inline-flex items-center gap-1.5">
									<span className="animate-pulse">●</span>
									creating...
								</span>
							) : (
								"create actor"
							)}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
