import type { JSONValue } from "@hono/hono/utils/types";
import type { ZodError, ZodSchema } from "zod";
import type {
	AbstractRoutes,
	BlankRoutes,
	HTTPExceptions,
	MergeRoutes,
	Route,
	RouteHandler,
} from "./types.ts";
import { HTTPException } from "@hono/hono/http-exception";
import type { MiddlewareHandler } from "@hono/hono/types";
import { safeJsonParse } from "../utils/safeJsonParse.ts";
import { findRoute } from "../utils/findRoute.ts";
import type { Context } from "@hono/hono";

export class Singlend<Routes extends AbstractRoutes = BlankRoutes> {
	routes: AbstractRoutes = [];

	constructor() {}

	public on<
		QuerySchemeType extends ZodSchema,
		ReturnType extends JSONValue,
	>(
		type: string,
		queryScheme: QuerySchemeType,
		handler: RouteHandler<QuerySchemeType, ReturnType>,
	): Singlend<
		// @ts-expect-error: TS Limitation
		MergeRoutes<
			Routes,
			// @ts-expect-error: TS Limitation
			Route<QuerySchemeType, ReturnType>
		>
	> {
		this.routes.push({
			type,
			queryScheme,
			// @ts-expect-error: TS Limitation
			handler,
		});

		return this;
	}

	public HTTPExceptions: HTTPExceptions = {
		InvalidJSON: new HTTPException(400, {
			message: "Invalid JSON",
		}),
		InvalidQuery: new HTTPException(400, {
			message: "Invalid Query",
		}),
		InvalidQuerySchema: (error: ZodError, c: Context) =>
			new HTTPException(400, {
				message: error.message,
				res: c.json(error),
			}),
		NotFoundQueryType: new HTTPException(400, {
			message: "Not Found Query Type",
		}),
		InternalServerError: (error: Error, c: Context) =>
			new HTTPException(500, {
				message: error.message,
				res: c.json(error),
			}),
	} as const;

	public middleware(): MiddlewareHandler {
		return async (c, next) => {
			if (c.req.method !== "POST") {
				await next();
				return;
			}

			const jsonString = await c.req.text();

			const json = safeJsonParse(jsonString);

			if (!json) {
				throw this.HTTPExceptions.InvalidJSON;
			}

			if (typeof json !== "object" || Array.isArray(json)) {
				throw this.HTTPExceptions.InvalidQuery;
			}

			if (!("type" in json) || !("query" in json)) {
				throw this.HTTPExceptions.InvalidQuery;
			}

			if (typeof json.type !== "string") {
				throw this.HTTPExceptions.InvalidQuery;
			}

			const foundRoute = findRoute(this.routes, json.type);

			if (!foundRoute) {
				throw this.HTTPExceptions.NotFoundQueryType;
			}

			const { queryScheme, handler } = foundRoute;

			const query = await queryScheme.safeParseAsync(json.query);

			if (!query.success) {
				throw this.HTTPExceptions.InvalidQuery;
			}

			try {
				const response = await handler(
					query.data,
					(response, statusCode = 200) => {
						return {
							status: statusCode,
							response,
						};
					},
					(response, statusCode = 400) => {
						return {
							status: statusCode,
							response,
						};
					},
					(response, statusCode) => {
						return {
							status: statusCode,
							response,
						};
					},
				);

				return c.text(JSON.stringify(response.response), {
					status: response.status,
					headers: new Headers({
						"Content-Type": "application/json",
						...c.res.headers,
					}),
				});
			} catch (e) {
				if (e instanceof HTTPException) {
					throw e;
				} else if (e instanceof Error) {
					throw this.HTTPExceptions.InternalServerError(e, c);
				} else {
					throw this.HTTPExceptions.InternalServerError(
						new Error("Unknown error"),
						c,
					);
				}
			}
		};
	}
}
