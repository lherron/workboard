/**
 * Global UI Concierge components.
 *
 * Usage in main.tsx:
 * ```tsx
 * <ConciergeProvider>
 *   <Router>
 *     <AppRoutes />
 *   </Router>
 * </ConciergeProvider>
 * ```
 *
 * Usage in routes.tsx:
 * ```tsx
 * <>
 *   <ConciergeToggle />
 *   <ConciergePanel />
 *   <Switch>
 *     ...routes
 *   </Switch>
 * </>
 * ```
 */

export { ConciergePanel } from "./ConciergePanel";
export { ConciergeProvider } from "./ConciergeProvider";
export { ConciergeToggle } from "./ConciergeToggle";
export { useConcierge } from "./useConcierge";
