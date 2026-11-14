const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Pantau folder di monorepo root agar paket bersama (@daydone/shared) dapat di-resolve
config.watchFolders = [monorepoRoot];

// 2. Tentukan lokasi pencarian node_modules untuk kompatibilitas pnpm
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
