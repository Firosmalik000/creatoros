FROM golang:1.27-alpine AS builder
WORKDIR /src
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download
COPY apps/api .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/creatoros-api ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /bin/creatoros-api /creatoros-api
EXPOSE 8080
ENTRYPOINT ["/creatoros-api"]
