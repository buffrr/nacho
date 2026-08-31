const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: false,
  },
});

config.resolver.sourceExts = [...config.resolver.sourceExts, "mjs"];

// Serve the libveritas WASM binary as an asset so wasm-bindgen can fetch it.
config.resolver.assetExts = [...config.resolver.assetExts, "wasm"];

// Keep the standalone `website/` project (its own node_modules + web-only deps
// like next/react-dom) out of the RN bundler — otherwise Metro crawls it and
// trips over duplicate react/react-dom. The website builds independently.
config.resolver.blockList = [/\/website\/.*/];

module.exports = config;
