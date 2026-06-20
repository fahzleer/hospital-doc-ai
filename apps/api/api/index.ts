export default async function handler(request: Request): Promise<Response> {
  try {
    const { app } = await import("../src/app");
    return await app.fetch(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;

    console.error("[api] bootstrap/handler error:", message, stack);

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
