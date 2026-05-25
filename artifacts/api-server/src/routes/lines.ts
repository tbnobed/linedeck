import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, linesTable } from "@workspace/db";
import {
  UpdateLineBody,
  UpdateLineParams,
  ResetLinesResponse,
  GetLinesResponse,
  UpdateLineResponse,
} from "@workspace/api-zod";
import { broadcast } from "../lib/sse";

const router: IRouter = Router();

router.get("/lines", async (_req, res): Promise<void> => {
  const rows = await db.select().from(linesTable).orderBy(linesTable.id);
  res.json(GetLinesResponse.parse(rows));
});

router.put("/lines/:lineId", async (req: Request, res: Response): Promise<void> => {
  const raw = Array.isArray(req.params.lineId) ? req.params.lineId[0] : req.params.lineId;
  const lineId = raw as string;

  const parsed = UpdateLineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { state, label } = parsed.data;

  const [existing] = await db.select().from(linesTable).where(eq(linesTable.id, lineId));

  const newState = state ?? existing?.state ?? "idle";
  const newLabel = label !== undefined ? label.slice(0, 120) : (existing?.label ?? "");

  const [row] = await db
    .insert(linesTable)
    .values({ id: lineId, state: newState, label: newLabel, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: linesTable.id,
      set: { state: newState, label: newLabel, updatedAt: new Date() },
    })
    .returning();

  broadcast({ type: "line", id: lineId, state: row.state, label: row.label, updatedAt: row.updatedAt.toISOString() });

  res.json(UpdateLineResponse.parse(row));
});

router.post("/reset", async (_req, res): Promise<void> => {
  await db.delete(linesTable);
  broadcast({ type: "reset", updatedAt: new Date().toISOString() });
  res.json(ResetLinesResponse.parse({ ok: true }));
});

export default router;
