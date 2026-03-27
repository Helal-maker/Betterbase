# Vector Search

BetterBase integrates pgvector for semantic similarity search - perfect for AI applications like RAG, recommendations, and embeddings-based retrieval.

## Define a Vector Field

```typescript
// bbf/schema.ts
import { defineSchema, defineTable, v } from "@betterbase/core/iac";

export default defineSchema({
  articles: defineTable({
    title:    v.string(),
    content:  v.string(),
    // 1536 dimensions for OpenAI embeddings
    embedding: v.vector(1536),
  }).index("by_embedding", ["embedding"]),
});
```

The migration generator will:
- Enable the pgvector extension
- Create the vector column with HNSW index for efficient similarity search

## Generate Embeddings

```typescript
import { generateEmbedding } from "@betterbase/client/iac";

const text = "What is BetterBase?";
const embedding = await generateEmbedding(text);
// Returns number[] of 1536 dimensions
```

## Similarity Search

```typescript
// bbf/queries/articles.ts
import { query } from "@betterbase/core/iac";
import { v } from "@betterbase/core/iac";

export const findSimilarArticles = query({
  args: { content: v.string() },
  handler: async (ctx, args) => {
    // Generate embedding from input text
    const { generateEmbedding } = await import("@betterbase/client/iac");
    const embedding = await generateEmbedding(args.content);
    
    // Find similar articles using cosine distance
    return ctx.db.query("articles")
      .similarity(embedding, { topK: 5 })
      .collect();
  },
});
```

## Similarity Options

```typescript
// Custom column name (default: "embedding")
.similarity(embedding, { column: "embedding" })

// Different topK (default: 10)
.similarity(embedding, { topK: 5 })

// Similarity threshold (0-1, lower = more similar)
.similarity(embedding, { threshold: 0.8 })
```

## Distance Metrics

By default uses L2 distance (`<->`). You can also use:
- Cosine similarity (`<=>`)
- Inner product (`<#>`)

```typescript
// Note: This requires custom SQL for now
const result = await ctx.db.execute(
  `SELECT *, (embedding <=> $1::vector) as cosine_dist FROM articles ORDER BY cosine_dist LIMIT 5`,
  [embedding]
);
```

## Use Cases

- **RAG**: Find contextually similar documents for AI chatbots
- **Recommendations**: "Similar items" feature
- **Deduplication**: Find near-duplicate content
- **Semantic search**: Beyond keyword matching