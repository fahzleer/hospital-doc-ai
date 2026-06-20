export default function handler(request: Request): Response {
  console.log("[vercel] minimal handler reached:", request.url);
  return new Response("ok", { status: 200 });
}
