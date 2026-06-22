import { Response } from "express";

export function handleError(res: Response, error: unknown, context = "Internal server error"): void {
  console.error(`${context}:`, error);
  if (error instanceof Error && error.message.includes("Unique constraint")) {
    res.status(409).json({ error: "Resource already exists" });
    return;
  }
  res.status(500).json({ error: context });
}

export function notFound(res: Response, resource = "Resource"): void {
  res.status(404).json({ error: `${resource} not found` });
}