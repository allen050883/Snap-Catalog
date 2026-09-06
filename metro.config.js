const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation loads its SQLite engine as a .wasm file;
// Metro needs to know to treat that extension as a bundleable asset.
config.resolver.assetExts.push('wasm');

module.exports = config;
