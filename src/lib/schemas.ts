
import { z } from "zod";

export const goalSchema = z.object({
  text: z.string().trim().min(3).max(500),
  source: z.enum(["image", "manual"]),
});

export const stepSchema = z.object({
  text: z.string().trim().min(3).max(200),
  minutes: z.number().int().min(1).max(10),
});

export const stepStatusSchema = z.object({
  status: z.enum(["done", "skipped", "pending"]).optional(),
  shrink: z.boolean().optional(),
}).refine(
  (value) =>
    value.status !== undefined || value.shrink === true,
  { message: "Provide a status or request a smaller step." }
);
