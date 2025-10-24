# Job Portal Backend

NestJS backend application for the job portal platform.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker
- Google Cloud CLI (`gcloud`)

### Local Development

1. **Install dependencies**

```bash
npm install
```

2. **Setup environment**

```bash
cp env.example .env
# Edit .env with your configuration
```

3. **Setup database**

```bash
# Start PostgreSQL with Docker
docker-compose up -d postgres

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

4. **Run the application**

```bash
npm run start:dev
```

The API will be available at `http://localhost:8080`

## 📦 Deploy to Google Cloud Run

### Step 1: First Time Setup (Run Once)

If this is your first deployment, run:

```bash
./setup-cloud-run.sh
```

This automatically creates:

- ✅ Artifact Registry repository
- ✅ Cloud SQL instance and database
- ✅ Database user with secure password
- ✅ All required permissions
- ✅ Environment variables (DATABASE_URL & JWT_SECRET)

**⚠️ Save the DATABASE_URL and JWT_SECRET from the output!**

### Step 2: Deploy Your Application

Set the environment variables (from setup output):

```bash
export DATABASE_URL='postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE'
export JWT_SECRET='your-generated-secret'
```

Then deploy:

```bash
./deploy.sh
```

Done! The script will:

- 🔨 Build Docker image
- 📤 Push to Artifact Registry
- 🚀 Deploy to Cloud Run
- 🌐 Show your service URL

### What's Included

The deployment configures:

- **Database**: Cloud SQL PostgreSQL with automatic migrations
- **Resources**: 2GB RAM, 2 CPU cores
- **Timeout**: 600 seconds
- **Scaling**: 0-10 instances (auto-scales)
- **Security**: Environment variables for secrets
- **Port**: 8080 with proper network binding

## 🛠️ Development Commands

```bash
# Development mode with hot reload
npm run start:dev

# Build for production
npm run build

# Run production build
npm run start:prod

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## 📁 Project Structure

```
src/
├── auth/              # Authentication & JWT
├── users/             # User management
├── orders/            # Order system
├── chat/              # Real-time chat
├── notifications/     # Push notifications
├── storage/           # Google Cloud Storage
└── main.ts            # Application entry point
```

## 🗄️ Database

Using Prisma ORM with PostgreSQL.

### Common Prisma Commands

```bash
# Create migration
npx prisma migrate dev --name description

# Apply migrations (production)
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Reset database (development only!)
npx prisma migrate reset
```

## 🌐 Environment Variables

Required variables (see `env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Allowed origins (comma-separated)

Optional:

- `GOOGLE_CLIENT_ID` - Google OAuth
- `GOOGLE_CLIENT_SECRET` - Google OAuth
- `GCS_BUCKET_NAME` - Cloud Storage bucket
- `GCS_PROJECT_ID` - GCP project ID

## 📝 API Documentation

Base URL: `https://your-service-url.run.app`

### Health Check

```
GET /health
```

### Authentication

```
POST /auth/register
POST /auth/login
POST /auth/google
```

For complete API documentation, see the source code or use tools like Postman.

## 🔍 Monitoring & Logs

View Cloud Run logs:

```bash
gcloud run services logs read job-portal-backend --region us-central1 --limit 50
```

## 📄 License

Private


<!-- DB RESET AD CREATE -->

# npx prisma migrate reset

# npx prisma migrate dev --name init

# npx prisma generate

# psql -U postgres -d marketplace -f seed-data.sql

# full  npx prisma migrate reset &  npx prisma migrate dev --name init & npx prisma generate & psql -U postgres -d marketplace -f seed-data.sql
