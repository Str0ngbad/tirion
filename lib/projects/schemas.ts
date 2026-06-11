import { z } from "zod";

const COLOR_VALUES = [
  "blue", "lightBlue", "purple", "lightPurple",
  "red", "pink", "orange", "lightOrange",
  "yellow", "green", "lightGreen", "gray", "brown",
] as const;

export const CreateProjectSchema = z.object({
  projectNumber: z.string().min(1),
  projectName: z.string().min(1),
  customerName: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  priority: z.number().int().optional(),
  color: z.enum(COLOR_VALUES).optional(),
  notes: z.string().optional(),
});

export const UpdateProjectSchema = z.object({
  projectNumber: z.string().min(1).optional(),
  projectName: z.string().min(1).optional(),
  customerName: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  priority: z.number().int().optional(),
  color: z.enum(COLOR_VALUES).optional(),
  notes: z.string().optional(),
});

export const AddTopLevelItemSchema = z.object({
  partId: z.number().int(),
  quantity: z.number().positive(),
});

export const UpdateTopLevelItemSchema = z.object({
  quantity: z.number().positive(),
});

export const ListProjectsQuerySchema = z.object({
  status: z.union([z.string(), z.array(z.string())]).optional(),
  customerName: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type AddTopLevelItemInput = z.infer<typeof AddTopLevelItemSchema>;
export type UpdateTopLevelItemInput = z.infer<typeof UpdateTopLevelItemSchema>;
export type ListProjectsQuery = z.infer<typeof ListProjectsQuerySchema>;
