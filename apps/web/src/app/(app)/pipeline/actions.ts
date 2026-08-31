"use server";

import type { ApplicationStage } from "@ccc/db";
import { revalidatePath } from "next/cache";
import {
  addApplicationNote,
  createContact,
  getApplication,
  listContactsForCompany,
  moveApplicationStage,
  updateApplicationDetails,
  type ApplicationDetailsInput,
} from "@/lib/server/services/applications";

export async function moveStageAction(applicationId: string, toStage: ApplicationStage): Promise<void> {
  await moveApplicationStage(applicationId, toStage);
  revalidatePath("/pipeline");
  revalidatePath("/");
}

export async function getApplicationDetailAction(applicationId: string) {
  const application = await getApplication(applicationId);
  if (!application) return null;
  const contacts = await listContactsForCompany(application.companyId);
  return { application, contacts };
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const str = value ? String(value).trim() : "";
  return str ? new Date(str) : null;
}

function parseString(value: FormDataEntryValue | null): string | null {
  const str = value ? String(value).trim() : "";
  return str || null;
}

export type ActionState = { error?: string; ok?: true } | undefined;

export async function updateDetailsAction(
  applicationId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const data: ApplicationDetailsInput = {
    deadline: parseDate(formData.get("deadline")),
    followUpDate: parseDate(formData.get("followUpDate")),
    resumeVersion: parseString(formData.get("resumeVersion")),
    coverLetter: parseString(formData.get("coverLetter")),
    notes: parseString(formData.get("notes")),
    recruiterContactId: parseString(formData.get("recruiterContactId")),
  };
  await updateApplicationDetails(applicationId, data);
  revalidatePath("/pipeline");
  revalidatePath("/");
  return { ok: true };
}

export async function addNoteAction(
  applicationId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "Enter a note" };
  const scheduledAt = parseDate(formData.get("scheduledAt")) ?? undefined;
  await addApplicationNote(applicationId, note, scheduledAt);
  revalidatePath("/pipeline");
  return { ok: true };
}

export async function createContactAction(
  companyId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required" };
  await createContact(companyId, {
    name,
    role: parseString(formData.get("role")),
    email: parseString(formData.get("email")),
    linkedInUrl: parseString(formData.get("linkedInUrl")),
  });
  revalidatePath("/pipeline");
  return { ok: true };
}
