#!/bin/env bash
set -euo pipefail

source .env

npx kysely-codegen --dialect mysql --url "mysql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}" --out-file ./src/server/db/types.ts
