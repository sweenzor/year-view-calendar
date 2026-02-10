FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose ports for Vite dev server and Express proxy
EXPOSE 5173 3001

# Start development servers
CMD ["npm", "run", "dev"]
