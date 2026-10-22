# Front de Topi: build de CRA → nginx sin root en :8080.
# Las REACT_APP_* se hornean en el build: se pasan como build args (no son secretos).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --legacy-peer-deps: @testing-library/react@13 declara peer react@18 y la app usa react@19
RUN npm ci --no-audit --no-fund --legacy-peer-deps
COPY . .
ARG REACT_APP_API_URL
ARG REACT_APP_GA_TRACKING_ID=
ARG BUILD_ID=
ENV REACT_APP_API_URL=$REACT_APP_API_URL \
    REACT_APP_GA_TRACKING_ID=$REACT_APP_GA_TRACKING_ID \
    BUILD_ID=$BUILD_ID \
    GENERATE_SOURCEMAP=false
RUN test -n "$REACT_APP_API_URL" || (echo "falta --build-arg REACT_APP_API_URL" && exit 1)
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine-slim
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
