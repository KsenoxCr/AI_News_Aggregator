#!/bin/bash
set -e

pnpm db:make "$1"
pnpm db:migrate
pnpm db:gen-if
