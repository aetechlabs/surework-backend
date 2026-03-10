import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get current user profile
router.get('/me', authenticate, async (req: any, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        walletAddress: true,
        bio: true,
        avatarUrl: true,
        skills: true,
        hourlyRate: true,
        createdAt: true,
      },
    });

    res.json({ status: 'success', data: { user } });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.patch('/me', authenticate, async (req: any, res, next) => {
  try {
    const { fullName, bio, skills, hourlyRate, avatarUrl } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        fullName,
        bio,
        skills,
        hourlyRate,
        avatarUrl,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        bio: true,
        skills: true,
        hourlyRate: true,
        avatarUrl: true,
      },
    });

    res.json({ status: 'success', data: { user } });
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/:userId', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true,
        fullName: true,
        role: true,
        bio: true,
        avatarUrl: true,
        skills: true,
        hourlyRate: true,
        createdAt: true,
      },
    });

    res.json({ status: 'success', data: { user } });
  } catch (error) {
    next(error);
  }
});

export default router;
