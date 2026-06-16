import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "Actyx RPC",
  tagline: "Type-safe RPC for composable server actions in TypeScript",
  favicon: "img/favicon.ico",

  future: {
    v4: true,
  },

  url: "https://actyx.explita.ng",
  baseUrl: "/",

  organizationName: "explita",
  projectName: "actyx-rpc",

  onBrokenLinks: "throw",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          // editUrl:
          //   "https://github.com/explita/daily-toolset/tree/main/packages/actyx-rpc/docs/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],

  themeConfig: {
    image: "img/docusaurus-social-card.jpg",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Actyx RPC",
      logo: {
        alt: "Actyx RPC Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Docs",
        },
        {
          href: "https://github.com/explita/actyx-rpc",
          label: "GitHub",
          position: "right",
        },
        {
          href: "https://www.npmjs.com/package/@explita/actyx-rpc",
          label: "NPM",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Documentation",
          items: [
            {
              label: "Introduction",
              to: "/docs/intro",
            },
            {
              label: "Core Concepts",
              to: "/docs/core-concepts/create-procedure",
            },
            {
              label: "Execution Policies",
              to: "/docs/execution-policies/authorization",
            },
            {
              label: "Advanced Guides",
              to: "/docs/advanced/context-access",
            },
          ],
        },
        {
          title: "React Integration",
          items: [
            {
              label: "Client Setup",
              to: "/docs/react/setup",
            },
            {
              label: "Queries & Mutations",
              to: "/docs/react/queries",
            },
            {
              label: "Cache Mutations",
              to: "/docs/react/cache-mutations",
            },
            {
              label: "WebSocket Subscriptions",
              to: "/docs/react/subscriptions",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/explita/actyx-rpc",
            },
            {
              label: "NPM Package",
              href: "https://www.npmjs.com/package/@explita/actyx-rpc",
            },
            {
              label: "Sponsor Project",
              href: "https://github.com/sponsors/explita",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} <a href="https://explita.ng" target="_blank" rel="noopener noreferrer">Explita</a>. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
