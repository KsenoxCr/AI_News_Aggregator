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

DB_NAME="newsagg"
DOCKER_DB_NAME="${DB_NAME}-db"

if docker ps -a --format '{{.Names}}' | grep -q "^${DOCKER_DB_NAME}$"; then
  docker start newsagg-db
else
  docker run -d \
    --name "${DOCKER_DB_NAME}" \
    -e MYSQL_ROOT_PASSWORD="${LOCAL_DB_PASSWORD}" \
    -e MYSQL_DATABASE="${DB_NAME}" \
    -e MYSQL_USER="${LOCAL_DB_USERNAME}" \
    -e MYSQL_PASSWORD="${LOCAL_DB_PASSWORD}" \
    -p 3306:3306 \
    -v news-aggr-db-data:/var/lib/mysql \
    -v ./db/schema.sql:/docker-entrypoint-initdb.d/init.sql \
    mysql:8 \
  && docker start newsagg-db
fi

