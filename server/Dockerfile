FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

# Persistent, non-root-writable location for the user store.
RUN mkdir -p /data && chown -R node:node /app /data
USER node

ENV USERS_FILE=/data/users.json
EXPOSE 5000

CMD ["node", "index.js"]
