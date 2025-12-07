# CryptoHunter - Blockchain Analysis Dashboard

## Overview

CryptoHunter is a blockchain analysis tool that derives synthetic cryptographic identities from Bitcoin transaction IDs (TxIDs) and checks their balances across multiple blockchain networks. The application features a retro-terminal aesthetic with a dark-grid cyber-forensic interface using neon green and monospaced fonts. It provides real-time blockchain scanning, key derivation, mempool monitoring, and block analysis capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool.

**UI Library**: Shadcn UI components built on Radix UI primitives, styled with TailwindCSS using a custom dark terminal theme.

**Design System**:
- Retro-terminal aesthetic with black background (#0A0A0A)
- Neon green primary color (#10b981) with cyan accents
- Monospaced font (JetBrains Mono)
- Custom terminal-styled components with glowing borders and scanline effects
- Hardware-corner decorations on module components

**State Management**: 
- React Query (@tanstack/react-query) for server state management
- React hooks for local component state
- Context-based logging system

**Routing**: Wouter for lightweight client-side routing

**Key UI Components**:
- `MatrixBackground`: Animated Matrix-style falling characters background
- `TerminalModule`: Reusable container component with hardware aesthetic
- `SystemLog`: Real-time logging display with filtering capabilities
- `MempoolGraph`: Recharts-based visualization of mempool activity
- Dashboard with tabbed interface for scanning, mempool monitoring, and block analysis

### Backend Architecture

**Framework**: Express.js with TypeScript running on Node.js.

**Build System**: ESBuild for server bundling with selective dependency bundling to optimize cold start times. Vite for client bundling.

**API Design**: RESTful endpoints organized by functionality:
- `/api/btc/address/:addr` - Bitcoin address transaction fetching
- `/api/eth/balance/:addr` - Ethereum balance checking
- `/api/btc/balance/:addr` - Bitcoin balance checking
- `/api/synthetic/derive` - Batch synthetic key derivation
- `/api/mempool` - Live mempool data
- `/api/block/:height` - Block data retrieval

**Cryptographic Services**:
- Transaction ID to private key derivation using secp256k1 curve
- Support for multiple Bitcoin address formats (Legacy P2PKH, SegWit P2WPKH-P2SH, Native SegWit Bech32)
- Ethereum address derivation from same entropy source
- WIF (Wallet Import Format) encoding

**Key Libraries**:
- `bitcoinjs-lib`: Bitcoin cryptographic operations
- `tiny-secp256k1`: Elliptic curve cryptography
- `keccak`: Ethereum address hashing
- `bs58check`: Base58Check encoding for Bitcoin addresses

### Data Storage

**Database**: PostgreSQL accessed via Drizzle ORM.

**Schema Design**:

**scan_history** table:
- Tracks address scans with depth, transaction count, and derived identity count
- Status tracking for scan completion

**derived_identities** table:
- Stores synthetic identities derived from transaction IDs
- Links to parent scan via foreign key
- Contains WIF private key, multiple Bitcoin address formats, and Ethereum address
- Tracks balance information and last balance check timestamp

**system_logs** table:
- Event logging system linking to scans
- Categorized by log type (info, warning, error, api, keygen)
- Timestamped entries for audit trail

**Migration Strategy**: Drizzle Kit for schema migrations with push-based deployment.

### Authentication and Authorization

Currently no authentication system implemented. The application appears to be designed for single-user or internal use cases.

### Key Architectural Decisions

**Synthetic Key Derivation**: The core innovation uses Bitcoin transaction IDs as entropy sources to deterministically generate private keys. This is achieved by:
1. Converting TxID (64 hex characters) to BigInt
2. Modulo operation against secp256k1 curve order to ensure valid key
3. Deriving multiple address formats from single private key

**Rationale**: Allows exploration of "what if" scenarios where transaction data could theoretically be used as cryptographic material, strictly for educational/research purposes.

**Trade-offs**: This approach is experimental and should not be used with real funds or production systems.

**Client-Server Separation**: Clean separation between frontend (client directory) and backend (server directory) with shared schema definitions.

**Rationale**: Enables independent development and deployment of client/server, better code organization, and type safety across boundaries.

**Component-Based UI**: Atomic design with reusable terminal-styled components using composition patterns.

**Rationale**: Maintains consistent cyberpunk aesthetic while enabling rapid feature development.

**Real-Time Data Fetching**: Uses external blockchain APIs (blockchain.info) rather than running full nodes.

**Rationale**: Reduces infrastructure complexity and costs while maintaining functionality. Rate limiting implemented to avoid API restrictions.

**Trade-offs**: Dependent on third-party API availability and rate limits.

## External Dependencies

### Blockchain APIs

**Blockchain.info API**: Used for Bitcoin address transaction history and balance queries.
- Endpoint: `https://blockchain.info/rawaddr/:address`
- No API key required but subject to rate limiting
- Returns transaction history with inputs/outputs, fees, and confirmation data

**Mempool.space** (implied): For mempool monitoring features.

**Block Explorers**: For block-level analysis.

### Third-Party Services

**Replit Platform**: Development environment with specific integrations:
- `@replit/vite-plugin-cartographer`: Development mapping
- `@replit/vite-plugin-dev-banner`: Development banner
- `@replit/vite-plugin-runtime-error-modal`: Error overlay
- Custom meta image plugin for OpenGraph tags

### NPM Packages

**Cryptography**:
- `bitcoinjs-lib`: Bitcoin transaction and address handling
- `tiny-secp256k1`: Elliptic curve operations
- `@ethereumjs/util`: Ethereum utilities
- `keccak`: SHA-3 hashing for Ethereum
- `bs58check`: Bitcoin address encoding
- `bip32`: Hierarchical deterministic wallet support

**UI/Frontend**:
- `@radix-ui/*`: Comprehensive suite of accessible UI primitives
- `@tanstack/react-query`: Server state management
- `recharts`: Data visualization
- `framer-motion`: Animations
- `lucide-react`: Icon library
- `tailwindcss`: Utility-first CSS
- `class-variance-authority`: Component variant management

**Backend**:
- `express`: Web server framework
- `drizzle-orm`: Type-safe ORM
- `pg`: PostgreSQL client
- `zod`: Runtime type validation
- `drizzle-zod`: Schema validation integration

### Database

**PostgreSQL**: Relational database for persistent storage.
- Connection via connection string in `DATABASE_URL` environment variable
- Connection pooling with `pg.Pool`
- Schema managed by Drizzle ORM