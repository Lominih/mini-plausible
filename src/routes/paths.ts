import { Router, Response } from "express";
import { z } from "zod";
import { handleError, notFound } from "../utils/errors";
import { AuthenticatedRequest, verifySiteAccess } from "../middleware/auth";
import { analyzeUserPaths } from "../services/user-paths";

const router = Router();

const queryPathsSchema = z.object({
  siteId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  maxDepth: z.coerce.number().min(1).max(10).optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
});



router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const params = queryPathsSchema.parse({
      siteId: req.query.siteId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      maxDepth: req.query.maxDepth,
      limit: req.query.limit,
    });

    const membership = await verifySiteAccess(req.user.userId, params.siteId);
    if (!membership) {
      notFound(res, "Site");
      return;
    }

    const startDate = params.startDate
      ? new Date(params.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = params.endDate ? new Date(params.endDate) : new Date();

    const result = await analyzeUserPaths({
      siteId: params.siteId,
      startDate,
      endDate,
      maxDepth: params.maxDepth,
      limit: params.limit,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    handleError(res, error, "Failed to analyze user paths");
  }
});

export default router;