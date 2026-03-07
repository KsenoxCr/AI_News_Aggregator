# tech spec

- Client & server side: NextJS
    - DX: full stack uses TS, type safe client-server boundary due to tRPC
- DB Queries: Kysely
    - simple schema, no need for ORM, migration cli nor interface inference)
    - DI by design, hassle-free native dialect swap
- Storage & source of truth: MySQL db
