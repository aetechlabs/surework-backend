import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

dotenv.config();

const prisma = new PrismaClient();

// Contract ABI (minimal for events)
const ESCROW_ABI = [
  'event GigCreated(uint256 indexed gigId, address indexed client, address indexed freelancer, uint256 amount, address paymentToken)',
  'event GigFunded(uint256 indexed gigId, uint256 amount)',
  'event WorkSubmitted(uint256 indexed gigId, address indexed freelancer)',
  'event GigCompleted(uint256 indexed gigId, uint256 amountPaid, uint256 fee)',
  'event GigDisputed(uint256 indexed gigId, address indexed initiator)',
  'event DisputeResolved(uint256 indexed gigId, address winner, uint256 amount)',
];

export class BlockchainListener {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private lastProcessedBlock: number = 0;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.contract = new ethers.Contract(
      process.env.ESCROW_CONTRACT_ADDRESS!,
      ESCROW_ABI,
      this.provider
    );
  }

  async start() {
    logger.info('🔗 Starting blockchain listener...');
    logger.info(`Network: ${process.env.BLOCKCHAIN_NETWORK}`);
    logger.info(`Contract: ${process.env.ESCROW_CONTRACT_ADDRESS}`);

    // Get current block number
    const currentBlock = await this.provider.getBlockNumber();
    this.lastProcessedBlock = currentBlock;

    logger.info(`Current block: ${currentBlock}`);

    // Listen for events
    this.setupEventListeners();

    // Poll for missed events every 30 seconds
    setInterval(() => this.processPastEvents(), 30000);
  }

  private setupEventListeners() {
    // GigCreated
    this.contract.on('GigCreated', async (gigId, client, freelancer, amount, paymentToken, event) => {
      logger.info(`GigCreated event: GigId ${gigId}`);
      await this.handleGigCreated(gigId, client, freelancer, amount, paymentToken, event);
    });

    // GigFunded
    this.contract.on('GigFunded', async (gigId, amount, event) => {
      logger.info(`GigFunded event: GigId ${gigId}`);
      await this.handleGigFunded(gigId, amount, event);
    });

    // WorkSubmitted
    this.contract.on('WorkSubmitted', async (gigId, freelancer, event) => {
      logger.info(`WorkSubmitted event: GigId ${gigId}`);
      await this.handleWorkSubmitted(gigId, event);
    });

    // GigCompleted
    this.contract.on('GigCompleted', async (gigId, amountPaid, fee, event) => {
      logger.info(`GigCompleted event: GigId ${gigId}`);
      await this.handleGigCompleted(gigId, event);
    });

    // GigDisputed
    this.contract.on('GigDisputed', async (gigId, initiator, event) => {
      logger.info(`GigDisputed event: GigId ${gigId}`);
      await this.handleGigDisputed(gigId, event);
    });

    logger.info('✅ Event listeners set up successfully');
  }

  private async processPastEvents() {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      
      if (currentBlock <= this.lastProcessedBlock) {
        return;
      }

      logger.info(`Checking blocks ${this.lastProcessedBlock + 1} to ${currentBlock}`);

      const events = await this.contract.queryFilter(
        '*',
        this.lastProcessedBlock + 1,
        currentBlock
      );

      for (const event of events) {
        await this.processEvent(event);
      }

      this.lastProcessedBlock = currentBlock;
    } catch (error) {
      logger.error('Error processing past events:', error);
    }
  }

  private async processEvent(event: any) {
    // Store event in database for audit trail
    const txHash = event.transactionHash;
    
    // Check if already processed
    const existing = await prisma.blockchainEvent.findUnique({
      where: { transactionHash: txHash },
    });

    if (existing) {
      return;
    }

    await prisma.blockchainEvent.create({
      data: {
        eventName: event.event,
        contractAddress: event.address,
        blockNumber: event.blockNumber,
        transactionHash: txHash,
        eventData: event.args,
        processed: true,
      },
    });
  }

  private async handleGigCreated(
    gigId: bigint,
    client: string,
    freelancer: string,
    amount: bigint,
    paymentToken: string,
    event: any
  ) {
    try {
      await this.processEvent(event);
      logger.info(`Gig ${gigId} created on-chain`);
      // Additional processing if needed
    } catch (error) {
      logger.error('Error handling GigCreated:', error);
    }
  }

  private async handleGigFunded(gigId: bigint, amount: bigint, event: any) {
    try {
      await this.processEvent(event);

      // Find gig in database and update status
      const gig = await prisma.gig.findFirst({
        where: { blockchainGigId: Number(gigId) },
      });

      if (gig) {
        await prisma.gig.update({
          where: { id: gig.id },
          data: {
            status: 'FUNDED',
            fundedAt: new Date(),
            txHash: event.transactionHash,
          },
        });

        // Create notification
        await prisma.notification.create({
          data: {
            userId: gig.freelancerId,
            type: 'GIG_FUNDED',
            title: 'Gig Funded!',
            message: `The client has funded the gig "${gig.title}". You can start working now.`,
            data: { gigId: gig.id },
          },
        });

        logger.info(`Gig ${gig.id} updated to FUNDED status`);
      }
    } catch (error) {
      logger.error('Error handling GigFunded:', error);
    }
  }

  private async handleWorkSubmitted(gigId: bigint, event: any) {
    try {
      await this.processEvent(event);

      const gig = await prisma.gig.findFirst({
        where: { blockchainGigId: Number(gigId) },
      });

      if (gig) {
        await prisma.gig.update({
          where: { id: gig.id },
          data: { status: 'SUBMITTED' },
        });

        await prisma.notification.create({
          data: {
            userId: gig.clientId,
            type: 'WORK_SUBMITTED',
            title: 'Work Submitted',
            message: `${gig.title}: The freelancer has submitted their work for review.`,
            data: { gigId: gig.id },
          },
        });
      }
    } catch (error) {
      logger.error('Error handling WorkSubmitted:', error);
    }
  }

  private async handleGigCompleted(gigId: bigint, event: any) {
    try {
      await this.processEvent(event);

      const gig = await prisma.gig.findFirst({
        where: { blockchainGigId: Number(gigId) },
      });

      if (gig) {
        await prisma.gig.update({
          where: { id: gig.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        await prisma.notification.create({
          data: {
            userId: gig.freelancerId,
            type: 'GIG_COMPLETED',
            title: 'Payment Released!',
            message: `The client approved your work. Payment has been released to your wallet.`,
            data: { gigId: gig.id },
          },
        });

        logger.info(`Gig ${gig.id} completed and payment released`);
      }
    } catch (error) {
      logger.error('Error handling GigCompleted:', error);
    }
  }

  private async handleGigDisputed(gigId: bigint, event: any) {
    try {
      await this.processEvent(event);

      const gig = await prisma.gig.findFirst({
        where: { blockchainGigId: Number(gigId) },
      });

      if (gig) {
        await prisma.gig.update({
          where: { id: gig.id },
          data: { status: 'DISPUTED' },
        });

        logger.info(`Gig ${gig.id} is now disputed`);
      }
    } catch (error) {
      logger.error('Error handling GigDisputed:', error);
    }
  }
}

// Start the listener
if (require.main === module) {
  const listener = new BlockchainListener();
  listener.start().catch((error) => {
    logger.error('Fatal error in blockchain listener:', error);
    process.exit(1);
  });
}
