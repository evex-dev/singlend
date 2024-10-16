# singlend

Multiple operations on a single endpoint with hono and zod 🚀

When using singlend, headers and cookies are anti-patterns ✖ Everything is
managed by the body, so session should be stored in localStorage, etc.\
It is more secure 🔓

## Hoe to use

```bash
npx jsr add @evex/singlend
bunx jsr add @evex/singlend
deno add @evex/singlend
```

```ts
import { Hono } from "@hono/hono";
import { z } from "zod";
import { Singlend } from "@evex/singlend";

const app = new Hono();
const singlend = new Singlend();

const sub = singlend.on(
	"getIcon",
	z.object({}),
	(_query, ok) => {
		return ok({
			iconUrl: "default.png",
		})
	},
)

singlend
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
	
app.use("/api/singlend", singlend.middleware());

// launch server
```

```ts
fetch("/api/singlend", {
	method: "POST",
	body: JSON.stringify({
		type: "setIcon",
		query: {
			id: "@114514",
			iconUrl: "default.png",
		},
	}),
});
```

More:
[https://jsr.io/@evex/singlend/doc/~/Singlend](https://jsr.io/@evex/singlend/doc/~/Singlend)

## ToDo

- Support `hc`
- Clean up dupl code
