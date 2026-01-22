import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

type MarkdownContentProps = {
	content: string;
	className?: string;
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
	return (
		<ReactMarkdown
			className={cn("markdown-body", className)}
			remarkPlugins={[remarkGfm, remarkBreaks]}
			rehypePlugins={[rehypeSanitize]}
			components={{
				a: (props) => (
					<a {...props} target="_blank" rel="noreferrer" className="text-primary hover:underline" />
				),
				// Inline code styling - uses CSS variables for theme compatibility
				// Block code (inside <pre>) inherits styles from .markdown-body pre code
				code: ({ className: codeClassName, node, ...props }) => {
					// Check if this is a code block (inside pre) or inline code
					const isInline =
						!node?.position?.start?.line ||
						node?.position?.start?.line === node?.position?.end?.line;

					if (isInline) {
						return (
							<code
								{...props}
								className={cn(
									"rounded px-1.5 py-0.5 text-[0.9em] font-mono",
									"bg-muted text-primary border border-border",
									codeClassName,
								)}
							/>
						);
					}
					// Block code - let CSS handle it
					return <code {...props} className={codeClassName} />;
				},
			}}
		>
			{content}
		</ReactMarkdown>
	);
}
