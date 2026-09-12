import { z } from "zod";

export const sessionIdSchema = z.uuid();
export type SessionId = z.infer<typeof sessionIdSchema>;
