/**
 * Embedding Service - Generate vector embeddings for semantic search
 * 
 * Supports both OpenAI and Gemini embedding models.
 * 
 * @module _shared/embeddings
 */

// ============================================================================
// TYPES
// ============================================================================

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
}

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

/**
 * Generate vector embedding from text using OpenAI or Gemini
 * 
 * @param apiKey - API key (sk-* for OpenAI, otherwise Gemini)
 * @param text - Text to embed
 * @param fetcher - Fetch function to use
 * @returns Embedding response or null on failure
 */
export async function generateEmbedding(
  apiKey: string,
  text: string,
  fetcher: typeof fetch
): Promise<EmbeddingResponse | null> {
  try {
    if (apiKey.startsWith("sk-")) {
      // OpenAI Embedding
      const response = await fetcher("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text,
          dimensions: 1536,
        }),
      });

      if (!response.ok) {
        console.error("OpenAI Embedding error:", response.status, await response.text());
        return null;
      }

      const data = await response.json();
      return {
        embedding: data.data[0].embedding,
        model: "openai-text-embedding-3-small"
      };
    }

    // Gemini Embedding
    const response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: {
            parts: [{ text }],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const embedding = data.embedding?.values;

    if (!embedding || !Array.isArray(embedding)) {
      console.error("Invalid embedding response from Gemini");
      return null;
    }

    // Pad to 1536 dimensions (Gemini returns 768)
    const paddedEmbedding = [...embedding, ...new Array(1536 - embedding.length).fill(0)];

    return {
      embedding: paddedEmbedding,
      model: "gemini-text-embedding-004",
    };
  } catch (error) {
    console.error("Error generating AI embedding:", error);
    return null;
  }
}

/**
 * Batch generate embeddings with rate limiting
 * 
 * @param apiKey - API key
 * @param texts - Array of texts to embed
 * @param fetcher - Fetch function
 * @param delayMs - Delay between requests (default: 100ms)
 */
export async function batchGenerateEmbeddings(
  apiKey: string,
  texts: string[],
  fetcher: typeof fetch,
  delayMs: number = 100
): Promise<(EmbeddingResponse | null)[]> {
  const results: (EmbeddingResponse | null)[] = [];
  
  for (let i = 0; i < texts.length; i++) {
    const result = await generateEmbedding(apiKey, texts[i], fetcher);
    results.push(result);
    
    // Rate limiting delay (skip on last item)
    if (i < texts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}
