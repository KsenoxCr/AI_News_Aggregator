import { createPool } from 'mysql2'
import { Kysely, MysqlDialect, } from 'kysely'
import type { DB } from './types'
import { env } from 'process'

export const dialect = new MysqlDialect({
  pool: createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  }),
})

// Singleton, HMR-resistant

const globalForDb = globalThis as unknown as { db: Kysely<DB> | undefined }

export const db = globalForDb.db ?? new Kysely<DB>({ dialect })

if (env.NODE_ENV !== 'production') globalForDb.db = db
