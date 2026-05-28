# Skill: Claude API

## What
Calling Claude, web search for recipe URLs, dynamic system prompt, JSON response parsing.

## When To Load
- Modifying AI behavior or prompts
- Working on `/api/chat/route.ts`
- Changing how meals or shopping lists are generated
- Debugging AI responses

## Requires
- `_context/normalize.md` — AI prompt rules for shopping items, recipe URL matching
- `_context/schema.md` — table structures (all family data lives in Supabase, read at runtime by buildSystemPrompt)

## Key Patterns

### API Call
```typescript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 8000,  // MUST be 8000 — combined responses are large
  system: await buildSystemPrompt(dateFrom, dateTo),
  messages,
  tools: useWebSearch ? [{ type: "web_search_20250305", name: "web_search" }] : undefined,
});
```

### Dynamic System Prompt (`lib/system-prompt.ts`)
Built at request time from database, not hardcoded. The function `buildSystemPrompt(dateFrom?, dateTo?)`:
1. Fetches family_members → computes ages from birthdates
2. Fetches active family_preferences → groups into dislikes/prefers/rules
3. Fetches meal_ratings → loved/banned/disliked lists
4. Fetches shopping_patterns (times_bought ≥ 3) → typical quantities
5. Checks for birthdays in the date range → adds birthday meal suggestion
6. Assembles BASE_PROMPT + all dynamic sections

Age-based guidance: under 3→smaller portions, 3-10→kid-friendly, teens→larger portions.

### Extracting Web Search URLs
```typescript
const content = response.content;
const text = content.filter(b => b.type === "text").map(b => b.text).join("");
const urls = [];
content.forEach(block => {
  if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
    block.content.forEach(r => {
      if (r.type === "web_search_result" && r.url) urls.push({ url: r.url, title: r.title });
    });
  }
});
```

### matchUrlToRecipe(recipeName, urls)
Score each URL: word overlap with recipe name × 2 + word overlap with URL + recipe site bonus (3 points for matprat.no, godt.no, etc.). Return best match URL or null.

### JSON Parsing (robust)
AI responses may be truncated or wrapped in text. Parse strategy:
1. Try targeted regex: `/\{"meals"\s*:\s*\[[\s\S]*?\](?:\s*,\s*"items"\s*:\s*\[[\s\S]*?\])?\s*\}/`
2. Try `{"items":...}` and `{"suggestions":...}` patterns
3. Fallback: find first `{`, try parse, if truncated try closing unclosed brackets
4. Show user-friendly error if all fail

### Response Formats
- Meal generation: `{"meals":[...], "items":[...]}` — combined meals + shopping in one call
- Suggestions: `{"suggestions":[{"name","description","source","extraIngredients"}...]}`
- Shopping only: `{"items":[{"name","quantity","category","forDay"}...]}`
- Chat: plain text (not JSON)

## Files Involved
- `lib/system-prompt.ts` — the dynamic prompt builder
- `app/api/chat/route.ts` — the AI proxy endpoint
- `lib/normalize.ts` — matchUrlToRecipe
