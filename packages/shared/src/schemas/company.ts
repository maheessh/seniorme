import { z } from "zod";

export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type Priority = z.infer<typeof priorityEnum>;

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const companyInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(255)
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || /^[a-z0-9.-]+\.[a-z]{2,}$/.test(value), {
      message: "Enter a bare domain, e.g. stripe.com",
    }),
  website: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || z.url().safeParse(value).success, {
      message: "Enter a valid URL",
    }),
  location: optionalTrimmed(200),
  industry: optionalTrimmed(200),
  priority: priorityEnum.default("MEDIUM"),
  notes: optionalTrimmed(5000),
  rolesOfInterest: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((role) => role.trim())
            .filter(Boolean)
        : [],
    ),
  monitoringEnabled: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .optional()
    .transform((value) => value === "on" || value === "true" || value === true),
});

export type CompanyInput = z.infer<typeof companyInputSchema>;
