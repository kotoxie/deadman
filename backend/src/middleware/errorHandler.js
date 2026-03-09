import logger from '../utils/logger.js';
import config from '../config/index.js';

export function errorHandler(err, req, res, _next) {
  logger.error(`${err.message}`, { stack: err.stack, path: req.path });

  const statusCode = err.statusCode || 500;
  const response = {
    error: err.message || 'Internal server error',
  };

  if (config.isDev) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
