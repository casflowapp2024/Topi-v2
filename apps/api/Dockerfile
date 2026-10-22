# build stage
FROM golang:1.23-alpine AS build

WORKDIR /src

# dependencies first (cached layer)
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/http

# final stage
FROM alpine:3.20 AS final

RUN apk --no-cache add ca-certificates tzdata \
    && adduser -D -H -u 10001 app

COPY --from=build /out/api /app/api

USER app
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1:${HTTP_PORT:-8080}/health || exit 1

ENTRYPOINT ["/app/api"]
