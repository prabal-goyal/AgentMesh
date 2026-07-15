import { tavily } from '@tavily/core'

// Initialize once at module load — reused across all requests
const client = tavily({ apiKey: process.env.TAVILY_API_KEY ?? '' })

// Runs a web search and returns formatted results as plain text.
// The executor injects this text into the model's conversation as a tool result.
export async function searchWeb(query: string): Promise<string> {
  const result = await client.search(query, {
    maxResults: 5,
    searchDepth: 'basic', // 'advanced' costs more credits — 'basic' is fine for most queries
  })

  if (result.results.length === 0) return 'No search results found.'

  return result.results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 400)}`)
    .join('\n\n---\n\n')
}
