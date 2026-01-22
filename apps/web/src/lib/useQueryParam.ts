import { useCallback, useEffect, useState } from "react";

export function useQueryParam(
	key: string,
): [string | null, (value: string | null, opts?: { replace?: boolean }) => void] {
	const readValue = () => {
		const params = new URLSearchParams(window.location.search);
		return params.get(key);
	};

	const [value, setValue] = useState<string | null>(() => readValue());

	// biome-ignore lint/correctness/useExhaustiveDependencies: key triggers re-registration, readValue uses key from closure
	useEffect(() => {
		const onPop = () => setValue(readValue());
		window.addEventListener("popstate", onPop);
		return () => window.removeEventListener("popstate", onPop);
	}, [key]);

	const update = useCallback(
		(next: string | null, opts?: { replace?: boolean }) => {
			const url = new URL(window.location.href);
			if (next) {
				url.searchParams.set(key, next);
			} else {
				url.searchParams.delete(key);
			}
			if (opts?.replace) {
				window.history.replaceState({}, "", url.toString());
			} else {
				window.history.pushState({}, "", url.toString());
			}
			setValue(next);
		},
		[key],
	);

	return [value, update];
}
