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
	QuerySchemeType extends ZodSchema,
	ReturnType extends JSONValue,
> {
	routeType: "route";
	type: string;
	queryScheme: QuerySchemeType;
	handler:
		| RouteHandler<QuerySchemeType, ReturnType>
		| // deno-lint-ignore no-explicit-any
		RouteHandler<QuerySchemeType, ReturnType, any>;
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
	GroupQueryType extends ZodSchema = never,
> = IsAllNever<[ValueType, GroupQueryType]> extends true ? ((
		query: z.infer<QuerySchemeType>,
		ok: (response: ReturnType, status?: SuccessStatusCode) => {
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
		response: (response: ReturnType, status: StatusCode) => {
			status: StatusCode;
			response: ReturnType;
		},
	) => PromiseUnion<{
		status: StatusCode;
		response: ReturnType;
	}>)
	: ((
		query: Prettify<z.infer<QuerySchemeType> & z.infer<GroupQueryType>>,
		value: ValueType,
		ok: (response: ReturnType, status?: SuccessStatusCode) => {
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
		response: (response: ReturnType, status: StatusCode) => {
			status: StatusCode;
			response: ReturnType;
		},
	) => PromiseUnion<{
		status: StatusCode;
		response: ReturnType;
	}>);

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
	response: (response: ReturnType, status: StatusCode) => {
		status: StatusCode;
		response: ReturnType;
	},
) => PromiseUnion<
	{
		status: StatusCode;
		response: ReturnType;
	} | {
		value: ValueType;
	}
>;

export type AbstractRoute = Route<ZodSchema, JSONValue>;

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
