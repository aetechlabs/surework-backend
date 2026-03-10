import { Router } from 'express';
import { body } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

// Send a message
router.post(
  '/',
  authenticate,
  [
    body('gigId').isUUID(),
    body('receiverId').isUUID(),
    body('content').trim().notEmpty(),
    validate,
  ],
  async (req: any, res, next) => {
    try {
      const { gigId, receiverId, content, attachments } = req.body;

      // Verify gig exists and user is authorized
      const gig = await prisma.gig.findUnique({
        where: { id: gigId },
      });

      if (!gig) {
        throw new AppError('Gig not found', 404);
      }

      if (gig.clientId !== req.userId && gig.freelancerId !== req.userId) {
        throw new AppError('Not authorized to message in this gig', 403);
      }

      const message = await prisma.message.create({
        data: {
          gigId,
          senderId: req.userId,
          receiverId,
          content,
          attachments: attachments || [],
        },
        include: {
          sender: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          receiver: {
            select: { id: true, fullName: true },
          },
        },
      });

      // TODO: Emit socket event for real-time delivery

      res.status(201).json({ status: 'success', data: { message } });
    } catch (error) {
      next(error);
    }
  }
);

// Get messages for a gig
router.get('/gig/:gigId', authenticate, async (req: any, res, next) => {
  try {
    const { gigId } = req.params;

    // Verify authorization
    const gig = await prisma.gig.findUnique({
      where: { id: gigId },
    });

    if (!gig) {
      throw new AppError('Gig not found', 404);
    }

    if (gig.clientId !== req.userId && gig.freelancerId !== req.userId) {
      throw new AppError('Not authorized', 403);
    }

    const messages = await prisma.message.findMany({
      where: { gigId },
      include: {
        sender: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ status: 'success', data: { messages } });
  } catch (error) {
    next(error);
  }
});

// Mark messages as read
router.patch('/read', authenticate, async (req: any, res, next) => {
  try {
    const { messageIds } = req.body;

    await prisma.message.updateMany({
      where: {
        id: { in: messageIds },
        receiverId: req.userId,
      },
      data: { isRead: true },
    });

    res.json({ status: 'success', message: 'Messages marked as read' });
  } catch (error) {
    next(error);
  }
});

export default router;
