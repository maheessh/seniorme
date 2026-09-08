"use server";

import { companyInputSchema } from "@ccc/shared";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/server/auth-helpers";
import {
  createCompany,
  DuplicateDomainError,
  untrackCompany,
  updateCompany,
} from "@/lib/server/services/companies";

export type CompanyFormState = {
  ok?: true;
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

function parseCompanyForm(formData: FormData) {
  return companyInputSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain"),
    website: formData.get("website"),
    location: formData.get("location"),
    industry: formData.get("industry"),
    priority: formData.get("priority"),
    notes: formData.get("notes"),
    rolesOfInterest: formData.get("rolesOfInterest"),
    targetLocationKeywords: formData.get("targetLocationKeywords"),
    maxPostingAgeDays: formData.get("maxPostingAgeDays"),
    monitoringEnabled: formData.get("monitoringEnabled"),
  });
}

export async function createCompanyAction(
  _prevState: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const parsed = parseCompanyForm(formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const userId = await requireUserId();
    await createCompany(userId, parsed.data);
  } catch (error) {
    if (error instanceof DuplicateDomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/companies");
  revalidatePath("/");
  return { ok: true };
}

export async function updateCompanyAction(
  id: string,
  _prevState: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const parsed = parseCompanyForm(formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const userId = await requireUserId();
    await updateCompany(userId, id, parsed.data);
  } catch (error) {
    if (error instanceof DuplicateDomainError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/companies");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteCompanyAction(id: string) {
  const userId = await requireUserId();
  await untrackCompany(userId, id);
  revalidatePath("/companies");
  revalidatePath("/");
}
