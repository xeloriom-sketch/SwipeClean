const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Permettre le bundling des fichiers .lottie comme assets
config.resolver.assetExts.push("lottie");

module.exports = config;
