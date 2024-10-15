import type {
	AbstractGroup,
	AbstractRoute,
	AbstractRoutes,
} from "../lib/types.ts";

export function findRoute(
	routes: AbstractRoutes,
	type: string,
): AbstractRoute | [AbstractGroup, AbstractRoute] | null {
	for (let i = 0, len = routes.length | 0; i < len; i = (i + 1) | 0) {
		const route = routes[i];

		if (route.routeType === "group") {
			const result = findRoute(route.routes, type);

			// NOTE: WILL SUPPORT NESTED GROUP
			if (result && !Array.isArray(result)) {
				return [route, result];
			}
		} else {
			if (route.type === type) {
				return route;
			}
		}
	}

	return null;
}
