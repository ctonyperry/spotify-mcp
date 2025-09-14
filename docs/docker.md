# 🐳 Docker Usage Guide

Run the Spotify MCP server in a containerized environment with proper security and configuration management.

## Quick Start

### 1. Build the Image

```bash
# Build the Docker image
docker build -t spotify-mcp .

# Or build with specific tag
docker build -t spotify-mcp:latest .
```

### 2. Prepare Directories

```bash
# Create host directories for volume mounts
mkdir -p ./{config,secrets,certs}

# Copy example config and customize
cp config.local.example.json ./config/config.json
# Edit ./config/config.json with your Spotify app credentials
```

### 3. Run the Container

```bash
# Interactive mode with volume mounts
docker run -it --rm \
  -v $(pwd)/config:/config \
  -v $(pwd)/secrets:/secrets \
  -v $(pwd)/certs:/app/.cert \
  -p 8888:8888 \
  spotify-mcp
```

## Configuration

### Volume Mounts

The container expects three volume mounts:

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `./config/` | `/config/` | Configuration files |
| `./secrets/` | `/secrets/` | OAuth tokens and secrets |
| `./certs/` | `/app/.cert/` | HTTPS certificates |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPOTIFY_MCP_CONFIG` | `/config/config.json` | Config file path |
| `SPOTIFY_MCP_LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `NODE_ENV` | `production` | Node.js environment |

### Configuration File

Create `./config/config.json` based on the example:

```json
{
  "spotify": {
    "clientId": "your_spotify_client_id",
    "redirectUri": "https://localhost:8888/callback",
    "scopes": [
      "user-read-playback-state",
      "user-modify-playback-state",
      "playlist-read-private",
      "playlist-modify-private",
      "user-library-read",
      "user-library-modify"
    ]
  },
  "auth": {
    "storage": {
      "type": "file",
      "path": "/secrets/tokens.json"
    }
  },
  "logging": {
    "level": "info",
    "format": "json"
  },
  "server": {
    "https": {
      "enabled": true,
      "cert": "/app/.cert/localhost.crt",
      "key": "/app/.cert/localhost.key"
    }
  }
}
```

## Running Scenarios

### Development with Hot Reloading

```bash
# Mount source code for development
docker run -it --rm \
  -v $(pwd)/config:/config \
  -v $(pwd)/secrets:/secrets \
  -v $(pwd)/certs:/app/.cert \
  -v $(pwd)/src:/app/src \
  -p 8888:8888 \
  --name spotify-mcp-dev \
  spotify-mcp
```

### Production Daemon

```bash
# Run as background daemon
docker run -d \
  --name spotify-mcp \
  --restart unless-stopped \
  -v $(pwd)/config:/config:ro \
  -v $(pwd)/secrets:/secrets \
  -v $(pwd)/certs:/app/.cert:ro \
  -p 8888:8888 \
  spotify-mcp

# View logs
docker logs -f spotify-mcp
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  spotify-mcp:
    build: .
    container_name: spotify-mcp
    restart: unless-stopped
    ports:
      - "8888:8888"
    volumes:
      - ./config:/config:ro
      - ./secrets:/secrets
      - ./certs:/app/.cert:ro
    environment:
      - SPOTIFY_MCP_LOG_LEVEL=info
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

Run with Docker Compose:

```bash
# Start service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop service
docker-compose down
```

## OAuth Setup in Container

Since OAuth requires browser interaction, you have two options:

### Option 1: Host OAuth Setup (Recommended)

1. Run OAuth setup on the host first:
   ```bash
   pnpm oauth
   ```

2. Then run the container with the generated tokens:
   ```bash
   docker run -it --rm \
     -v $(pwd)/config:/config \
     -v $(pwd)/.secrets:/secrets \
     -v $(pwd)/.cert:/app/.cert \
     -p 8888:8888 \
     spotify-mcp
   ```

### Option 2: Container OAuth Setup

1. Run container interactively:
   ```bash
   docker run -it --rm \
     -v $(pwd)/config:/config \
     -v $(pwd)/secrets:/secrets \
     -v $(pwd)/certs:/app/.cert \
     -p 8888:8888 \
     --entrypoint /bin/sh \
     spotify-mcp
   ```

2. Inside container, run OAuth setup:
   ```bash
   # Generate certificates
   node scripts/gen-dev-cert.mjs

   # Run OAuth flow
   node scripts/oauth-bootstrap.mjs
   ```

3. Exit and run normally

## Networking

### Port Mapping

- **8888**: HTTPS OAuth callback server
- **MCP**: stdin/stdout (no port needed)

### Firewall Configuration

Ensure port 8888 is accessible for OAuth callbacks:

```bash
# UFW (Ubuntu)
sudo ufw allow 8888

