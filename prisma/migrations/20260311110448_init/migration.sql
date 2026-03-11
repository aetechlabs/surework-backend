-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'FREELANCER', 'ADMIN');

-- CreateEnum
CREATE TYPE "GigStatus" AS ENUM ('CREATED', 'FUNDED', 'SUBMITTED', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'FREELANCER',
    "walletAddress" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "skills" TEXT[],
    "hourlyRate" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gig" (
    "id" TEXT NOT NULL,
    "blockchainGigId" INTEGER,
    "clientId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "skills" TEXT[],
    "amount" DECIMAL(18,6) NOT NULL,
    "paymentToken" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "deadline" TIMESTAMP(3) NOT NULL,
    "estimatedHours" INTEGER,
    "status" "GigStatus" NOT NULL DEFAULT 'CREATED',
    "txHash" TEXT,
    "fundedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attachments" TEXT[],
    "metadataURI" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,6) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT[],
    "adminNotes" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "gigId" INTEGER,
    "eventData" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockchainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_walletAddress_idx" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Gig_blockchainGigId_key" ON "Gig"("blockchainGigId");

-- CreateIndex
CREATE INDEX "Gig_clientId_idx" ON "Gig"("clientId");

-- CreateIndex
CREATE INDEX "Gig_freelancerId_idx" ON "Gig"("freelancerId");

-- CreateIndex
CREATE INDEX "Gig_status_idx" ON "Gig"("status");

-- CreateIndex
CREATE INDEX "Gig_blockchainGigId_idx" ON "Gig"("blockchainGigId");

-- CreateIndex
CREATE INDEX "Milestone_gigId_idx" ON "Milestone"("gigId");

-- CreateIndex
CREATE INDEX "Message_gigId_idx" ON "Message"("gigId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_receiverId_idx" ON "Message"("receiverId");

-- CreateIndex
CREATE INDEX "Dispute_gigId_idx" ON "Dispute"("gigId");

-- CreateIndex
CREATE INDEX "Dispute_isResolved_idx" ON "Dispute"("isResolved");

-- CreateIndex
CREATE UNIQUE INDEX "Review_gigId_key" ON "Review"("gigId");

-- CreateIndex
CREATE INDEX "Review_revieweeId_idx" ON "Review"("revieweeId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainEvent_transactionHash_key" ON "BlockchainEvent"("transactionHash");

-- CreateIndex
CREATE INDEX "BlockchainEvent_eventName_idx" ON "BlockchainEvent"("eventName");

-- CreateIndex
CREATE INDEX "BlockchainEvent_processed_idx" ON "BlockchainEvent"("processed");

-- CreateIndex
CREATE INDEX "BlockchainEvent_blockNumber_idx" ON "BlockchainEvent"("blockNumber");

-- AddForeignKey
ALTER TABLE "Gig" ADD CONSTRAINT "Gig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gig" ADD CONSTRAINT "Gig_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
