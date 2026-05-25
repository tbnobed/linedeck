import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, vmsTable } from "@workspace/db";
import {
  CreateVmBody,
  UpdateVmBody,
  UpdateVmParams,
  DeleteVmParams,
  ListVmsResponse,
  ListVmsResponseItem,
  UpdateVmResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/vms", async (_req, res): Promise<void> => {
  const rows = await db.select().from(vmsTable).orderBy(vmsTable.position, vmsTable.id);
  res.json(ListVmsResponse.parse(rows));
});

router.post("/vms", async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateVmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db.insert(vmsTable).values(parsed.data).returning();
  res.status(201).json(ListVmsResponseItem.parse(row));
});

router.patch("/vms/:id", async (req: Request, res: Response): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateVmParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateVmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .update(vmsTable)
    .set(parsed.data)
    .where(eq(vmsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "VM not found" });
    return;
  }

  res.json(UpdateVmResponse.parse(row));
});

router.delete("/vms/:id", async (req: Request, res: Response): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteVmParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db.delete(vmsTable).where(eq(vmsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "VM not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
