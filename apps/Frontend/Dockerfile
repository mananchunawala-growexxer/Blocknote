FROM node:22-alpine

WORKDIR /app

# Copy root package files and workspace configuration
COPY package.json package-lock.json ./

# Copy workspace packages
COPY packages ./packages
COPY apps/Frontend ./apps/Frontend

# Install dependencies
RUN npm install

# Build the project
RUN npm run build --workspace=@blocknote/web

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace=@blocknote/web"]
