import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;

// Sync manifest.json with the version from `npm version`.
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "  ") + "\n");

// Record the minimum app version for this release.
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "  ") + "\n");
