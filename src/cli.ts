import { createCli } from "trpc-cli"

process.env.RESEND_API_KEY = process.env.RESEND_API_KEY ?? "stub"
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
process.env.DB_HOST = "127.0.0.1"
process.env.DB_NAME = "newsaggr"
process.env.DB_PORT = "3306"
process.env.DB_USERNAME = "dev"
process.env.DB_PASSWORD = "dev"

const { appRouter } = await import("~/server/api/root")
const { createInnerTRPCContext } = await import("~/server/api/trpc")

const stubSession = {
    session: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        createdAt: new Date('2026-03-24T10:52:01'),
        updatedAt: new Date('2026-03-24T10:52:01'),
        userId: 'rIrvFJ9YnwmWkImvqxsseVhADtnUHn4Adwsa',
        expiresAt: new Date('2026-03-31T10:52:01'),
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJySXJ2Rko5WW53bVdrSW12cXhzc2VWaEFEdG5VSG40QWR3c2EifQ.stub_token_for_testing',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        sessionType: 'user',
        lastActiveAt: new Date('2026-03-24T10:52:01')
    },
    user: {
        id: 'rIrvFJ9YnwmWkImvqxsseVhADtnUHn4Adwsa',
        createdAt: new Date('2026-03-24T10:46:04'),
        updatedAt: new Date('2026-03-24T10:46:04'),
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        image: null,
        newsLanguage: 'en',
        role: 'user',
        locale: 'en'
    }
}

const cli = createCli({
    router: appRouter,
    context: createInnerTRPCContext({ session: stubSession })
})

cli.run()
