FROM golang:1.27-alpine AS builder
WORKDIR /src
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download
COPY apps/api .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/creatoros-api ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/creatoros-migrate ./cmd/migrate

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /bin/creatoros-api /creatoros-api
COPY --from=builder /bin/creatoros-migrate /creatoros-migrate
COPY apps/api/migrations /migrations
EXPOSE 8080
ENTRYPOINT ["/creatoros-api"]
