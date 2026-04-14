FROM node:22-alpine

WORKDIR /app

# Copy root package files and workspace configuration
COPY package.json package-lock.json ./

# Copy workspace packages
COPY packages ./packages
COPY apps/Backend ./apps/Backend

# Install dependencies
RUN npm install

# Build the project
RUN npm run build --workspace=@blocknote/api

EXPOSE 4000

CMD ["npm", "start", "--workspace=@blocknote/api"]
