/**
 * Hook to access the ConciergeContext.
 *
 * @example
 * ```tsx
 * const { isOpen, toggle, submit } = useConcierge();
 * ```
 */

import { useContext } from "react";
import { ConciergeContext, type ConciergeContextValue } from "./ConciergeProvider";

export function useConcierge(): ConciergeContextValue {
	return useContext(ConciergeContext);
}
