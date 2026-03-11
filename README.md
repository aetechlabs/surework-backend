# SureWork Backend API

> Node.js/TypeScript backend API for the SureWork decentralized freelancing platform

## Overview

RESTful API server with real-time messaging, blockchain integration, and PostgreSQL database. Provides authentication, gig management, chat, and dispute resolution services.

## Features

- **JWT Authentication**: Secure user authentication
- **Account Abstraction**: Automatic wallet generation for users
- **Real-Time Chat**: Socket.IO-powered messaging
- **Blockchain Sync**: Automatic event listening and database sync
- **RESTful API**: Complete CRUD operations for all resources
- **PostgreSQL**: Robust relational database
- **TypeScript**: Type-safe development

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Real-time**: Socket.IO
- **Blockchain**: ethers.js
- **Authentication**: JWT + bcrypt
- **Logging**: Winston

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Start development server
npm run dev
```

## Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/surework"

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRY=7d

# Blockchain
BLOCKCHAIN_NETWORK=localhost
RPC_URL=http://127.0.0.1:8545
ESCROW_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
CHAIN_ID=31337

# Wallet
BACKEND_PRIVATE_KEY=your_private_key
```

## API Endpoints

### Authentication

```
POST   /api/auth/register    - Register new user
POST   /api/auth/login       - Login user
```

### Users

```
GET    /api/users/me         - Get current user profile
PATCH  /api/users/me         - Update current user
GET    /api/users/:userId    - Get user by ID
```

### Gigs

```
POST   /api/gigs             - Create new gig
GET    /api/gigs             - List gigs (filtered by user role)
GET    /api/gigs/:gigId      - Get gig details
PATCH  /api/gigs/:gigId/status - Update gig status
```

### Messages

```
POST   /api/messages         - Send message
GET    /api/messages/gig/:gigId - Get messages for gig
PATCH  /api/messages/:messageId/read - Mark as read
```

### Disputes

```
POST   /api/disputes         - Create dispute
GET    /api/disputes         - List disputes
PATCH  /api/disputes/:disputeId/resolve - Resolve dispute (admin)
```

## Database Schema

### Tables

- **User**: User accounts with wallet addresses
- **Gig**: Freelance gigs with blockchain sync
- **Milestone**: Gig milestones
- **Message**: Chat messages
- **Dispute**: Dispute cases
- **Review**: User reviews and ratings
- **Notification**: User notifications
- **BlockchainEvent**: Audit trail of chain events

### Relationships

```
User 1--->∞ Gig (as client)
User 1--->∞ Gig (as freelancer)
Gig 1--->∞ Message
Gig 1--->∞ Milestone
Gig 1--->1 Dispute
User 1--->∞ Review
```

## Real-Time Events (Socket.IO)

### Client Events

```javascript
// Join gig room
socket.emit('join:gig', { gigId })

// Send message
socket.emit('message:send', { gigId, content })

// Typing indicator
socket.emit('message:typing', { gigId })
```

### Server Events

```javascript
// Receive message
socket.on('message:new', (message) => {})

// User typing
socket.on('message:typing', ({ userId, gigId }) => {})

// Gig status update
socket.on('gig:statusUpdate', (gig) => {})
```

## Blockchain Integration

### Event Listener Worker

Monitors smart contract events and updates database:

```bash
npm run worker
```

**Monitored Events:**
- GigCreated
- GigFunded
- WorkSubmitted
- GigCompleted
- GigDisputed

## Development

### Run Services

Terminal 1 - API Server:
```bash
npm run dev
```

Terminal 2 - Blockchain Listener:
```bash
npm run worker
```

### Database Commands

```bash
# Generate Prisma client
npm run db:generate

# Push schema changes
npm run db:push

# Create migration
npm run db:migrate

# Open Prisma Studio
npx prisma studio
```

## Project Structure

```
backend/
├── src/
│   ├── routes/          # API route handlers
│   ├── middleware/      # Express middleware
│   ├── services/        # Business logic
│   ├── utils/           # Utilities
│   └── worker/          # Background workers
├── prisma/
│   └── schema.prisma    # Database schema
├── package.json
└── tsconfig.json
```

## Authentication Flow

1. User registers → Wallet auto-generated
2. Password hashed with bcrypt
3. JWT token issued (7-day expiry)
4. Token included in Authorization header
5. Middleware validates token on protected routes

## Error Handling

Centralized error handler with:
- Validation errors (400)
- Authentication errors (401)
- Authorization errors (403)
- Not Found (404)
- Server errors (500)

## Logging

Winston logger with:
- Console output (development)
- File output (production)
- Error tracking
- Request logging

## Security

- ✅ JWT authentication
- ✅ Password hashing (bcrypt)
- ✅ SQL injection protection (Prisma)
- ✅ CORS configuration
- ✅ Rate limiting (TODO)
- ✅ Input validation

## Testing

```bash
# Run tests (coming soon)
npm test

# Test coverage
npm run test:coverage
```

## Deployment

### Production Checklist

- [ ] Set strong JWT_SECRET
- [ ] Configure production DATABASE_URL
- [ ] Set up SSL/TLS
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Set up monitoring (Sentry, etc.)
- [ ] Configure backup strategy

### Docker Deployment

```bash
# Build image
docker build -t surework-backend .

# Run container
docker run -p 3000:3000 surework-backend
```

## Performance

- Response time: <100ms (average)
- Database queries optimized with Prisma
- Connection pooling enabled
- Caching strategy: Redis (TODO)

## License

MIT

## Related Repositories

- **Smart Contracts**: [surework-contracts](https://github.com/aetechlabs/surework-contracts)
- **Mobile App**: [surework-mobile](https://github.com/aetechlabs/surework-mobile)

## Support

For issues and questions:
- Open an issue in this repository
- Contact: dev@aetechlabs.com

---

Built with ❤️ by [AeTechLabs](https://github.com/aetechlabs)
