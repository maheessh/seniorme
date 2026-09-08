"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/server/auth-helpers";
import { searchAllCompanies } from "@/lib/server/services/companies";
import { extractJobFromUrl, importJob, type JobImportInput } from "@/lib/server/services/job-import";

export async function extractJobUrlAction(
  url: string,
): Promise<{ error?: string; data?: Awaited<ReturnType<typeof extractJobFromUrl>> }> {
  try {
    new URL(url);
  } catch {
    return { error: "Enter a valid URL, including https://" };
  }

  try {
    const result = await extractJobFromUrl(url);
    return { data: result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Couldn't fetch that URL",
    };
  }
}

export async function searchAllCompaniesAction(query: string) {
  return searchAllCompanies(query);
}

export type ImportFormState = { error?: string; ok?: true } | undefined;

function parseNumber(value: FormDataEntryValue | null): number | null {
  const str = value ? String(value).trim() : "";
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const str = value ? String(value).trim() : "";
  return str ? new Date(str) : null;
}

function parseString(value: FormDataEntryValue | null): string | undefined {
  const str = value ? String(value).trim() : "";
  return str || undefined;
}

export async function confirmJobImportAction(
  _prevState: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const url = String(formData.get("url") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!url || !title) return { error: "URL and title are required" };

  const companyId = parseString(formData.get("companyId"));
  const newCompanyName = parseString(formData.get("newCompanyName"));
  if (!companyId && !newCompanyName) return { error: "Pick or name a company" };

  const input: JobImportInput = {
    url,
    title,
    companyId,
    newCompanyName,
    newCompanyDomain: parseString(formData.get("newCompanyDomain")),
    location: parseString(formData.get("location")),
    workMode: (parseString(formData.get("workMode")) as JobImportInput["workMode"]) ?? "UNKNOWN",
    employmentType: (parseString(formData.get("employmentType")) as JobImportInput["employmentType"]) ?? null,
    description: parseString(formData.get("description")),
    postedAt: parseDate(formData.get("postedAt")),
    salaryMin: parseNumber(formData.get("salaryMin")),
    salaryMax: parseNumber(formData.get("salaryMax")),
    externalJobId: parseString(formData.get("externalJobId")) ?? null,
    addToPipeline: formData.get("addToPipeline") === "on",
  };

  const userId = await requireUserId();
  try {
    await importJob(userId, input);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to import job" };
  }

  revalidatePath("/inbox");
  revalidatePath("/pipeline");
  revalidatePath("/");
  return { ok: true };
}
