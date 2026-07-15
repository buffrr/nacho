// Replaces `import.meta` with `({ url: "" })`. The libveritas wasm-bindgen glue
// references `import.meta.url` to locate its .wasm file; we initialize the WASM
// explicitly (src/fabric.web.ts) so that fallback never runs, but the bare
// `import.meta` syntax still has to be stripped for Metro to parse the module.
function neutralizeImportMeta() {
  return {
    name: "neutralize-import-meta",
    visitor: {
      MetaProperty(path) {
        const { meta, property } = path.node;
        if (
          meta &&
          meta.name === "import" &&
          property &&
          property.name === "meta"
        ) {
          path.replaceWithSourceString('({ url: "" })');
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [neutralizeImportMeta],
  };
};
