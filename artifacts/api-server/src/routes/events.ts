import { Router, type IRouter, type Request, type Response } from "express";
import { db, linesTable } from "@workspace/db";
import { addSubscriber, removeSubscriber } from "../lib/sse";

const router: IRouter = Router();

router.get("/events", async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const rows = await db.select().from(linesTable).orderBy(linesTable.id);
  const snapshot: Record<string, { state: string; label: string; updatedAt: string }> = {};
  for (const r of rows) {
    snapshot[r.id] = { state: r.state, label: r.label, updatedAt: r.updatedAt.toISOString() };
  }
  res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);

  const send = (event: object) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  addSubscriber(send);

  const keepalive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(keepalive);
    removeSubscriber(send);
  });
});

export default router;
