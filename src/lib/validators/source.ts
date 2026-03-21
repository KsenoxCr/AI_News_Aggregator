import { z } from "zod";

export const addSourceInput = z.object({
    slug: z.string()
        .min(1, "Name is required")
        .max(30, "Name must be 30 characters or less"),
    url: z.string()
        .url("Please enter a valid URL")
        .max(100, "URL must be 100 characters or less"),
});

export const removeSourceInput = z.string()
    .length(36);
