/**
 * @module @evex/singlend
 * @description Multiple operations on a single endpoint with hono and zod 🚀
 */
import type { JSONValue } from "@hono/hono/utils/types";
import { z, type ZodError, type ZodSchema } from "zod";
import type {
	AbstractRoute,
	AbstractRoutes,
	BlankRoutes,
	ExtractQueryTypesFromRoutes,
	Group,
	GroupHandler,
	HTTPExceptions,
	MergeRoutes,
	Prettify,
	Route,
	RouteHandler,
} from "./types.ts";
import { HTTPException } from "@hono/hono/http-exception";
import type {
	Handler,
	HandlerResponse,
	ValidationTargets,
} from "@hono/hono/types";
import { safeJsonParse } from "../utils/safeJsonParse.ts";
import { findRoute } from "../utils/findRoute.ts";
import type { Context } from "@hono/hono";

/**
 * @class Singlend
 * @classdesc Multiple operations on a single endpoint with hono and zod 🚀
 * @description Create a new instance of Singlend
 */
export class Singlend<
	Routes extends AbstractRoutes = BlankRoutes,
	ValueType = never,
	GroupQuerySchemeType extends ZodSchema = never,
> {
	private readonly strictSchema: boolean = true;
	public readonly routes: AbstractRoutes = [];

	/**
	 * @description Create a new instance of Singlend
	 * @param {Object} [options]
	 * @param {boolean} [options.strictSchema=true] - The zod schema to be strict
	 */
	constructor({
		strictSchema = true,
	}: {
		strictSchema?: boolean;
	} = { strictSchema: true }) {
		this.strictSchema = strictSchema;
	}

	/**
	 * @description Add a new route to the singlend
	 * @param type - The type of the route
	 * @param queryScheme - The zod schema for the query
	 * @param handler - The handler for the route
	 * @returns The same instance of Singlend, with the new route added
	 */
	public on<
		Type extends string,
		QuerySchemeType extends ZodSchema,
		ReturnType extends JSONValue,
	>(
		type: Type,
		queryScheme: QuerySchemeType,
		handler: RouteHandler<
			QuerySchemeType,
			ReturnType,
			ValueType,
			GroupQuerySchemeType
		>,
	): Singlend<
		// @ts-expect-error: TS Limitation
		MergeRoutes<
			Routes,
			// @ts-expect-error: TS Limitation
			[Route<Type, QuerySchemeType, ReturnType>]
		>
	> {
		this.routes.push({
			routeType: "route",
			type,
			queryScheme,
			// @ts-expect-error: TS Limitation
			handler,
		});

		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	/**
	 * @description Add a new group of routes to the singlend
	 * @param queryScheme - The zod schema for the query
	 * @param handler - The handler for the group
	 * @param childRoutes - The child routes of the group
	 * @returns The same instance of Singlend, with the new group added
	 */
	public group<
		ChildRoutes extends AbstractRoute[],
		QuerySchemeType extends ZodSchema,
		ReturnType extends JSONValue,
		_ValueType,
	>(
		queryScheme: QuerySchemeType,
		handler: GroupHandler<QuerySchemeType, ReturnType, _ValueType>,
		instanceHandler: (
			singlend: Singlend<[], _ValueType, QuerySchemeType>,
		) => Singlend<ChildRoutes, _ValueType, QuerySchemeType>,
	): Singlend<
		// @ts-expect-error: TS Limitation
		MergeRoutes<
			Routes,
			// @ts-expect-error: TS Limitation
			[Group<ChildRoutes, QuerySchemeType, ReturnType, _ValueType>]
		>,
		never
	> {
		this.routes.push({
			routeType: "group",
			routes: instanceHandler(
				new Singlend({
					strictSchema: this.strictSchema,
				}),
			).routes as AbstractRoute[],
			queryScheme,
			// @ts-expect-error: TS Limitation
			handler,
		});

		// deno-lint-ignore no-explicit-any
		return this as any;
	}

	/**
	 * @description Mount multiple instances of Singlend to the current instance.
	 * @param instances - The instances to mount
	 * @returns The same instance of Singlend, with the new routes added
	 */
	// deno-lint-ignore no-explicit-any
	public mount<Instances extends Singlend<AbstractRoutes, any, any>[]>(
		...instances: Instances
	): Singlend<
		MergeRoutes<
			Routes,
			Instances extends (infer I)[]
				// deno-lint-ignore no-explicit-any
				? I extends Singlend<infer _Routes, any, any> ? _Routes : []
				: []
		>,
		ValueType,
		GroupQuerySchemeType
	> {
		for (const instance of instances) {
			this.routes.push(...instance.routes);
		}

		// deno-lint-ignore no-explicit-any
		return this as any;
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
				res: c.json({
					name: error.name,
					message: error.message,
				}),
			}),
	} as const;

	/**
	 * @description Get the handler for the singlend
	 * @returns The handler for the singlend
	 */
	// deno-lint-ignore no-explicit-any
	public handler(): Handler<string, any, {
		in: Prettify<
			Omit<Partial<ValidationTargets>, "json"> & {
				// deno-lint-ignore ban-types
				json: ExtractQueryTypesFromRoutes<Routes> | (string & {});
			}
		>;
		outputFormat: "json";
	}, HandlerResponse<JSONValue>> {
		return async (c: Context) => {
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

			let foundRoute = findRoute(this.routes, json.type);

			if (!foundRoute) {
				throw this.HTTPExceptions.NotFoundQueryType;
			}

			// deno-lint-ignore no-explicit-any
			let value: any = null;
			let groupQueryScheme: ZodSchema | null = null;

			if (Array.isArray(foundRoute)) {
				const [group, route] = foundRoute;

				const { queryScheme, handler } = group;

				groupQueryScheme = queryScheme;

				const parsedQuery = await queryScheme.safeParseAsync(
					json.query,
				);

				if (!parsedQuery.success) {
					throw this.HTTPExceptions.InvalidQuerySchema(
						parsedQuery.error,
						c,
					);
				}

				try {
					const response = await handler(
						parsedQuery.data,
						(value) => {
							return {
								value,
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

					if ("status" in response) {
						return c.text(JSON.stringify(response.response), {
							status: response.status,
							headers: new Headers({
								"Content-Type": "application/json",
							}),
						});
					}

					value = response.value;
				} catch (e) {
					this.throwException(e, c);
				}

				foundRoute = route;
			}

			const { queryScheme, handler } = foundRoute;

			const parsedQuery = await (
				groupQueryScheme
					? (this.strictSchema
						? z.getParsedType(queryScheme) === "object"
							? (queryScheme as z.ZodObject<z.ZodRawShape>)
								.merge(groupQueryScheme as z.AnyZodObject)
								.strict()
							: queryScheme
						: queryScheme)
					: (this.strictSchema
						? z.getParsedType(queryScheme) === "object"
							? (queryScheme as z.ZodObject<z.ZodRawShape>)
								.strict()
							: queryScheme
						: queryScheme)
			).safeParseAsync(json.query);

			if (!parsedQuery.success) {
				throw this.HTTPExceptions.InvalidQuerySchema(
					parsedQuery.error,
					c,
				);
			}

			try {
				const response = value
					? await (handler as unknown as RouteHandler<
						ZodSchema,
						JSONValue,
						// deno-lint-ignore no-explicit-any
						any,
						// deno-lint-ignore no-explicit-any
						any
					>)(
						parsedQuery.data,
						value,
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
					)
					: await (handler as unknown as RouteHandler<
						ZodSchema,
						JSONValue
					>)(
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
					}),
				});
			} catch (e) {
				this.throwException(e, c);
			}

			return c.notFound();
		};
	}

	private throwException(error: unknown, c: Context) {
		if (error instanceof HTTPException) {
			throw error;
		} else if (error instanceof Error) {
			throw this.HTTPExceptions.InternalServerError(error, c);
		} else {
			throw this.HTTPExceptions.InternalServerError(
				new Error("Unknown error"),
				c,
			);
		}
	}
}
