import { z } from "zod";

export const careerSourceInputSchema = z.object({
  companyId: z.string().min(1),
  url: z.url("Enter a valid URL, including https://"),
  checkFrequencyMin: z.coerce.number().int().min(60).max(10080).default(1440),
});

export type CareerSourceInput = z.infer<typeof careerSourceInputSchema>;
