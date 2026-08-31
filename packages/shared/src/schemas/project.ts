import { z } from "zod";
import { priorityEnum } from "./company";
import { PROJECT_STATUSES } from "../project-goal-labels";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(value) : undefined));

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: optionalTrimmed(5000),
  repoUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || z.url().safeParse(value).success, { message: "Enter a valid URL" }),
  demoUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || z.url().safeParse(value).success, { message: "Enter a valid URL" }),
  technologies: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((tech) => tech.trim())
            .filter(Boolean)
        : [],
    ),
  status: z.enum(PROJECT_STATUSES as [string, ...string[]]).default("IDEA"),
  priority: priorityEnum.default("MEDIUM"),
  startDate: optionalDate,
  targetDate: optionalDate,
  progressPercent: z.coerce.number().int().min(0).max(100).default(0),
  notes: optionalTrimmed(5000),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
