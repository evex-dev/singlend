import { Hono } from "@hono/hono";
import { z } from "zod";
import { Singlend } from "../lib/mod.ts";
import { hc } from "@hono/hono/client";

const app = new Hono();
const singlend = new Singlend();

const sub = singlend.on(
	"getIcon",
	z.object({}),
	(_query, ok) => {
		return ok({
			iconUrl: "default.png",
		});
	},
);

const singleRoute = singlend
	.group(
		z.object({
			id: z.string(),
		}),
		(query, next, error) => {
			if (!query.id.startsWith("@")) {
				return error({
					message: "Invalid id",
				});
			} else {
				return next({
					id: query.id.slice(1),
				});
			}
		},
		(singlend) =>
			singlend.on(
				"setIcon",
				z.object({
					iconUrl: z.string(),
				}),
				(query, value, ok) =>
					ok({
						message: "Set icon of " + value.id + " to " +
							query.iconUrl,
					}),
			),
	)
	.on(
		"setBackgroundColor",
		z.object({
			backgroundColor: z.string().length(7),
		}),
		(query, ok, error) => {
			if (!query.backgroundColor.startsWith("#")) {
				return error({
					message: "Invalid background color",
				});
			}

			return ok({
				message: "Set background color to " + query.backgroundColor,
			});
		},
	)
	.mount(sub);

const routes = app.post("/api/singlend", singleRoute.handler());

Deno.serve({ port: 3000 }, app.fetch);

// in client
const client = hc<typeof routes>("/");

const response = await client.api.singlend.$post({
	json: {
		type: "setIcon",
		query: {
			id: "@12345",
			iconUrl: "default.png",
		},
	},
});

const data = await response.json();

// TODO: Add tests with Deno.test
