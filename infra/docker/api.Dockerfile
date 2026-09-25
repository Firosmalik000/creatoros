FROM golang:1.27-alpine AS builder
WORKDIR /src
COPY apps/api/go.mod apps/api/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY apps/api .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -p 2 -trimpath -ldflags="-s -w" -o /bin/creatoros-api ./cmd/server
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -p 2 -trimpath -ldflags="-s -w" -o /bin/creatoros-migrate ./cmd/migrate
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -p 2 -trimpath -ldflags="-s -w" -o /bin/creatoros-seed ./cmd/seed

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
RUN addgroup -S -g 1001 creatoros && adduser -S -u 1001 -G creatoros creatoros
COPY --from=builder /bin/creatoros-api /creatoros-api
COPY --from=builder /bin/creatoros-migrate /creatoros-migrate
COPY --from=builder /bin/creatoros-seed /creatoros-seed
COPY apps/api/migrations /migrations
USER creatoros
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health/live || exit 1

ENTRYPOINT ["/creatoros-api"]
