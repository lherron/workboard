import type { ContentBlock } from "@/hooks/useCpSessionStream";
import type { MediaAttachment } from "./types";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"];

export function isImageMimeType(mimeType?: string): boolean {
	return Boolean(mimeType?.startsWith("image/"));
}

export function isImageFilename(filename?: string): boolean {
	if (!filename) return false;
	const ext = filename.toLowerCase().split(".").pop();
	return IMAGE_EXTS.includes(ext ?? "");
}

export function isImagePath(filePath?: string): boolean {
	if (!filePath) return false;
	const ext = filePath.toLowerCase().split(".").pop();
	return IMAGE_EXTS.includes(ext ?? "");
}

function isImageUrl(url?: string): boolean {
	if (!url) return false;
	const lowered = url.toLowerCase();
	return IMAGE_EXTS.some((ext) => lowered.endsWith(`.${ext}`));
}

function basename(path: string): string {
	const parts = path.split(/[\\/]/g);
	return parts[parts.length - 1] || path;
}

/**
 * Construct a URL to serve a local file via the web API.
 * Centralizing this ensures any future security hardening happens in one place.
 */
export function resolveLocalFileUrl(filePath: string): string {
	return `/api/files?path=${encodeURIComponent(filePath)}`;
}

export function extractTextFromContent(content: unknown): string | undefined {
	if (!content) return undefined;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		const text = content
			.map((block) => {
				if (typeof block !== "object" || block === null) return "";
				const b = block as Record<string, unknown>;
				if (b.type === "text" && typeof b.text === "string") return b.text;
				if (b.type === "media_ref" && typeof b.filename === "string") return `[${b.filename}]`;
				return "";
			})
			.filter(Boolean)
			.join(" ")
			.trim();
		return text || undefined;
	}
	return undefined;
}

function toMediaAttachment(block: ContentBlock): MediaAttachment | null {
	if (!block || typeof block !== "object") return null;
	if (block.type !== "media_ref") return null;
	const media = block as { url?: string; mimeType?: string; filename?: string; alt?: string };
	if (!media.url) return null;

	const isImage =
		isImageMimeType(media.mimeType) || isImageFilename(media.filename) || isImageUrl(media.url);

	if (isImage) {
		return {
			kind: "image",
			src: media.url,
			alt: media.alt ?? media.filename,
			filename: media.filename,
			mimeType: media.mimeType,
		};
	}

	return {
		kind: "file",
		href: media.url,
		filename: media.filename,
		mimeType: media.mimeType,
	};
}

export function extractAttachmentsFromContent(content: unknown): MediaAttachment[] {
	if (!content || !Array.isArray(content)) return [];
	const attachments: MediaAttachment[] = [];
	for (const block of content as ContentBlock[]) {
		const attachment = toMediaAttachment(block);
		if (attachment) attachments.push(attachment);
	}
	return attachments;
}

type ToolLike = {
	toolName?: string;
	input?: Record<string, unknown>;
	result?: { content?: unknown; details?: Record<string, unknown> };
	isError?: boolean;
};

/**
 * Extract attachments for a tool result, including "Read image" fallbacks.
 */
export function extractToolAttachments(tool: ToolLike): MediaAttachment[] {
	const toolName = tool.toolName ?? "";
	const input = tool.input ?? {};
	const isError = Boolean(tool.isError);

	const resultContent = tool.result?.content;
	const resultDetailsContent = (tool.result?.details as Record<string, unknown> | undefined)
		?.content;

	const attachments = [
		...extractAttachmentsFromContent(resultContent),
		...extractAttachmentsFromContent(resultDetailsContent),
	];

	// Fallback: Read <image> often returns no media_ref blocks; render via /api/files.
	const filePath = typeof input.file_path === "string" ? (input.file_path as string) : undefined;
	if (!isError && toolName === "Read" && filePath && isImagePath(filePath)) {
		const hasImage = attachments.some((a) => a.kind === "image");
		if (!hasImage) {
			attachments.push({
				kind: "image",
				src: resolveLocalFileUrl(filePath),
				alt: filePath,
				filename: basename(filePath),
			});
		}
	}

	return attachments;
}

export function summarizeToolInput(input: Record<string, unknown> | undefined): string {
	if (!input) return "";
	if (typeof input.file_path === "string") return input.file_path;
	if (typeof input.command === "string") {
		const cmd = input.command;
		return cmd.length > 60 ? `${cmd.slice(0, 57)}...` : cmd;
	}
	if (typeof input.pattern === "string") {
		const path = typeof input.path === "string" ? ` in ${input.path}` : "";
		return `${input.pattern}${path}`;
	}
	if (typeof input.url === "string") return input.url;
	if (typeof input.query === "string") return input.query;
	if (typeof input.prompt === "string") {
		const prompt = input.prompt;
		return prompt.length > 60 ? `${prompt.slice(0, 57)}...` : prompt;
	}
	if (typeof input.description === "string") return input.description;
	for (const [key, value] of Object.entries(input)) {
		if (typeof value === "string" && value.length > 0 && value.length < 100) {
			if (["type", "kind", "id", "toolUseId"].includes(key)) continue;
			return value.length > 60 ? `${value.slice(0, 57)}...` : value;
		}
	}
	return "";
}
