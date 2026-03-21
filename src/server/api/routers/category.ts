import { createTRPCRouter, adminProcedure, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db/db";
import { categoryInput } from "~/lib/validators/category";
import { IsDuplicateEntry } from "~/server/lib/util";

export const categoryRouter = createTRPCRouter({
    getCategories: protectedProcedure
        .query(async ({ ctx }) => {
            const [allCategories, userCategories] = await Promise.all([
                db.selectFrom("categories").selectAll().execute(),
                db
                    .selectFrom("user_categories")
                    .select("category")
                    .where("user_id", "=", ctx.session.user.id)
                    .execute(),
            ]);

            const userCategorySet = new Set(userCategories.map((uc) => uc.category));

            const categoriesHash: Record<string, boolean> = {};

            for (const category of allCategories) {
                categoriesHash[category.slug] = userCategorySet.has(category.slug);
            }

            return {
                status: "success",
                categories: categoriesHash,
            };
        }),
    selectCategory: protectedProcedure
        .input(categoryInput)
        .mutation(async ({ ctx, input }) => {
            await db
                .insertInto("user_categories")
                .values({
                    user_id: ctx.session.user.id,
                    category: input,
                })
                .onConflict((oc) => oc.doNothing())
                .execute();

            return { status: "success" };
        }),
    deselectCategory: protectedProcedure
        .input(categoryInput)
        .mutation(async ({ ctx, input }) => {
            const result = await db
                .deleteFrom("user_categories")
                .where("user_id", "=", ctx.session.user.id)
                .where("category", "=", input)
                .execute();

            if (result[0]!.numDeletedRows === 0n) {
                return {
                    status: "failure",
                    errorCode: "NOT_FOUND",
                    error: "Category not found"
                };
            }

            return { status: "success" };
        }),
    addCategory: adminProcedure
        .input(categoryInput)
        .mutation(async ({ input }) => {
            try {
                await db
                    .insertInto("categories")
                    .values({
                        slug: input,
                    })
                    .execute();

                return { status: "success" };
            } catch (err: any) {
                if (IsDuplicateEntry(err, "slug")) {
                    return {
                        status: "failure",
                        errorCode: "CONFLICT",
                        error: "Category already exists",
                    };
                }

                return {
                    status: "failure",
                    errorCode: err.code,
                    error: err.message,
                };
            }
        }),
    removeCategory: adminProcedure
        .input(categoryInput)
        .mutation(async ({ input }) => {
            const result = await db
                .deleteFrom("categories")
                .where("slug", "=", input)
                .execute();

            if (result[0]!.numDeletedRows === 0n) {
                return {
                    status: "failure",
                    errorCode: "NOT_FOUND",
                    error: "Category not found"
                };
            }

            return { status: "success" };
        }),
});
