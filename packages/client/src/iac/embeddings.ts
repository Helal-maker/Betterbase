/**
 * Embedding generation utilities for vector search
 * Uses OpenAI by default, can be extended to other providers
 */

export interface EmbeddingOptions {
	/** Which provider to use: "openai" (default), "cohere", "custom" */
	provider?: string;
	/** For custom provider, specify the endpoint */
	endpoint?: string;
	/** API key (defaults to OPENAI_API_KEY env var) */
	apiKey?: string;
}

export interface EmbeddingResult {
	embedding: number[];
	model: string;
	provider: string;
}

/**
 * Generate embeddings for text using the specified provider
 *
 * @param text - The text to embed
 * @param options - Configuration options
 * @returns Promise resolving to embedding array
 *
 * @example
 * const embedding = await generateEmbedding("Hello world");
 * console.log(embedding.length); // 1536 for text-embedding-3-small
 */
export async function generateEmbedding(
	text: string,
	options: EmbeddingOptions = {},
): Promise<number[]> {
	const provider = options.provider ?? "openai";

	switch (provider) {
		case "openai":
			return generateOpenAIEmbedding(text, options.apiKey);
		case "cohere":
			return generateCohereEmbedding(text, options.apiKey);
		default:
			throw new Error(`Unknown embedding provider: ${provider}`);
	}
}

async function generateOpenAIEmbedding(text: string, apiKey?: string): Promise<number[]> {
	const key = apiKey ?? process.env.OPENAI_API_KEY;
	if (!key) {
		throw new Error("OPENAI_API_KEY not set. Pass apiKey or set the environment variable.");
	}

	const response = await fetch("https://api.openai.com/v1/embeddings", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${key}`,
		},
		body: JSON.stringify({
			input: text,
			model: "text-embedding-3-small",
		}),
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(`OpenAI embedding failed: ${error.error?.message ?? response.statusText}`);
	}

	const data = (await response.json()) as { data: { embedding: number[] }[] };
	return data.data[0].embedding;
}

async function generateCohereEmbedding(text: string, apiKey?: string): Promise<number[]> {
	const key = apiKey ?? process.env.COHERE_API_KEY;
	if (!key) {
		throw new Error("COHERE_API_KEY not set. Pass apiKey or set the environment variable.");
	}

	const response = await fetch("https://api.cohere.ai/v1/embed", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${key}`,
		},
		body: JSON.stringify({
			texts: [text],
			model: "embed-english-v3.0",
		}),
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(`Cohere embedding failed: ${error.message ?? response.statusText}`);
	}

	const data = (await response.json()) as { embeddings: number[][] };
	return data.embeddings[0];
}

/**
 * Generate embeddings for multiple texts in batches
 *
 * @param texts - Array of texts to embed
 * @param options - Configuration options
 * @yields Progress updates
 */
export async function* generateEmbeddings(
	texts: string[],
	options: EmbeddingOptions = {},
): AsyncGenerator<{ index: number; embedding: number[]; done: boolean }> {
	const batchSize = 100; // OpenAI batch limit
	const batches = [];

	for (let i = 0; i < texts.length; i += batchSize) {
		batches.push(texts.slice(i, i + batchSize));
	}

	for (let b = 0; b < batches.length; b++) {
		const batch = batches[b];

		if (options.provider === "openai" || !options.provider) {
			const key = options.apiKey ?? process.env.OPENAI_API_KEY;
			if (!key) throw new Error("OPENAI_API_KEY not set");

			const response = await fetch("https://api.openai.com/v1/embeddings", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${key}`,
				},
				body: JSON.stringify({
					input: batch,
					model: "text-embedding-3-small",
				}),
			});

			if (!response.ok) {
				throw new Error(`OpenAI batch embedding failed: ${response.statusText}`);
			}

			const data = (await response.json()) as { data: { embedding: number[] }[] };

			for (let i = 0; i < batch.length; i++) {
				yield {
					index: b * batchSize + i,
					embedding: data.data[i].embedding,
					done: b === batches.length - 1 && i === batch.length - 1,
				};
			}
		} else {
			// Fallback to sequential for other providers
			for (let i = 0; i < batch.length; i++) {
				const embedding = await generateEmbedding(batch[i], options);
				yield {
					index: b * batchSize + i,
					embedding,
					done: b === batches.length - 1 && i === batch.length - 1,
				};
			}
		}
	}
}
