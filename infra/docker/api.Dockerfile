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

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /bin/creatoros-api /creatoros-api
COPY --from=builder /bin/creatoros-migrate /creatoros-migrate
COPY apps/api/migrations /migrations
EXPOSE 8080
ENTRYPOINT ["/creatoros-api"]
