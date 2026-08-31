import { z } from "zod";
import { priorityEnum } from "./company";
import { GOAL_CATEGORIES, GOAL_STATUSES } from "../project-goal-labels";

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

const optionalInt = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? Number(value) : undefined))
  .refine((value) => value === undefined || Number.isFinite(value), { message: "Enter a whole number" });

export const goalInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  category: z.enum(GOAL_CATEGORIES as [string, ...string[]]).default("OTHER"),
  targetValue: optionalInt,
  currentValue: z.coerce.number().int().min(0).default(0),
  deadline: optionalDate,
  priority: priorityEnum.default("MEDIUM"),
  status: z.enum(GOAL_STATUSES as [string, ...string[]]).default("NOT_STARTED"),
  notes: optionalTrimmed(5000),
});

export type GoalInput = z.infer<typeof goalInputSchema>;
