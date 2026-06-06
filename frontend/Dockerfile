FROM node:22-alpine AS build

WORKDIR /app

COPY frontend/package.json ./package.json
COPY frontend/package-lock.json ./package-lock.json
RUN npm ci

COPY frontend/ ./
RUN npm run build -- --configuration production

FROM nginx:1.27-alpine

COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80
