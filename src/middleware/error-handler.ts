import type { Request, Response, NextFunction } from "express";

interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  const timestamp = new Date().toISOString();
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";

  if (!err.isOperational) {
    console.error(`[${timestamp}] UNEXPECTED ERROR: ${err.message}`, err.stack);
  }

  res.status(statusCode).json({
    error: err.isOperational ? err.message : "Internal server error",
    code,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

export function createError(statusCode: number, message: string, code?: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.code = code;
  err.isOperational = true;
  return err;
}