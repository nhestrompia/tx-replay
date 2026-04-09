FROM rust:1.88-slim AS builder
WORKDIR /app

COPY Cargo.toml .
RUN mkdir src && echo 'fn main() {}' > src/main.rs
RUN cargo build --release && rm -rf src

COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/hyperliquid-position-replayer-api /usr/local/bin/api
EXPOSE 8080
CMD ["/usr/local/bin/api"]
