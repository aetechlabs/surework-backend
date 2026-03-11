import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export const validate = (
  req: Request,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg).join(', ');
    return next(new AppError(errorMessages, 400));
  }
  next();
};
