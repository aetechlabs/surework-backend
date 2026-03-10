import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';

export const setupSocketIO = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Join a room for a specific gig
    socket.on('join-gig', (gigId: string) => {
      socket.join(`gig:${gigId}`);
      logger.info(`Socket ${socket.id} joined gig:${gigId}`);
    });

    // Leave a gig room
    socket.on('leave-gig', (gigId: string) => {
      socket.leave(`gig:${gigId}`);
      logger.info(`Socket ${socket.id} left gig:${gigId}`);
    });

    // Handle real-time messages
    socket.on('message', (data: { gigId: string; message: any }) => {
      io.to(`gig:${data.gigId}`).emit('new-message', data.message);
    });

    // Handle typing indicators
    socket.on('typing', (data: { gigId: string; userId: string }) => {
      socket.to(`gig:${data.gigId}`).emit('user-typing', data);
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const emitToGig = (io: Server, gigId: string, event: string, data: any) => {
  io.to(`gig:${gigId}`).emit(event, data);
};
