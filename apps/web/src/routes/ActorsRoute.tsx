import { ActorManagement } from "@/components/actors";

/**
 * Route wrapper for ActorManagement.
 * ActorManagement is self-contained and fetches its own data.
 */
export function ActorsRoute() {
	return <ActorManagement />;
}
