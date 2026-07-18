FROM node:20-alpine
WORKDIR /app
COPY . .
EXPOSE 8000
CMD ["node", "server.js"]
