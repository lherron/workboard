import { cn } from "@/lib/utils";
import type { MediaAttachment } from "@/session-events";
import { useState } from "react";

function ImageModal({
	src,
	alt,
	onClose,
}: {
	src: string;
	alt: string;
	onClose: () => void;
}) {
	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
			onClick={onClose}
		>
			<div className="relative max-w-[90vw] max-h-[90vh]">
				<button
					onClick={onClose}
					className="absolute -top-8 right-0 text-white/70 hover:text-white text-sm"
				>
					✕ Close
				</button>
				<img
					src={src}
					alt={alt}
					className="max-w-full max-h-[85vh] object-contain rounded border border-amber-500/30"
					onClick={(e) => e.stopPropagation()}
				/>
				<p className="mt-2 text-center text-xs text-white/50 font-mono truncate">{alt}</p>
			</div>
		</div>
	);
}

function ImageThumbnail({
	src,
	alt,
	className,
}: {
	src: string;
	alt: string;
	className?: string;
}) {
	const [showModal, setShowModal] = useState(false);

	return (
		<>
			<img
				src={src}
				alt={alt}
				className={cn(
					"max-w-full max-h-64 rounded border border-amber-500/30 object-contain cursor-pointer hover:border-amber-400/50 transition-colors",
					className,
				)}
				loading="lazy"
				onClick={(e) => {
					e.stopPropagation();
					setShowModal(true);
				}}
				title="Click to enlarge"
			/>
			{showModal && <ImageModal src={src} alt={alt} onClose={() => setShowModal(false)} />}
		</>
	);
}

function FileAttachment({
	attachment,
}: { attachment: Extract<MediaAttachment, { kind: "file" }> }) {
	const label = attachment.filename ?? "File";
	return (
		<a
			href={attachment.href}
			target="_blank"
			rel="noreferrer"
			className="inline-flex items-center gap-1 rounded border border-border/40 bg-muted/10 px-2 py-1 text-[10px] font-mono text-muted-foreground/70 hover:text-foreground"
			onClick={(e) => e.stopPropagation()}
		>
			<span>📎</span>
			<span className="truncate max-w-[240px]">{label}</span>
		</a>
	);
}

export function MediaAttachments({
	attachments,
	className,
}: {
	attachments: MediaAttachment[] | undefined;
	className?: string;
}) {
	if (!attachments || attachments.length === 0) return null;

	const images = attachments.filter(
		(a): a is Extract<MediaAttachment, { kind: "image" }> => a.kind === "image",
	);
	const files = attachments.filter(
		(a): a is Extract<MediaAttachment, { kind: "file" }> => a.kind === "file",
	);

	return (
		<div className={cn("space-y-2", className)}>
			{images.length > 0 && (
				<div className="space-y-2">
					{images.map((img, idx) => (
						<div key={`${img.src}-${idx}`} className="relative">
							<ImageThumbnail src={img.src} alt={img.alt ?? img.filename ?? "Image"} />
							{img.filename && (
								<p className="mt-0.5 text-[8px] font-mono text-muted-foreground/40">
									{img.filename}
								</p>
							)}
						</div>
					))}
				</div>
			)}

			{files.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{files.map((file, idx) => (
						<FileAttachment key={`${file.href}-${idx}`} attachment={file} />
					))}
				</div>
			)}
		</div>
	);
}
