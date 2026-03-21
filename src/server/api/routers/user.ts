import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db/db";
import { changeLanguageInput, editPreferencesInput } from "~/lib/validators/user";

export const userRouter = createTRPCRouter({
    getDetails: protectedProcedure
        .query(async ({ ctx }) => {
            const user = await db
                .selectFrom('users')
                .select(["email", "preferences", "language", "selected_agent"])
                .where('id', '=', ctx.session.user.id)
                .executeTakeFirstOrThrow()

            return {
                status: "success",
                ...user
            }
        }),
    editPreferences: protectedProcedure
        .input(editPreferencesInput)
        .mutation(async ({ ctx, input }) => {
            await db
                .updateTable('users')
                .set({ "preferences": input })
                .where('id', '=', ctx.session.user.id)
                .executeTakeFirstOrThrow()

            return {
                status: "success"
            }
        }),
    changeLanguage: protectedProcedure
        .input(changeLanguageInput)
        .mutation(async ({ ctx, input }) => {
            await db
                .updateTable('users')
                .set({ "language": input })
                .where('id', '=', ctx.session.user.id)
                .executeTakeFirstOrThrow()

            return {
                status: "success"
            }
        }),
});
