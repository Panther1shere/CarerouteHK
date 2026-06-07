FROM node:22-slim

WORKDIR /app

COPY new-frontend/package.json ./package.json
COPY new-frontend/package-lock.json ./package-lock.json

RUN npm install

COPY new-frontend/ ./

EXPOSE 8080

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8080"]
