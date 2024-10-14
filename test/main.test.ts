import { Hono } from "@hono/hono";
import { z } from "zod";
import { Singlend } from "../lib/mod.ts";

const app = new Hono();
const singlend = new Singlend();

singlend
	.on(
		"setIcon",
		z.object({
			iconUrl: z.string(),
		}),
		(query, ok) =>
			ok({
				message: "Set icon to " + query.iconUrl,
			}),
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
	);

app.use("/api/singlend", singlend.middleware());

Deno.serve({ port: 3000 }, app.fetch);
