import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { z } from "astro:content";

/**
 * Extended Starlight content schema.
 *
 * `code_refs` and `code_refs_sha` power the drift-detection workflow:
 * every agent-authored article cites the product source files it
 * derives from, plus the git blob SHA at authoring time. The nightly
 * drift workflow compares against current submodule pointers.
 */
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // Authoring lineage — tracked for drift detection
        code_refs: z.array(z.string()).optional(),
        code_refs_sha: z.record(z.string(), z.string()).optional(),
        last_authored: z.string().optional(),
        last_reviewed: z.string().optional(),
        prompt_template: z.string().optional(),
        // Audience metadata — drives <Persona> tinting + journey maps
        persona: z
          .enum(["Driver", "Operator", "Selfhoster", "Developer", "All"])
          .optional(),
        surface: z.enum(["web", "ios", "selfhost", "n/a"]).optional(),
        // Tier metadata — shown by starlight-heading-badges
        tier: z.enum(["P0", "P1", "P2"]).optional(),
      }),
    }),
  }),
};
