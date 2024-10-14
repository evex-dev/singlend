/**
 * @module @evex/singlend
 * @description Multiple operations on a single endpoint with zod 🚀
 */
import type { JSONValue } from "@hono/hono/utils/types";
import { z, type ZodError, type ZodSchema } from "zod";
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

/**
 * @class Singlend
 * @classdesc Multiple operations on a single endpoint with zod 🚀
 */
export class Singlend<Routes extends AbstractRoutes = BlankRoutes> {
	private forceStrictSchema = false;
	public routes: AbstractRoutes = [];

	/**
	 * @description Create a new instance of Singlend
	 * @param {Object} [options]
	 * @param {boolean} [options.forceStrictSchema=true] - Force the zod schema to be strict
	 */
	constructor({
		forceStrictSchema = true,
	}: {
		forceStrictSchema?: boolean;
	} = { forceStrictSchema: true }) {
		this.forceStrictSchema = forceStrictSchema;
	}

	/**
	 * @description Add a new route to the singlend
	 * @param type - The type of the route
	 * @param queryScheme - The zod schema for the query
	 * @param handler - The handler for the route
	 * @returns The same instance of Singlend, with the new route added
	 */
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

	/**
	 * @description Middleware to handle singlend request
	 * @param {Object} [options]
	 * @param {string[]} [options.methods=["POST"]] - List of methods to handle
	 * @returns {MiddlewareHandler}
	 */
	public middleware({
		methods,
	}: {
		methods: string[];
	} = { methods: ["POST"] }): MiddlewareHandler {
		return async (c, next) => {
			if (!methods.includes(c.req.method)) {
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

			const parsedQuery = await (
				this.forceStrictSchema
					? z.getParsedType(queryScheme) === "object"
						? (queryScheme as z.ZodObject<z.ZodRawShape>).strict()
						: queryScheme
					: queryScheme
			).safeParseAsync(json.query);

			if (!parsedQuery.success) {
				throw this.HTTPExceptions.InvalidQuery;
			}

			try {
				const response = await handler(
					parsedQuery.data,
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
