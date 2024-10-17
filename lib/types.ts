import type { JSONValue } from "@hono/hono/utils/types";
import type {
	ClientErrorStatusCode,
	ServerErrorStatusCode,
	StatusCode,
	SuccessStatusCode,
} from "@hono/hono/utils/http-status";
import type { z, ZodError, ZodSchema } from "zod";
import type { HTTPException } from "@hono/hono/http-exception";
import type { Context } from "@hono/hono";

export type PromiseUnion<ValueType> = ValueType | Promise<ValueType>;

export interface Route<
	Type extends string,
	QuerySchemeType extends ZodSchema,
	ReturnType extends JSONValue,
> {
	routeType: "route";
	type: Type;
	queryScheme: QuerySchemeType;
	handler:
		| RouteHandler<QuerySchemeType, ReturnType> // deno-lint-ignore no-explicit-any
		| RouteHandler<QuerySchemeType, ReturnType, any>;
}

export interface Group<
	ChildRoutes extends AbstractRoute[],
	QuerySchemeType extends ZodSchema,
	ReturnType extends JSONValue,
	ValueType,
> {
	routeType: "group";
	routes: ChildRoutes;
	queryScheme: QuerySchemeType;
	handler: GroupHandler<QuerySchemeType, ReturnType, ValueType>;
}

export type IsNever<T> = [T] extends [never] ? true : false;
export type IsAllNever<T extends unknown[]> = [T[number]] extends [never] ? true
	: false;
export type Prettify<T> =
	& {
		[K in keyof T]: T[K];
	}
	// deno-lint-ignore ban-types
	& {};

export type RouteHandler<
	QuerySchemeType extends ZodSchema,
	ReturnType extends JSONValue,
	ValueType = never,
	GroupQuerySchemeType extends ZodSchema = never,
> = IsAllNever<[ValueType, GroupQuerySchemeType]> extends true ? (
		query: z.infer<QuerySchemeType>,
		ok: (
			response: ReturnType,
			status?: SuccessStatusCode,
		) => {
			status: SuccessStatusCode;
			response: ReturnType;
		},
		error: (
			response: ReturnType,
			status?: ClientErrorStatusCode | ServerErrorStatusCode,
		) => {
			status: ClientErrorStatusCode | ServerErrorStatusCode;
			response: ReturnType;
		},
		response: (
			response: ReturnType,
			status: StatusCode,
		) => {
			status: StatusCode;
			response: ReturnType;
		},
	) => PromiseUnion<{
		status: StatusCode;
		response: ReturnType;
	}>
	: (
		query: Prettify<
			z.infer<QuerySchemeType> & z.infer<GroupQuerySchemeType>
		>,
		value: ValueType,
		ok: (
			response: ReturnType,
			status?: SuccessStatusCode,
		) => {
			status: SuccessStatusCode;
			response: ReturnType;
		},
		error: (
			response: ReturnType,
			status?: ClientErrorStatusCode | ServerErrorStatusCode,
		) => {
			status: ClientErrorStatusCode | ServerErrorStatusCode;
			response: ReturnType;
		},
		response: (
			response: ReturnType,
			status: StatusCode,
		) => {
			status: StatusCode;
			response: ReturnType;
		},
	) => PromiseUnion<{
		status: StatusCode;
		response: ReturnType;
	}>;

export type GroupHandler<
	QuerySchemeType extends ZodSchema,
	ReturnType extends JSONValue,
	ValueType,
> = (
	query: z.infer<QuerySchemeType>,
	next: <ValueType>(value: ValueType) => {
		value: ValueType;
	},
	error: (
		response: ReturnType,
		status?: ClientErrorStatusCode | ServerErrorStatusCode,
	) => {
		status: ClientErrorStatusCode | ServerErrorStatusCode;
		response: ReturnType;
	},
	response: (
		response: ReturnType,
		status: StatusCode,
	) => {
		status: StatusCode;
		response: ReturnType;
	},
) => PromiseUnion<
	| {
		status: StatusCode;
		response: ReturnType;
	}
	| {
		value: ValueType;
	}
>;

// deno-lint-ignore no-explicit-any
export type AbstractRoute = Route<string, any, JSONValue>;

// deno-lint-ignore no-explicit-any
export type AbstractGroup = Group<AbstractRoute[], ZodSchema, JSONValue, any>;

export type AbstractRoutes = (AbstractRoute | AbstractGroup)[];

export type BlankRoutes = [];

export type MergeRoutes<
	Routes extends AbstractRoutes,
	_Routes extends AbstractRoutes,
> = [...Routes, ..._Routes];

export type HTTPExceptions = {
	InvalidJSON: HTTPException;
	InvalidQuery: HTTPException;
	InvalidQuerySchema: (error: ZodError, c: Context) => HTTPException;
	NotFoundQueryType: HTTPException;
	InternalServerError: (error: Error, c: Context) => HTTPException;
};

export interface RequestQueryType<
	Type extends string,
	Query extends JSONValue,
> {
	type: Type;
	query: Query;
}

export type ExtractQueryTypesFromRoutes<
	Routes extends AbstractRoutes,
	GroupQuerySchemeType extends ZodSchema = never,
> = Routes[number] extends infer _Route ? (
		// deno-lint-ignore no-explicit-any
		_Route extends Route<infer Type, infer QuerySchemaType, any>
			? RequestQueryType<
				Type,
				Prettify<
					& z.infer<QuerySchemaType>
					& (
						// deno-lint-ignore ban-types
						IsNever<GroupQuerySchemeType> extends true ? {}
							: z.infer<GroupQuerySchemeType>
					)
				>
			>
			: (
				_Route extends // deno-lint-ignore no-explicit-any
				Group<infer _Routes, infer GroupQuerySchemeType, any, any>
					? ExtractQueryTypesFromRoutes<_Routes, GroupQuerySchemeType>
					: never
			)
	)
	: never;
