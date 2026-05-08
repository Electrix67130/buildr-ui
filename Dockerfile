# Stage 1 - Base: General Configuration
FROM node:24-alpine AS base
WORKDIR /usr/src/app

# Environment setup and global tools installation
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=/home/node/.npm-global/bin:$PATH

# Install necessary tools and global npm packages
RUN apk add --no-cache bash git \
    && npm i --unsafe-perm -g npm@latest expo-cli@latest \
    && apk del git

# React Native Packager variable for development
ARG REACT_NATIVE_PACKAGER_HOSTNAME
ENV REACT_NATIVE_PACKAGER_HOSTNAME=$REACT_NATIVE_PACKAGER_HOSTNAME

# Stage 2 - Dependencies: Install project dependencies
FROM base AS dependencies
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --prefer-offline --no-audit --legacy-peer-deps

COPY . ./

# Stage 3 - Development: Configure development environment
FROM dependencies AS development
WORKDIR /usr/src/app

COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY . ./

# Expose development-related ports (Expo)
EXPOSE 19000 19001 19002 19003 19006 8083

COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npx", "expo", "start", "-c", "--port", "8083"]
