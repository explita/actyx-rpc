import nextra from "nextra";
import path from "path";

const withNextra = nextra({
  contentDirBasePath: "/docs",
  defaultShowCopyCode: true,
  codeHighlight: true,
});

const nextConfig = {
  reactCompiler: false,
  turbopack: {
    root: path.join(__dirname, "."),
  },
};

export default withNextra(nextConfig);
