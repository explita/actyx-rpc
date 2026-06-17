import React from "react";
import { Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageMap = await getPageMap();
  let enhancedPageMap = [...pageMap];
  const metaConfig = {
    home: {
      title: "Home",
      type: "page",
      href: "/",
    },
    docs: {
      title: "Docs",
      type: "page",
      href: "/docs",
    },
    playground: {
      title: "Playground",
      type: "page",
      href: "/playground",
    },
  };

  const firstItem = enhancedPageMap[0];
  if (firstItem && "data" in firstItem) {
    (firstItem as any).data = {
      ...(firstItem as any).data,
      ...metaConfig,
    };
  } else {
    enhancedPageMap.unshift({ data: metaConfig });
  }

  enhancedPageMap = enhancedPageMap.filter((i: any) => i.name !== "index");

  return (
    <Layout
      pageMap={enhancedPageMap}
      navbar={
        <Navbar
          logo={
            <div className="flex flex-row items-center gap-2">
              <Logo size={24} />
              <span className="font-extrabold text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-cyan-500 text-lg select-none">
                Actyx RPC Docs
              </span>
            </div>
          }
          projectLink="https://github.com/explita/actyx-rpc"
        />
      }
      footer={<Footer />}
      docsRepositoryBase="https://github.com/explita/actyx-rpc"
      editLink={null}
      sidebar={{ defaultMenuCollapseLevel: 1 }}
      children={children}
    />
  );
}
