import crypto from 'crypto';

export type EmbeddingResult = {
  embedding: number[];
  model: string;
};

/**
 * Generates a deterministic pseudo-embedding based on SHA-256 hash.
 * This is meant for local development and testing to avoid API costs.
 * It always returns the same vector for the same text.
 */
function generateDeterministicEmbedding(text: string, dimensions = 1536): number[] {
  const hash = crypto.createHash('sha256').update(text).digest();
  
  const result = new Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    const byteIndex = i % 32;
    const offset = Math.floor(i / 32);
    // map the byte value to a range between -1.0 and 1.0 roughly
    result[i] = ((hash[byteIndex] + offset) % 255) / 128.0 - 1.0; 
  }
  
  // normalize the vector
  const norm = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0));
  return result.map(v => v / (norm || 1));
}

/**
 * Generate embedding for a given text.
 * Falls back to local deterministic embedding if no provider/API key is found.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const provider = process.env.EMBEDDINGS_PROVIDER || 'local';
  
  if (provider === 'local') {
    return {
      embedding: generateDeterministicEmbedding(text),
      model: 'local-hash-embedding'
    };
  }

  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          input: text,
          model: process.env.EMBEDDINGS_MODEL || 'text-embedding-ada-002'
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid response from OpenAI API');
      }

      return {
        embedding: data.data[0].embedding,
        model: process.env.EMBEDDINGS_MODEL || 'text-embedding-ada-002'
      };
    } catch (error) {
      console.warn("External embedding failed, falling back to local.", error);
      return {
        embedding: generateDeterministicEmbedding(text),
        model: 'local-fallback'
      };
    }
  }

  // Fallback if provider is external but no key, or provider unknown
  return {
    embedding: generateDeterministicEmbedding(text),
    model: 'local-hash-embedding'
  };
}
