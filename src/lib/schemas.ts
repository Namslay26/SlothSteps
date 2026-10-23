import { z } from "zod";

export const saveGoalsSchema = z.object({
  goals: z.array(z.string().trim().min(3).max(500)).min(1).max(20),
  source: z.enum(["image", "manual"]),
});

export const stepStatusSchema = z
  .object({
    status: z.enum(["done", "skipped"]).optional(),
    shrink: z.boolean().optional(),
  })
  .refine((value) => value.status !== undefined || value.shrink === true, {
    message: "Provide a status or request a smaller step.",
  });

export const planSchema = z.object({
  force: z.boolean().optional(),
  goalId: z.string().optional(),
});
