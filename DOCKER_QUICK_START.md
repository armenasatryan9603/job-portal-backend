# Docker Quick Start Guide

This guide provides quick commands to work with Docker for your NestJS application.

## Local Development with Docker

### Using Docker Compose (Recommended for Local Development)

```bash
# Start all services (database + app)
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild and start
docker-compose up --build

# Stop and remove volumes (clean slate)
docker-compose down -v
```

### Building Docker Image Locally

```bash
# Build the image
docker build -t job-portal-api:latest .

# Build with no cache
docker build --no-cache -t job-portal-api:latest .

# Build and tag for specific version
docker build -t job-portal-api:1.0.0 .
```

### Running the Container Locally

```bash
# Run with environment variables
docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e JWT_SECRET="your-secret" \
  -e PORT=8080 \
  job-portal-api:latest

# Run in detached mode
docker run -d -p 8080:8080 \
  --name job-portal-api \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e JWT_SECRET="your-secret" \
  job-portal-api:latest

# Run with env file
docker run -p 8080:8080 \
  --env-file .env.local \
  job-portal-api:latest
```

### Managing Containers

```bash
# List running containers
docker ps

# List all containers
docker ps -a

# View logs
docker logs job-portal-api

# Follow logs
docker logs -f job-portal-api

# Stop container
docker stop job-portal-api

# Start container
docker start job-portal-api

# Remove container
docker rm job-portal-api

# Execute command in running container
docker exec -it job-portal-api sh

# Access Prisma CLI in container
docker exec -it job-portal-api npx prisma studio
```

## Google Cloud Run Deployment

### Prerequisites

```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
```

### Using Helper Scripts

```bash
# Build and push to Artifact Registry
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"
./scripts/build-and-push.sh

# Deploy to Cloud Run
./scripts/deploy.sh production
```

### Manual Deployment

```bash
# Configure Docker for Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build image
docker build -t us-central1-docker.pkg.dev/PROJECT_ID/job-portal-api/job-portal-api:latest .

# Push image
docker push us-central1-docker.pkg.dev/PROJECT_ID/job-portal-api/job-portal-api:latest

# Deploy to Cloud Run
gcloud run deploy job-portal-api \
  --image us-central1-docker.pkg.dev/PROJECT_ID/job-portal-api/job-portal-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Troubleshooting

### Check if Docker is running

```bash
docker --version
docker ps
```

### View image details

```bash
# List all images
docker images

# Inspect image
docker inspect job-portal-api:latest

# View image history
docker history job-portal-api:latest
```

### Clean up Docker resources

```bash
# Remove unused images
docker image prune

# Remove unused containers
docker container prune

# Remove unused volumes
docker volume prune

# Remove all unused resources
docker system prune -a

# See disk usage
docker system df
```

### Debugging build issues

```bash
# Build with verbose output
docker build --progress=plain -t job-portal-api:latest .

# Build specific stage (for multi-stage builds)
docker build --target builder -t job-portal-api:builder .

# Build with build arguments
docker build --build-arg NODE_ENV=production -t job-portal-api:latest .
```

### Testing the container

```bash
# Run with interactive shell
docker run -it --entrypoint sh job-portal-api:latest

# Check if app starts properly
docker run -p 8080:8080 job-portal-api:latest

# Test health endpoint
curl http://localhost:8080/api/health
```

## Environment Variables

Required environment variables for the container:

### Database
- `DATABASE_URL`: PostgreSQL connection string
- Example: `postgresql://user:password@host:5432/database`

### Authentication
- `JWT_SECRET`: Secret key for JWT tokens

### Google Cloud
- `GCS_BUCKET_NAME`: Google Cloud Storage bucket
- `GCS_PROJECT_ID`: Google Cloud Project ID

### Application
- `PORT`: Server port (default: 8080)
- `NODE_ENV`: Environment (development/production)
- `CORS_ORIGIN`: Comma-separated list of allowed origins

### OAuth (Optional)
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

## Best Practices

1. **Use `.dockerignore`**: Exclude unnecessary files from the build context
2. **Multi-stage builds**: Keep production images small
3. **Layer caching**: Order Dockerfile commands from least to most frequently changing
4. **Health checks**: Implement health check endpoints
5. **Non-root user**: Run container as non-root user (already configured)
6. **Environment-specific configs**: Use different env files for dev/staging/prod
7. **Secrets management**: Never hardcode secrets in Dockerfile or image

## GitHub Actions

The repository includes automated workflows:

- **`.github/workflows/deploy-cloud-run.yml`**: Deploys to Cloud Run on push to main
- **`.github/workflows/build-test.yml`**: Builds and tests on pull requests

Make sure to configure GitHub secrets as described in `CLOUD_RUN_DEPLOYMENT.md`.

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [NestJS Docker Guide](https://docs.nestjs.com/recipes/docker)

