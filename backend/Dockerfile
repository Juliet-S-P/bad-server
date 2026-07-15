FROM node:22.15.0-alpine
RUN mkdir /app
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "start"]
