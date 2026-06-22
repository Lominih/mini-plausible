import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { handleError, notFound } from "../utils/errors";
import { AuthenticatedRequest, verifySiteAccess } from "../middleware/auth";

const router = Router();

const createDefSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().min(1).max(128),
  propertiesSchema: z.record(z.string(), z.string()).optional(),
});

const updateDefSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  propertiesSchema: z.record(z.string(), z.string()).optional(),
});



// List event definitions for a site
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const siteId = req.query.siteId as string;
    if (!siteId) {
      res.status(400).json({ error: "siteId query parameter is required" });
      return;
    }

    const membership = await verifySiteAccess(req.user.userId, siteId);
    if (!membership) {
      notFound(res, "Site");
      return;
    }

    const definitions = await prisma.eventDefinition.findMany({
      where: { siteId },
      orderBy: { name: "asc" },
    });

    res.json({
      definitions: definitions.map((d) => ({
        id: d.id,
        siteId: d.siteId,
        name: d.name,
        propertiesSchema: JSON.parse(d.propertiesSchema),
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch event definitions");
  }
});

// Create event definition
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const body = createDefSchema.parse(req.body);

    const membership = await verifySiteAccess(req.user.userId, body.siteId);
    if (!membership) {
      notFound(res, "Site");
      return;
    }

    const definition = await prisma.eventDefinition.create({
      data: {
        siteId: body.siteId,
        name: body.name,
        propertiesSchema: JSON.stringify(body.propertiesSchema || {}),
      },
    });

    res.status(201).json({
      definition: {
        id: definition.id,
        siteId: definition.siteId,
        name: definition.name,
        propertiesSchema: JSON.parse(definition.propertiesSchema),
        createdAt: definition.createdAt,
        updatedAt: definition.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    handleError(res, error, "Failed to create event definition");
  }
});

// Update event definition
router.put("/:id", async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const id = String(req.params.id);
    const body = updateDefSchema.parse(req.body);

    const existing = await prisma.eventDefinition.findUnique({ where: { id } });
    if (!existing) {
      notFound(res, "Event definition");
      return;
    }

    const membership = await verifySiteAccess(req.user.userId, existing.siteId);
    if (!membership) {
      notFound(res, "Event definition");
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.propertiesSchema !== undefined) updateData.propertiesSchema = JSON.stringify(body.propertiesSchema);

    const definition = await prisma.eventDefinition.update({ where: { id }, data: updateData });

    res.json({
      definition: {
        id: definition.id,
        siteId: definition.siteId,
        name: definition.name,
        propertiesSchema: JSON.parse(definition.propertiesSchema),
        createdAt: definition.createdAt,
        updatedAt: definition.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    handleError(res, error, "Failed to update event definition");
  }
});

// Delete event definition
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const id = String(req.params.id);

    const existing = await prisma.eventDefinition.findUnique({ where: { id } });
    if (!existing) {
      notFound(res, "Event definition");
      return;
    }

    const membership = await verifySiteAccess(req.user.userId, existing.siteId);
    if (!membership) {
      notFound(res, "Event definition");
      return;
    }

    await prisma.eventDefinition.delete({ where: { id } });
    res.json({ message: "Event definition deleted" });
  } catch (error) {
    handleError(res, error, "Failed to delete event definition");
  }
});

export default router;