FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema before npm install
COPY prisma ./prisma

# Install dependencies
RUN npm install

# Copy remaining source files
COPY . .

EXPOSE 3000

CMD ["npm", "start"]