import logger from '../utils/logger.js';

export function errorHandler(err, req, res, _next) {
  logger.error(`${err.message}`, { stack: err.stack, path: req.path });

  const statusCode = err.statusCode || 500;
  const response = {
    error: statusCode >= 500 ? 'Internal server error' : (err.message || 'Internal server error'),
  };

  res.status(statusCode).json(response);
}
