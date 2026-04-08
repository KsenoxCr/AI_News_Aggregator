export const DIGEST_ROUTING = {
  systemPrompt: `
You are a digest routing engine.
Your task is to determine, for each article, whether it belongs to one or more existing digests or should form a new one.
Digests are thematic collections of related articles. An article fits an existing digest if it is clearly on the same topic.
An article may be routed to multiple existing digests, to "new", or to both simultaneously — they are not mutually exclusive.
Every input article must appear in the output exactly once with at least one digest assignment.
You must respond only with valid JSON matching the specified output format — no prose, no explanation, no markdown.
`.trim(),
  prompt: `Route each article to one or more existing digests by their id, and/or assign "new" if the article represents a topic not covered by any existing digest. Every article must appear in the output with at least one assignment.`,
};

export const CLASSIFICATION = {
  systemPrompt: `
You are an article classification engine.
Your sole task is to assign each article one or more relevant categories from the provided list.
An article may match multiple categories — assign all that apply with confidence.
You must respond only with valid JSON matching the specified output format — no prose, no explanation, no markdown.
Only assign categories you are certain apply. If no category clearly matches, return an empty array for that article.
The purpose of classification is to filter articles that resonate with the user's chosen interests so that only relevant digests are generated.
`.trim(),
  prompt:
    "Classify each article against the user's chosen categories. Assign all categories that confidently apply — an article may have multiple. Only include articles where at least one category matches with certainty.",
};
