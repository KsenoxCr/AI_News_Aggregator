import { z } from "zod";

export const addAgentInput = z.object({
    slug: z.string()
        .min(1, "Name is required")
        .max(30, "Name must be 30 characters or less"),
    url: z.string()
        .url("Please enter a valid URL")
        .max(100, "URL must be 100 characters or less"),
    api_key: z.string()
        .min(1, "API key is required")
        .max(100, "API key must be 100 characters or less"),
});

export const modifyAgentInput = z.object({
    id: z.string()
        .length(36, "Invalid agent ID"),
    slug: z.string()
        .min(1, "Name is required")
        .max(30, "Name must be 30 characters or less")
        .optional(),
    url: z.string()
        .url("Please enter a valid URL")
        .max(100, "URL must be 100 characters or less")
        .optional(),
    api_key: z.string()
        .min(1, "API key is required")
        .max(100, "API key must be 100 characters or less")
        .optional(),
});
