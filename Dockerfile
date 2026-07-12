FROM node:22-alpine AS build
WORKDIR /app

# Install server dependencies
COPY trafficboard/server/package*.json /app/trafficboard/server/
RUN cd trafficboard/server && npm install

# Install client dependencies
COPY trafficboard/client/package*.json /app/trafficboard/client/
RUN cd trafficboard/client && npm install

# Copy all source files
COPY trafficboard/ /app/trafficboard/

# Build server
RUN cd trafficboard/server && npm run build

# Build client
RUN cd trafficboard/client && npm run build

# Production image
FROM node:22-alpine
WORKDIR /app

# Copy built artifacts
COPY --from=build /app/trafficboard/server/dist /app/server/dist
COPY --from=build /app/trafficboard/server/node_modules /app/server/node_modules
COPY --from=build /app/trafficboard/server/package.json /app/server/
COPY --from=build /app/trafficboard/client/dist /app/client/dist

EXPOSE 8080
CMD ["node", "/app/server/dist/index.js"]