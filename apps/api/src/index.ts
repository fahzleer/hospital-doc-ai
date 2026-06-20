import { app } from "./app";

const port = Number(Bun.env.PORT ?? 3001);
app.listen(port);
console.log(`🦊 API running at http://localhost:${app.server?.port}`);
