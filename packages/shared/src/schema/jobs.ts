import { z } from "zod";

export const jobStatus = z.enum(["queued", "processing", "completed", "failed", "canceled"]);

export const jobSchema = z.object({
	id: z.string(),
	kind: z.enum(["t2i", "i2i", "i2i_item"]).default("t2i"),
	status: jobStatus.default("queued"),
	userId: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	input: z.record(z.any()).default({}),
	output: z.record(z.any()).optional(),
	error: z.record(z.any()).optional(),
});

export type Job = z.infer<typeof jobSchema>;
export type NewJob = Omit<Job, "id" | "createdAt" | "updatedAt" | "status"> & {
	id?: string;
	status?: Job["status"];
};
