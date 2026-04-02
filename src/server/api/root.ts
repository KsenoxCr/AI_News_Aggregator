import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { sourceRouter } from "./routers/source";
import { agentRouter } from "./routers/agent";
import { categoryRouter } from "./routers/category";
import { userRouter } from "./routers/user";
import { newsRouter } from "./routers/news";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  source: sourceRouter,
  agent: agentRouter,
  user: userRouter,
  category: categoryRouter,
  news: newsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
