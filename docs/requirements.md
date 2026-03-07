# Requirements

## UX

- 5 views:
    - welcome/login screen
    - news source selection
    - AI model & interests selection
    - news view
    - article view (modal)


## Technical Requirements

- Authentication: ephemeral link to email
- Authorization for sensitive actions: ephemeral JWTs
- OAI API compatibility (de facto API structure in AI industry)
- Dedup of articles: ring buffer table under user table in db. DI for future implementation swap to redux cache. timed tail truncation on server side if db engine doesnt natively support ring buffers
- News feeds from sources must be stripped to minimum viable format for reduncing input token count & split into batched for fitting into ratelimits


## Technical Constraints

- Max 5 news sources (arbitrary amount. change later to accurate static or logic for dynamic calc once average article count per source and cloud AI platforms' ratelimits mapped out)


## Security

- API key hashed on served side


## Out of scope

- Intricate News Article Views (simple summary + publishers polished version enough)
- UA passwords: would require hashing & verification logic. Low ROI for security model; no sensitive info to protect


