// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import icon from "astro-icon";
import starlightImageZoom from "starlight-image-zoom";
import starlightLlmsTxt from "starlight-llms-txt";
import starlightSidebarTopics from "starlight-sidebar-topics";
import starlightHeadingBadges from "starlight-heading-badges";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";

// Brand palette mirrored from web/src/lib/colors.ts. Mermaid diagrams
// (v1.1) will theme against these values once we add a build-time
// renderer with Playwright.

export default defineConfig({
  site: "https://docs.polaris.express",
  trailingSlash: "ignore",

  integrations: [
    icon({ include: { lucide: ["*"] } }),
    sitemap(),
    robotsTxt({ sitemap: "https://docs.polaris.express/sitemap-index.xml" }),
    starlight({
      title: "Polaris Express Docs",
      description:
        "User, admin, and self-hosting documentation for Polaris Express — the EV charging platform.",
      logo: {
        light: "./src/assets/logo.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: false,
      },
      favicon: "/favicon.svg",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/expresscharge",
        },
      ],
      customCss: ["./src/styles/brand.css", "./src/styles/accents.css"],
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
      },
      components: {
        PageFrame: "./src/overrides/PageFrame.astro",
        Hero: "./src/overrides/Hero.astro",
      },
      expressiveCode: {
        themes: ["github-dark-default", "github-light-default"],
        plugins: [pluginLineNumbers(), pluginCollapsibleSections()],
        styleOverrides: {
          borderRadius: "0.625rem",
        },
      },
      plugins: [
        starlightImageZoom(),
        starlightHeadingBadges(),
        starlightSidebarTopics([
          {
            label: "User Guide",
            link: "/user/",
            icon: "user",
            items: [{ slug: "user" }, { autogenerate: { directory: "user" } }],
          },
          {
            label: "Admin Guide",
            link: "/admin/",
            icon: "settings",
            items: [
              { slug: "admin" },
              { autogenerate: { directory: "admin" } },
            ],
          },
          {
            label: "Selfhost",
            link: "/selfhost/",
            icon: "server",
            items: [
              { slug: "selfhost" },
              { autogenerate: { directory: "selfhost" } },
            ],
          },
          {
            label: "Reference",
            link: "/reference/",
            icon: "open-book",
            items: [
              { slug: "reference" },
              {
                label: "Concepts",
                items: [{ autogenerate: { directory: "concepts" } }],
              },
              {
                label: "API",
                items: [{ autogenerate: { directory: "api" } }],
              },
              { slug: "glossary" },
              { slug: "changelog" },
            ],
          },
        ]),
        starlightLlmsTxt({
          projectName: "Polaris Express",
          description:
            "EV charging platform — user, admin, and self-hosting documentation.",
        }),
      ],
    }),
  ],
});
