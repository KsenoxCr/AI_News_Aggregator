import { z } from "zod";
import { createTRPCRouter, protectedTranslatedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db/db";
import { changeLanguageSchema, EditPreferencesSchemaFactory } from "~/lib/validators/user";

export const userRouter = createTRPCRouter({
    // TODO: Uncomment or discard depending on demand (whether TRPCContext + caching suffices)
    //
    // getDetails: protectedProcedure
    //     .query(async ({ ctx }) => {
    //         const user = await db
    //             .selectFrom('users')
    //             .select(["email", "preferences", "locale", "news_language", "selected_agent"])
    //             .where('id', '=', ctx.session.user.id)
    //             .executeTakeFirstOrThrow()
    //
    //         return {
    //             status: "success",
    //             ...user
    //         }
    //     }),
    editPreferences: protectedTranslatedProcedure
        .input(z.unknown())
        .mutation(async ({ ctx, input }) => {
            const schema = EditPreferencesSchemaFactory(ctx.t)
            const validated = schema.parse(input)

            await db
                .updateTable('users')
                .set({ "preferences": validated })
                .where('id', '=', ctx.session.user.id)
                .executeTakeFirstOrThrow()

            return {
                status: "success"
            }
        }),
    changeLanguage: protectedTranslatedProcedure
        .input(z.unknown())
        .mutation(async ({ ctx, input }) => {
            const schema = changeLanguageSchema
            const validated = schema.parse(input)

            await db
                .updateTable('users')
                .set({ "language": validated })
                .where('id', '=', ctx.session.user.id)
                .executeTakeFirstOrThrow()

            return {
                status: "success"
            }
        }),
});
