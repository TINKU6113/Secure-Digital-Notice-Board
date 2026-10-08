import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Always log full error server-side for internal diagnostic tracing
  console.error(`[Unhandled Error] ${req.method} ${req.url}:`, {
    message: err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    code: err.code,
  });

  // Handle payload too large (DoS prevention)
  if (err.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds maximum allowed size (100KB)',
      },
    });
    return;
  }

  // Handle malformed JSON body
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload in request body',
      },
    });
    return;
  }

  // Handle known operational status codes
  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  
  // Safe sanitized message for external clients
  const message = statusCode === 500
    ? 'An unexpected internal error occurred. Please contact system administrator.'
    : err.message || 'Operation failed';

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message,
    },
  });
}
