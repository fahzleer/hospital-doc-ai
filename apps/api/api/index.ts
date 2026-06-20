import { app } from "../src/app";

export default async function handler(request: Request): Promise<Response> {
  try {
    return await app.fetch(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;

    console.error("[api] handler error:", message, stack);

    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message,
        ...(stack ? { stack } : {}),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
