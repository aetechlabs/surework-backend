import { Router, Response as ExpressResponse, NextFunction } from 'express';
import { body } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

// Create a dispute
router.post(
  '/',
  authenticate,
  [
    body('gigId').isUUID(),
    body('reason').trim().notEmpty(),
    validate,
  ],
  async (req: any, res: ExpressResponse, next: NextFunction) => {
    try {
      const { gigId, reason, evidence } = req.body;

      const gig = await prisma.gig.findUnique({
        where: { id: gigId },
      });

      if (!gig) {
        throw new AppError('Gig not found', 404);
      }

      if (gig.clientId !== req.userId && gig.freelancerId !== req.userId) {
        throw new AppError('Not authorized', 403);
      }

      if (!['FUNDED', 'SUBMITTED'].includes(gig.status)) {
        throw new AppError('Cannot dispute gig at this stage', 400);
      }

      const dispute = await prisma.dispute.create({
        data: {
          gigId,
          initiatedBy: req.userId,
          reason,
          evidence: evidence || [],
        },
      });

      // Update gig status to DISPUTED
      await prisma.gig.update({
        where: { id: gigId },
        data: { status: 'DISPUTED' },
      });

      res.status(201).json({ status: 'success', data: { dispute } });
    } catch (error) {
      next(error);
    }
  }
);

// Get all disputes (admin only)
router.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const disputes = await prisma.dispute.findMany({
        include: {
          gig: {
            include: {
              client: {
                select: { id: true, fullName: true, email: true },
              },
              freelancer: {
                select: { id: true, fullName: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ status: 'success', data: { disputes } });
    } catch (error) {
      next(error);
    }
  }
);

// Resolve a dispute (admin only)
router.patch(
  '/:disputeId/resolve',
  authenticate,
  authorize('ADMIN'),
  [
    body('resolution').trim().notEmpty(),
    body('winner').isIn(['client', 'freelancer']),
    validate,
  ],
  async (req: any, res: ExpressResponse, next: NextFunction) => {
    try {
      const { disputeId } = req.params;
      const { resolution, winner } = req.body;

      const dispute = await prisma.dispute.findUnique({
        where: { id: disputeId },
        include: { gig: true },
      });

      if (!dispute) {
        throw new AppError('Dispute not found', 404);
      }

      if (dispute.isResolved) {
        throw new AppError('Dispute already resolved', 400);
      }

      await prisma.dispute.update({
        where: { id: disputeId },
        data: {
          isResolved: true,
          resolution,
          resolvedAt: new Date(),
          resolvedBy: req.userId,
        },
      });

      // Update gig status based on resolution
      const newStatus = winner === 'freelancer' ? 'COMPLETED' : 'REFUNDED';
      await prisma.gig.update({
        where: { id: dispute.gigId },
        data: { status: newStatus },
      });

      // TODO: Call smart contract to release funds

      res.json({ status: 'success', message: 'Dispute resolved' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
