import { Router } from 'express';
import { body, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

// Create a new gig
router.post(
  '/',
  authenticate,
  [
    body('freelancerId').isUUID(),
    body('title').trim().notEmpty(),
    body('description').trim().notEmpty(),
    body('category').trim().notEmpty(),
    body('amount').isDecimal(),
    body('paymentToken').isEthereumAddress(),
    body('deadline').isISO8601(),
    validate,
  ],
  async (req: any, res, next) => {
    try {
      const {
        freelancerId,
        title,
        description,
        category,
        skills,
        amount,
        paymentToken,
        deadline,
      } = req.body;

      // Verify freelancer exists
      const freelancer = await prisma.user.findUnique({
        where: { id: freelancerId },
      });

      if (!freelancer) {
        throw new AppError('Freelancer not found', 404);
      }

      if (freelancer.id === req.userId) {
        throw new AppError('Cannot create gig with yourself', 400);
      }

      const gig = await prisma.gig.create({
        data: {
          clientId: req.userId,
          freelancerId,
          title,
          description,
          category,
          skills: skills || [],
          amount,
          paymentToken,
          currency: 'USDC',
          deadline: new Date(deadline),
        },
        include: {
          client: {
            select: { id: true, fullName: true, email: true },
          },
          freelancer: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      res.status(201).json({ status: 'success', data: { gig } });
    } catch (error) {
      next(error);
    }
  }
);

// Get all gigs for current user
router.get('/', authenticate, async (req: any, res, next) => {
  try {
    const { role } = req.query;

    let gigs;
    if (role === 'client') {
      gigs = await prisma.gig.findMany({
        where: { clientId: req.userId },
        include: {
          freelancer: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (role === 'freelancer') {
      gigs = await prisma.gig.findMany({
        where: { freelancerId: req.userId },
        include: {
          client: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      gigs = await prisma.gig.findMany({
        where: {
          OR: [{ clientId: req.userId }, { freelancerId: req.userId }],
        },
        include: {
          client: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          freelancer: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    res.json({ status: 'success', data: { gigs } });
  } catch (error) {
    next(error);
  }
});

// Get gig by ID
router.get('/:gigId', authenticate, async (req: any, res, next) => {
  try {
    const gig = await prisma.gig.findUnique({
      where: { id: req.params.gigId },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            walletAddress: true,
          },
        },
        freelancer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            walletAddress: true,
          },
        },
        milestones: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, fullName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!gig) {
      throw new AppError('Gig not found', 404);
    }

    // Check authorization
    if (gig.clientId !== req.userId && gig.freelancerId !== req.userId) {
      throw new AppError('Not authorized to view this gig', 403);
    }

    res.json({ status: 'success', data: { gig } });
  } catch (error) {
    next(error);
  }
});

// Update gig status (after blockchain events)
router.patch('/:gigId/status', authenticate, async (req: any, res, next) => {
  try {
    const { status, txHash, blockchainGigId } = req.body;

    const gig = await prisma.gig.findUnique({
      where: { id: req.params.gigId },
    });

    if (!gig) {
      throw new AppError('Gig not found', 404);
    }

    if (gig.clientId !== req.userId && gig.freelancerId !== req.userId) {
      throw new AppError('Not authorized', 403);
    }

    const updatedGig = await prisma.gig.update({
      where: { id: req.params.gigId },
      data: {
        status,
        txHash,
        blockchainGigId,
        fundedAt: status === 'FUNDED' ? new Date() : gig.fundedAt,
        completedAt: status === 'COMPLETED' ? new Date() : gig.completedAt,
      },
    });

    res.json({ status: 'success', data: { gig: updatedGig } });
  } catch (error) {
    next(error);
  }
});

export default router;
