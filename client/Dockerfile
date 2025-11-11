# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build arguments for environment variables
ARG VITE_API_URL=http://localhost:4000
ARG VITE_SOCKET_URL=http://localhost:4000

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Debug: Print environment variables
RUN echo "Building with VITE_API_URL=$VITE_API_URL"
RUN echo "Building with VITE_SOCKET_URL=$VITE_SOCKET_URL"

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 5173

# Start nginx
CMD ["nginx", "-g", "daemon off;"]