# iptables
sudo iptables -A INPUT -p tcp --dport 8888 -j ACCEPT

# Docker networks
docker network create spotify-mcp-network
```

## Monitoring & Logging

### Health Checks

The container includes a built-in health check:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' spotify-mcp

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' spotify-mcp
```

### Log Management

```bash
# Real-time logs
docker logs -f spotify-mcp

# Structured JSON logs
docker logs spotify-mcp | jq '.'

# Log rotation with Docker
docker run -d \
  --log-driver=json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  spotify-mcp
```

### Monitoring Integration

For production monitoring, consider:

```yaml
# docker-compose.yml with monitoring
services:
  spotify-mcp:
    # ... service config ...
    logging:
      driver: "fluentd"
      options:
        fluentd-address: localhost:24224
        tag: spotify-mcp

  prometheus:
    image: prom/prometheus
    # ... prometheus config ...
```

## Security Considerations

### Container Security

```bash
# Run with security options
docker run -it --rm \
  --security-opt no-new-privileges \
  --cap-drop=ALL \
  --read-only \
  --tmpfs /tmp \
  -v $(pwd)/config:/config:ro \
  -v $(pwd)/secrets:/secrets \
  -v $(pwd)/certs:/app/.cert:ro \
  spotify-mcp
```

### File Permissions

Ensure proper permissions on host directories:

```bash
# Set restrictive permissions
chmod 700 ./secrets
chmod 755 ./config ./certs

# Set ownership (if needed)
sudo chown -R 1001:1001 ./secrets ./config ./certs
```

### Secrets Management

For production, consider using Docker secrets:

```yaml
version: '3.8'

services:
  spotify-mcp:
    # ... other config ...
    secrets:
      - spotify_client_id
      - spotify_client_secret

secrets:
  spotify_client_id:
    file: ./secrets/client_id.txt
  spotify_client_secret:
    file: ./secrets/client_secret.txt
```

## Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker logs spotify-mcp

# Check volume mounts
docker inspect spotify-mcp | jq '.[].Mounts'

# Run with shell to debug
docker run -it --rm --entrypoint /bin/sh spotify-mcp
```

#### OAuth Callback Fails
```bash
# Ensure port is mapped and accessible
docker port spotify-mcp

# Check firewall settings
sudo netstat -tlnp | grep :8888

# Verify certificates exist
docker exec spotify-mcp ls -la /app/.cert/
```

#### Permission Errors
```bash
# Check file ownership
ls -la ./config ./secrets ./certs

# Fix permissions
sudo chown -R 1001:1001 ./secrets
```

### Debug Mode

Run with debug logging:

```bash
docker run -it --rm \
  -e SPOTIFY_MCP_LOG_LEVEL=debug \
  -v $(pwd)/config:/config \
  -v $(pwd)/secrets:/secrets \
  -v $(pwd)/certs:/app/.cert \
  -p 8888:8888 \
  spotify-mcp
```

## Performance Tuning

### Resource Limits

```bash
# Set memory and CPU limits
docker run -it --rm \
  --memory=512m \
  --cpus=1.0 \
  --memory-swap=1g \
  spotify-mcp
```

### Node.js Options

```bash
# Tune Node.js for container
docker run -it --rm \
  -e NODE_OPTIONS="--max-old-space-size=256" \
  spotify-mcp
```

## Multi-Architecture Support

The Docker image supports multiple architectures:

```bash
# Build for specific platform
docker buildx build --platform linux/amd64 -t spotify-mcp:amd64 .
docker buildx build --platform linux/arm64 -t spotify-mcp:arm64 .

# Build multi-platform image
docker buildx build --platform linux/amd64,linux/arm64 -t spotify-mcp:latest .
```

---

## 📚 Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Container Security](https://docs.docker.com/engine/security/)
- [Production Deployment Guide](../README.md#production-deployment)

This guide covers comprehensive Docker usage for the Spotify MCP server. For additional help, see the main [README](../README.md) or [contributing guidelines](../CONTRIBUTING.md).