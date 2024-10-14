import type { JSONValue } from "@hono/hono/utils/types";

export function safeJsonParse(jsonString: string): null | JSONValue {
	try {
		return JSON.parse(jsonString);
	} catch {
		return null;
	}
}
