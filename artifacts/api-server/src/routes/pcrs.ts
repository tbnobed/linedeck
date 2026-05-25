import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, pcrsTable, vmsTable } from "@workspace/db";
import {
  CreatePcrBody,
  UpdatePcrBody,
  UpdatePcrParams,
  UpdatePcrResponse,
  DeletePcrParams,
  ListPcrsResponse,
  ListPcrsResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/pcrs", async (_req, res): Promise<void> => {
  const rows = await db.select().from(pcrsTable).orderBy(pcrsTable.name);
  res.json(ListPcrsResponse.parse(rows));
});

router.post("/pcrs", async (req: Request, res: Response): Promise<void> => {
  const parsed = CreatePcrBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db.insert(pcrsTable).values(parsed.data).returning();
  res.status(201).json(ListPcrsResponseItem.parse(row));
});

router.patch("/pcrs/:id", async (req: Request, res: Response): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePcrParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePcrBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .update(pcrsTable)
    .set(parsed.data)
    .where(eq(pcrsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "PCR not found" });
    return;
  }

  res.json(UpdatePcrResponse.parse(row));
});

router.delete("/pcrs/:id", async (req: Request, res: Response): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePcrParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Unassign all VMs from this PCR before deleting
  await db.update(vmsTable).set({ pcrId: null }).where(eq(vmsTable.pcrId, params.data.id));

  const [row] = await db.delete(pcrsTable).where(eq(pcrsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "PCR not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
