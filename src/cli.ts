import { createCli } from "trpc-cli"

process.env.RESEND_API_KEY = process.env.RESEND_API_KEY ?? "stub"
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

const { appRouter } = await import("~/server/api/root")
const { createInnerTRPCContext } = await import("~/server/api/trpc")

const cli = createCli({
    router: appRouter,
    context: createInnerTRPCContext({ session: null })
})

cli.run()
