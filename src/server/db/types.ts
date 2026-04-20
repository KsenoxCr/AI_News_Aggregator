import type z from "zod";
import type {
  BaseArticleSchema,
  ArticleWithCatsSchema,
} from "~/lib/validators/news";
import type { Agent as AgentRow, Source as SourceRow } from "./gen_types";

export type { DB } from "./gen_types";

export type Article = z.infer<typeof BaseArticleSchema>;

export type ArticleWithCategories = z.infer<
  typeof ArticleWithCatsSchema
>[number];

export type ArticleWithCategory = Article & {
  category: string | null;
};

export type Agent = Pick<AgentRow, "provider" | "model" | "api_key">;

export type Source = Pick<
  SourceRow,
  "id" | "slug" | "url" | "date_filter_param" | "date_format" | "previous_etag"
>;
