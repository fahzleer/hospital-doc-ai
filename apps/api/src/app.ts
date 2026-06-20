import { cors } from "@elysiajs/cors";
import Elysia from "elysia";
import { documentsRoute } from "./routes/documents";

export const app = new Elysia()
  .use(cors())
  .get("/health", () => ({ status: "ok" }))
  .use(documentsRoute);

export type App = typeof app;
