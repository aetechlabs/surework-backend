import { Router, Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { generateWallet } from '../services/wallet';

const router = Router();
const prisma = new PrismaClient();

// Register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('fullName').trim().notEmpty(),
    body('role').isIn(['CLIENT', 'FREELANCER']).optional(),
    validate,
  ],
  async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    try {
      const { email, password, fullName, role } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new AppError('Email already registered', 400);
      }

      // Generate wallet for user (Account Abstraction)
      const { address: walletAddress } = await generateWallet();

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          role: role || 'FREELANCER',
          walletAddress,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          walletAddress: true,
          createdAt: true,
        },
      });

      // Generate JWT
      const jwtSecret = process.env.JWT_SECRET || 'dev_secret';
      const jwtExpiry = process.env.JWT_EXPIRY || '7d';
      // @ts-expect-error - jsonwebtoken v9.0.3 type definition issue with expiresIn
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        jwtSecret,
        { expiresIn: jwtExpiry }
      );

      res.status(201).json({
        status: 'success',
        data: { user, token },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    validate,
  ],
  async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new AppError('Invalid credentials', 401);
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        throw new AppError('Invalid credentials', 401);
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Generate JWT
      const jwtSecret = process.env.JWT_SECRET || 'dev_secret';
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        jwtSecret,
        { expiresIn: '7d' }
      );

      res.json({
        status: 'success',
        data: {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            walletAddress: user.walletAddress,
          },
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
