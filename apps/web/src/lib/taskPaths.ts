export function formatProjectPath(path?: string | null): string {
	if (!path) return "root";
	const trimmed = path.trim();
	return trimmed.length > 0 ? trimmed : "root";
}

export function formatTaskPath(projectPath: string | null | undefined, slug: string): string {
	const trimmed = projectPath?.trim();
	return trimmed ? `${trimmed}/${slug}` : slug;
}
