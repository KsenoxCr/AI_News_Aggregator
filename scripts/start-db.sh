#!/bin/env bash
set -euo pipefail


if ! command -v docker &> /dev/null; then
  echo "error: docker is not installed or not in PATH" >&2
  exit 1
fi

if ! docker info &> /dev/null; then
  echo "error: docker daemon is not running" >&2
  exit 1
fi

if ! test -r .env; then
  echo "error: .env not found or not readable" >&2
  exit 1
fi

source .env
DOCKER_DB_NAME="${DB_NAME}-db"

if docker ps -a --format '{{.Names}}' | grep -q "^${DOCKER_DB_NAME}$"; then
  docker start $DOCKER_DB_NAME
else
  docker run -d \
    --name "${DOCKER_DB_NAME}" \
    -e MYSQL_ROOT_PASSWORD="${DB_PASSWORD}" \
    -e MYSQL_DATABASE="${DB_NAME}" \
    -e MYSQL_USER="${DB_USERNAME}" \
    -e MYSQL_PASSWORD="${DB_PASSWORD}" \
    -p 3306:3306 \
    -v news-aggr-db-data:/var/lib/mysql \
    -v ./src/server/db/schema.sql:/docker-entrypoint-initdb.d/init.sql \
    mysql:8 \
  && docker start $DOCKER_DB_NAME
fi

