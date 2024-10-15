import type {
	AbstractGroup,
	AbstractRoute,
	AbstractRoutes,
} from "../lib/types.ts";

export function findRoute(
	routes: AbstractRoutes,
	type: string,
	isGroup = false,
): AbstractRoute | [AbstractGroup, AbstractRoute] | null {
	for (let i = 0 | 0, len = routes.length | 0; i < len; i = (i + 1) | 0) {
		const route = routes[i];

		if (route.routeType === "group" && !isGroup) {
			const result = findRoute(route.routes, type, true);

			if (result) {
				return [route, result as AbstractRoute];
			}
		} else if (route.routeType === "route") {
			if (route.type === type) {
				return route;
			}
		}
	}

	return null;
}
