/**
 * Global error-handling middleware.
 * Catches unhandled errors and returns structured JSON responses.
 * Must be registered after all routes (Express recognizes 4-arg middleware as error handlers).
 */
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${err.message}`, {
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Prisma known request errors (e.g., unique constraint violation)
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: {
        message: 'A record with that value already exists.',
        code: 'DUPLICATE_ENTRY',
      },
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: {
        message: 'Record not found.',
        code: 'NOT_FOUND',
      },
    });
  }

  // Validation errors (custom — we'll throw these from routes)
  if (err.status && err.status < 500) {
    return res.status(err.status).json({
      error: {
        message: err.message,
        code: err.code || 'VALIDATION_ERROR',
      },
    });
  }

  // Default: internal server error
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: {
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
      code: 'INTERNAL_ERROR',
    },
  });
}

module.exports = errorHandler;
