import { getTranslations } from "next-intl/server";
import type z from "zod";
import type {
  BaseArticleSchema,
  ArticleWithCatsSchema,
  ClassificationSchema,
} from "~/lib/validators/news";
import type { Agents, Fetches, Sources } from "./gen_types";

export type { DB } from "./gen_types";

export type Article = z.infer<typeof BaseArticleSchema>;

export type ArticleWithCategories = z.infer<
  typeof ArticleWithCatsSchema
>[number];

export type ArticleWithCategory = Article & {
  category: string | null;
};

export type Agent = Pick<Agents, "provider" | "model" | "api_key">;

export type Source = Pick<
  Sources,
  "slug" | "url" | "date_filter_param" | "date_format"
> &
  Pick<Fetches, "id" | "previous_etag">;

export type Classified = z.infer<typeof ClassificationSchema>;

export type ClassifyArticlesResult =
  | {
      status: "success";
      classified: Classified;
    }
  | {
      status: "failure";
      error: {
        code: string;
        message: string;
      };
    };

export type Translator = Awaited<ReturnType<typeof getTranslations>>;
