// Default Expo Metro config. Enables tsconfig "@/*" path aliases (SDK 50+).
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

module.exports = config;
