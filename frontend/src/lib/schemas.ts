import { z } from "zod";

export const mediaTypeSchema = z.enum(["song", "album", "artist", "playlist"]);
export type MediaType = z.infer<typeof mediaTypeSchema>;

export const seedWeightCurveSchema = z.enum(["linear", "exponential"]);
export type SeedWeightCurve = z.infer<typeof seedWeightCurveSchema>;

export const slidersSchema = z.object({
  popularity_bias: z.number().min(-1).max(1).default(0),
  diversity: z.number().min(0).max(1).default(0.5),
  discovery_radius: z.number().min(0).max(1).default(0.7),
  era_bias: z.number().min(-1).max(1).default(0),
  tags_include: z.array(z.string()).default([]),
  tags_exclude: z.array(z.string()).default([]),
  artists_include: z.array(z.string()).default([]),
  artists_exclude: z.array(z.string()).default([]),
  seed_weight_curve: seedWeightCurveSchema.default("linear"),
});
export type Sliders = z.infer<typeof slidersSchema>;

export const defaultSliders = (): Sliders => slidersSchema.parse({});

export const searchHitSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string(),
  image: z.string(),
  popularity: z.number(),
});
export type SearchHit = z.infer<typeof searchHitSchema>;

export const searchResponseSchema = z.object({
  type: mediaTypeSchema,
  query: z.string(),
  hits: z.array(searchHitSchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export type RecommendItem = {
  type: MediaType;
  id: string;
  name: string;
  artist_name: string;
  image: string | null;
  popularity: number;
  preview_url: string | null;
  open_url: string | null;
  why: string;
  tracks: RecommendItem[] | null;
};

const baseRecommendItem = z.object({
  type: mediaTypeSchema,
  id: z.string(),
  name: z.string(),
  artist_name: z.string(),
  image: z.string().nullable(),
  popularity: z.number(),
  preview_url: z.string().nullable(),
  open_url: z.string().nullable(),
  why: z.string(),
});

export const recommendItemSchema: z.ZodType<RecommendItem> = baseRecommendItem.extend({
  tracks: z.lazy(() => z.array(recommendItemSchema).nullable()),
});

export const recommendResponseSchema = z.object({
  seed: z.object({
    id: z.string(),
    type: mediaTypeSchema,
    name: z.string().nullable(),
    image: z.string().nullable(),
    popularity: z.number().nullable(),
  }),
  items: z.array(recommendItemSchema),
  debug: z.record(z.string(), z.union([z.string(), z.number()])),
});
export type RecommendResponse = z.infer<typeof recommendResponseSchema>;

export const seedPayloadSchema = z.object({
  input_type: mediaTypeSchema,
  id: z.string(),
});
export type SeedPayload = z.infer<typeof seedPayloadSchema>;

export const recommendRequestSchema = z.object({
  seed: seedPayloadSchema,
  output_type: mediaTypeSchema,
  sliders: slidersSchema,
  k: z.number().int().min(1).max(50).default(10),
});
export type RecommendRequest = z.infer<typeof recommendRequestSchema>;

export const presetSchema = z.object({
  id: z.string(),
  name: z.string(),
  sliders: slidersSchema,
  created_at: z.number(),
});
export type Preset = z.infer<typeof presetSchema>;
