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
	type: string;
	queryScheme: QuerySchemeType;
	handler: RouteHandler<QuerySchemeType, ReturnType>;
}

export type RouteHandler<
	QuerySchemeType extends ZodSchema,
	ReturnType extends JSONValue,
> = (
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
}>;

export type AbstractRoute = Route<ZodSchema, JSONValue>;

export type AbstractRoutes = AbstractRoute[];

export type BlankRoutes = [];

export type MergeRoutes<
	Routes extends AbstractRoutes,
	_Route extends AbstractRoute,
> = [...Routes, _Route];

export type HTTPExceptions = {
	InvalidJSON: HTTPException;
	InvalidQuery: HTTPException;
	InvalidQuerySchema: (error: ZodError, c: Context) => HTTPException;
	NotFoundQueryType: HTTPException;
	InternalServerError: (error: Error, c: Context) => HTTPException;
};
