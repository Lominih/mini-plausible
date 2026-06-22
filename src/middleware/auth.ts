import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";
import { AuthPayload } from "../types/analytics";

const JWT_SECRET = process.env.JWT_SECRET || "mini-plausible-dev-secret-change-in-production";

const PUBLIC_ROUTES = [
  { method: "POST", path: "/api/event" },
  { method: "POST", path: "/api/events" },
  { method: "GET", path: "/health" },
  { method: "GET", path: "/api/health" },
];

function isPublicRoute(method: string, path: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) =>
      route.method.toUpperCase() === method.toUpperCase() &&
      path.startsWith(route.path)
  );
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
  siteId?: string;
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (isPublicRoute(req.method, req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;

  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : queryToken;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireSiteAccess(paramName: string = "id") {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const paramValue = req.params[paramName];
    const siteId = (typeof paramValue === "string" ? paramValue : undefined)
      || (typeof req.query.siteId === "string" ? req.query.siteId : undefined);

    if (!siteId) {
      res.status(400).json({ error: "Site ID is required" });
      return;
    }

    req.siteId = siteId;

    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (req.user.siteAccess && req.user.siteAccess.includes(siteId)) {
      next();
      return;
    }

    prisma.siteMember
      .findFirst({
        where: {
          userId: req.user.userId,
          siteId: siteId,
        },
      })
      .then((membership) => {
        if (!membership) {
          res.status(403).json({ error: "You do not have access to this site" });
          return;
        }
        next();
      })
      .catch(() => {
        res.status(500).json({ error: "Authorization check failed" });
      });
  };
}
export async function verifySiteAccess(userId: string, siteId: string) {
  return prisma.siteMember.findFirst({ where: { userId, siteId } });
}