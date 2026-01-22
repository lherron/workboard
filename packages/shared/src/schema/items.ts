import { z } from "zod";

export const itemSchema = z.object({
	id: z.string(),
	name: z.string().min(1),
	slot: z.enum(["head", "chest", "legs", "hands", "feet", "trinket", "weapon"]),
	rarity: z.enum(["common", "uncommon", "rare", "epic", "legendary"]).default("common"),
	description: z.string().optional(),
	assetUrl: z.string().url().optional(),
});

export type Item = z.infer<typeof itemSchema>;
export type NewItem = Omit<Item, "id"> & { id?: string };
