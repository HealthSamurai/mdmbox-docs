import { relative, resolve } from "node:path";

export interface VersionFileAssetLinksOptions {
  assetsDir: string;
  productPath: string;
}

const FILE_DIRECTIVE = /({%\s*file\b(?:(?!%}).)*?\bsrc=")([^"]+)("(?:(?!%}).)*?%})/gs;

function splitSource(source: string): {
  path: string;
  query: string;
  fragment: string;
} {
  const hashIndex = source.indexOf("#");
  const fragment = hashIndex >= 0 ? source.slice(hashIndex) : "";
  const withoutFragment = hashIndex >= 0 ? source.slice(0, hashIndex) : source;
  const queryIndex = withoutFragment.indexOf("?");

  return {
    path: queryIndex >= 0 ? withoutFragment.slice(0, queryIndex) : withoutFragment,
    query: queryIndex >= 0 ? withoutFragment.slice(queryIndex + 1) : "",
    fragment,
  };
}

async function versionSource(
  source: string,
  options: VersionFileAssetLinksOptions
): Promise<string> {
  const { path, query, fragment } = splitSource(source);
  const assetPrefix = `${options.productPath}/assets/`;

  if (!path.startsWith(assetPrefix)) {
    return source;
  }

  const encodedAssetPath = path.slice(assetPrefix.length);
  let assetPath: string;
  try {
    assetPath = decodeURIComponent(encodedAssetPath);
  } catch {
    throw new Error(`Invalid file asset path: ${path}`);
  }

  const assetsDir = resolve(options.assetsDir);
  const fullPath = resolve(assetsDir, assetPath);
  const pathFromAssetsDir = relative(assetsDir, fullPath);
  if (pathFromAssetsDir.startsWith("..") || pathFromAssetsDir.startsWith("/")) {
    throw new Error(`File asset escapes the assets directory: ${path}`);
  }

  const file = Bun.file(fullPath);
  if (!(await file.exists())) {
    throw new Error(`Referenced file asset does not exist: ${path}`);
  }

  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(await file.arrayBuffer());
  const fingerprint = hasher.digest("hex").slice(0, 16);
  const params = new URLSearchParams(query);
  params.set("v", fingerprint);

  return `${path}?${params.toString()}${fragment}`;
}

export async function versionFileAssetLinks(
  markdown: string,
  options: VersionFileAssetLinksOptions
): Promise<string> {
  const matches = [...markdown.matchAll(FILE_DIRECTIVE)];
  if (matches.length === 0) return markdown;

  let result = "";
  let offset = 0;

  for (const match of matches) {
    const index = match.index;
    const prefix = match[1];
    const source = match[2];
    const suffix = match[3];
    if (index === undefined || prefix === undefined || source === undefined || suffix === undefined) {
      continue;
    }

    result += markdown.slice(offset, index);
    result += `${prefix}${await versionSource(source, options)}${suffix}`;
    offset = index + match[0].length;
  }

  return result + markdown.slice(offset);
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check");
  const repoDir = resolve(import.meta.dir, "..");
  const docsDir = resolve(repoDir, "docs");
  const assetsDir = resolve(repoDir, "assets");
  const changedFiles: string[] = [];
  const glob = new Bun.Glob("**/*.md");

  for await (const relativePath of glob.scan({ cwd: docsDir, onlyFiles: true })) {
    const markdownPath = resolve(docsDir, relativePath);
    const markdown = await Bun.file(markdownPath).text();
    const versioned = await versionFileAssetLinks(markdown, {
      assetsDir,
      productPath: "/docs/mdmbox",
    });

    if (versioned !== markdown) {
      changedFiles.push(`docs/${relativePath}`);
      if (!checkOnly) {
        await Bun.write(markdownPath, versioned);
      }
    }
  }

  if (changedFiles.length === 0) {
    console.log("File asset versions are current.");
    return;
  }

  if (checkOnly) {
    console.error(`Outdated file asset versions:\n${changedFiles.map((path) => `  ${path}`).join("\n")}`);
    console.error("Run `bun run assets:version` and commit the updated Markdown.");
    process.exitCode = 1;
    return;
  }

  console.log(`Updated file asset versions:\n${changedFiles.map((path) => `  ${path}`).join("\n")}`);
}

if (import.meta.main) {
  await main();
}
