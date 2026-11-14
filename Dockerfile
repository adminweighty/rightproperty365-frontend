# syntax=docker/dockerfile:1
# Multi-stage, non-root image for the Next.js standalone server.
# Pin the base image by digest in CI before promoting to staging/production.
ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
# Listings, directory and reference data are read from the API by the server.
# If the API answers during the build (API_URL, else NEXT_PUBLIC_API_URL),
# pages are prerendered with its data. If it does not, or BUILD_WITHOUT_API=1,
# the build still succeeds and pages read the API on each request instead.
ARG API_URL
ARG BUILD_WITHOUT_API
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    API_URL=${API_URL} \
    BUILD_WITHOUT_API=${BUILD_WITHOUT_API}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:${NODE_VERSION} AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Set API_URL when the container starts to reach the API on an internal
# address (docker run -e API_URL=...). It defaults to NEXT_PUBLIC_API_URL.
USER node
EXPOSE 3000
CMD ["node", "server.js"]
