// Expressive Code config (must live in a separate file when MDX content
// references the <Code> component directly — Astro needs to serialize
// the resolved config and JS plugins aren't JSON-safe).
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";

export default {
  themes: ["github-dark-default", "github-light-default"],
  plugins: [pluginLineNumbers(), pluginCollapsibleSections()],
  styleOverrides: {
    borderRadius: "0.625rem",
  },
};
