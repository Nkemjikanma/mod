import { makeTownsBot } from "@towns-protocol/bot";
import { Hono } from "hono";
import { logger } from "hono/logger";
import commands from "./commands";
import { jwtMiddleware, handler } from "./bot";

const app = new Hono();
app.use(logger());
app.post("/webhook", jwtMiddleware, handler);

app.get("/", (c) => c.text("✅ ModBot is running"));

export default app;
