import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { handleError, notFound } from "../utils/errors";
import { AuthenticatedRequest } from "../middleware/auth";

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().max(128).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(128).optional(),
}).refine(
  (data) => !(data.newPassword && !data.currentPassword),
  { message: "Current password is required when setting a new password" }
);

router.get("/me", async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { sites: true } },
      },
    });

    if (!user) {
      notFound(res, "User");
      return;
    }

    res.json({ user });
  } catch (error) {
    handleError(res, error, "Failed to fetch profile");
  }
});

router.put("/me", async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const body = updateProfileSchema.parse(req.body);
    const userId = req.user.userId;

    if (body.currentPassword && body.newPassword) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });

      if (!user) {
        notFound(res, "User");
        return;
      }

      const valid = await bcrypt.compare(body.currentPassword, user.password);
      if (!valid) {
        res.status(401).json({ error: "Current password is incorrect" });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.newPassword) updateData.password = await bcrypt.hash(body.newPassword, 12);

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });

    res.json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    handleError(res, error, "Failed to update profile");
  }
});

router.delete("/me", async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    await prisma.user.delete({ where: { id: req.user.userId } });
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    handleError(res, error, "Failed to delete account");
  }
});

export default router;