import Anthropic from "@anthropic-ai/sdk";

export type LlmExtractedJob = {
  title?: string;
  companyName?: string;
  location?: string;
  isRemote?: boolean;
  employmentType?: string;
  description?: string;
  postedAt?: string;
  salaryMin?: number;
  salaryMax?: number;
};

const MAX_INPUT_CHARS = 12_000;

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "extract_job_posting",
  description: "Extract structured fields from a job posting page's text content.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "The job title" },
      companyName: { type: "string", description: "The hiring company's name" },
      location: { type: "string", description: "City/region, if stated" },
      isRemote: { type: "boolean", description: "True if explicitly remote-friendly" },
      employmentType: { type: "string", description: "e.g. full-time, internship, contract" },
      description: { type: "string", description: "A concise summary of the role and requirements, 2-4 sentences" },
      postedAt: { type: "string", description: "ISO 8601 date if a posting date is stated" },
      salaryMin: { type: "number" },
      salaryMax: { type: "number" },
    },
  },
};

/**
 * Last-resort extraction tier: only runs when ANTHROPIC_API_KEY is configured, and never
 * throws — any failure (missing key, rate limit, network error, malformed response) just
 * means the import flow falls through to manual entry.
 */
export async function extractJobWithLlm(pageText: string): Promise<LlmExtractedJob | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: "extract_job_posting" },
      messages: [
        {
          role: "user",
          content:
            "Extract job posting details from this page text. Only include fields that are " +
            "actually present — never guess or invent a value.\n\n" +
            pageText.slice(0, MAX_INPUT_CHARS),
        },
      ],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) return null;
    return toolUse.input as LlmExtractedJob;
  } catch {
    return null;
  }
}
