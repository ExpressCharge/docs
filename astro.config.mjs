// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import icon from "astro-icon";
import tailwindcss from "@tailwindcss/vite";
import starlightImageZoom from "starlight-image-zoom";
import starlightLinksValidator from "starlight-links-validator";
import starlightLlmsTxt from "starlight-llms-txt";
import starlightSidebarTopics from "starlight-sidebar-topics";
import starlightHeadingBadges from "starlight-heading-badges";
import starlightPackageManagers from "starlight-package-managers";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { rehypeMermaid } from "@beoe/rehype-mermaid";

// Brand-themed Mermaid palette — mirrors web/src/lib/colors.ts so diagrams
// inherit the same Volt-green / Electric-cyan / Amber language.
const mermaidThemeVariables = {
  primaryColor: "#0082bb",
  primaryTextColor: "#f6f9fb",
  primaryBorderColor: "#0082bb",
  secondaryColor: "#349c29",
  tertiaryColor: "#d8a400",
  lineColor: "#5b6772",
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  fontSize: "14px",
  background: "#f6f9fb",
};

const mermaidDarkThemeVariables = {
  primaryColor: "#3ec6d1",
  primaryTextColor: "#02060c",
  primaryBorderColor: "#3ec6d1",
  secondaryColor: "#66cd5b",
  tertiaryColor: "#f9c53b",
  lineColor: "#94a3b8",
  background: "#02060c",
};

export default defineConfig({
  site: "https://docs.polaris.express",
  trailingSlash: "ignore",

  markdown: {
    rehypePlugins: [
      [
        rehypeMermaid,
        {
          strategy: "img-svg",
          mermaidConfig: {
            theme: "base",
            themeVariables: mermaidThemeVariables,
            darkMode: false,
          },
          darkMermaidConfig: {
            theme: "base",
            themeVariables: mermaidDarkThemeVariables,
            darkMode: true,
          },
          cache: ".cache/mermaid",
        },
      ],
    ],
  },

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
          frames: {
            shadowColor: "transparent",
          },
        },
      },
      plugins: [
        starlightImageZoom(),
        starlightHeadingBadges(),
        starlightPackageManagers(),
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
              { label: "Concepts", autogenerate: { directory: "concepts" } },
              { label: "API", autogenerate: { directory: "api" } },
              { slug: "glossary" },
            ],
          },
        ]),
        starlightLlmsTxt({
          projectName: "Polaris Express",
          description:
            "EV charging platform — user, admin, and self-hosting documentation.",
        }),
        starlightLinksValidator({ errorOnLocalLinks: false }),
      ],
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
