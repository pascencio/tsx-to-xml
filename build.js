const { build } = require("esbuild");

(async () => {
  await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    outdir: "dist",
    platform: "node",
    format: "esm",
    logLevel: "info",
    jsx: "automatic",
    jsxImportSource: "./src/xml-runtime"
  });
})();
