import { defineConfig, getKnexTimestampPrefix } from "kysely-ctl"
import { MysqlDialect } from "kysely"
import { createPool } from "mysql2"
import { dialect } from "~/server/db/db"

export default defineConfig({
    dialect: dialect,
    migrations: {
        migrationFolder: "src/server/db/migrations",
        getMigrationPrefix: getKnexTimestampPrefix
    },
})
