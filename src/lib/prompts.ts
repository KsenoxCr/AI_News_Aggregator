// TODO: Add users freeform preferences int systemPrompts (append or overwrite based on users choice)

export const DIGEST_ROUTING = {
  systemPrompt: `
You are a digest routing engine.
Your task is to determine, for each article, whether it belongs to one or more existing digests or should form a new one.
Digests are thematic collections of related articles. An article fits an existing digest if it is clearly on the same topic.
An article may be routed to multiple existing digests, to "new", or to both simultaneously — they are not mutually exclusive.
Every input article must appear in the output exactly once with at least one digest assignment.
Each article carries a "categories" field — use these to inform routing decisions. An article should be routed to an existing digest only if their categories overlap or are closely related. When no existing digest shares a compatible category, assign "new".
You must respond only with valid JSON matching the specified output format — no prose, no explanation, no markdown.
`.trim(),
  prompt: (articles: string, prevDigests: string, schemaString: string) =>
    `
Route each article to one or more existing digests by their id, and/or assign "new" if the article represents a topic not covered by any existing digest. Use the article's categories to guide routing — prefer matches where categories align. Every article must appear in the output with at least one assignment.

\`\`\`(articles)
${articles}
\`\`\`

\`\`\`(existing digests)
${prevDigests}
\`\`\`

\`\`\`(output format)
${schemaString}
\`\`\`
`.trim(),
};

export const DIGEST_GENERATION = {
  systemPrompt: `
You are a digest generation engine.
A digest is a concise, continuously-updated summary of a evolving topic, built from one or more source articles.
You will receive one article and either an existing digest or the literal string "new".
If the digest is "new": synthesise a fresh digest from the article alone. Give it a short, descriptive title.
If a previous digest revision is provided: produce an updated revision that incorporates the article's information. Preserve accurate prior content, add new facts, and correct any information the article supersedes. Do not repeat information already present unless it needs correction. Keep the title unless the topic has materially shifted.
Write in clear, neutral prose. Do not reference the source article directly — the digest must read as a self-contained summary.
You must respond only with valid JSON matching the specified output format — no prose, no explanation, no markdown.
`.trim(),
  prompt: (article: string, digest: string, schemaString: string) =>
    `
Given the article and the digest field below, produce the output digest. If digest is "new", create a fresh digest from the article. Otherwise, return an updated revision of the existing digest that incorporates the article's additional or corrected information.

\`\`\`(article)
${article}
\`\`\`

\`\`\`(digest)
${digest}
\`\`\`

\`\`\`(output format)
${schemaString}
\`\`\`
`.trim(),
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
  prompt: (
    serializedArticles: string,
    categories: string[],
    schemaString: string,
  ) =>
    `
Classify each article against the user's chosen categories. Assign all categories that confidently apply — an article may have multiple. Only include articles where at least one category matches with certainty.

\`\`\`(input)
${serializedArticles}
\`\`\`

\`\`\`(categories)
[${categories}]
\`\`\`

\`\`\`(output format)
${schemaString}
\`\`\`
`.trim(),
};
