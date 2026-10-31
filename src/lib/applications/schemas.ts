import { z } from "zod";
import { APPLICATION_STATUSES, type AppStatus } from "@/lib/scoring/applications";

// Request bodies for /api/v1/applications. Shared by routes and the client form.

export const SOURCES = ["referral", "job_board", "company_site", "recruiter", "other"] as const;
export type Source = (typeof SOURCES)[number];

const text = (max: number) => z.string().trim().max(max);
// Absent stays absent (so PATCH leaves the field alone); empty string clears it.
const optText = (max: number) =>
  text(max)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null))
    .optional();
const uuid = z.uuid();
const status = z.enum(APPLICATION_STATUSES as [AppStatus, ...AppStatus[]]);
const isoDate = z.iso.datetime({ offset: true }).or(z.iso.date());
// followUpAt is a calendar date (no time).
const dateOnly = z.iso.date();

const fields = {
  jobDescriptionId: uuid.nullish(),
  resumeId: uuid.nullish(),
  company: text(200).optional(),
  roleTitle: text(200).optional(),
  roleFamily: optText(80),
  seniority: optText(80),
  industry: optText(120),
  companySize: optText(40),
  location: optText(200),
  source: z.enum(SOURCES).nullish(),
  referral: z.boolean().optional(),
  tailored: z.boolean().optional(),
  appliedAt: isoDate.optional(),
  followUpAt: dateOnly.nullish(),
  notes: optText(5000),
};

export const CreateApplicationSchema = z.object({ ...fields, status: status.optional() });
export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>;

// Status changes go through /events so every change is recorded.
export const UpdateApplicationSchema = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationSchema>;

export const CreateEventSchema = z.object({
  stage: status,
  occurredAt: isoDate.optional(),
  rejectionReason: optText(500),
  feedback: optText(5000),
  notes: optText(5000),
});
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const ListQuerySchema = z.object({ status: status.optional() });
