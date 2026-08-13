import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { versionFileAssetLinks } from "./version-file-assets";

const fixtureDirs: string[] = [];

function createFixture(): { assetsDir: string; composePath: string } {
  const assetsDir = mkdtempSync(join(tmpdir(), "mdmbox-docs-assets-"));
  const examplesDir = join(assetsDir, "examples");
  const composePath = join(examplesDir, "docker-compose.yml");
  fixtureDirs.push(assetsDir);
  mkdirSync(examplesDir, { recursive: true });
  writeFileSync(composePath, "services: {}\n");
  return { assetsDir, composePath };
}

afterEach(() => {
  for (const fixtureDir of fixtureDirs.splice(0)) {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

describe("versionFileAssetLinks", () => {
  test("adds a content hash to a local file directive", async () => {
    const { assetsDir } = createFixture();
    const markdown = `{% file src="/docs/mdmbox/assets/examples/docker-compose.yml" %}
docker-compose.yml
{% endfile %}`;

    const result = await versionFileAssetLinks(markdown, {
      assetsDir,
      productPath: "/docs/mdmbox",
    });

    expect(result).toMatch(
      /src="\/docs\/mdmbox\/assets\/examples\/docker-compose\.yml\?v=[a-f0-9]{16}"/
    );
  });

  test("changes the URL after the referenced file changes", async () => {
    const { assetsDir, composePath } = createFixture();
    const markdown = `{% file src="/docs/mdmbox/assets/examples/docker-compose.yml" / %}`;
    const before = await versionFileAssetLinks(markdown, {
      assetsDir,
      productPath: "/docs/mdmbox",
    });

    writeFileSync(composePath, "services:\n  mdmbox: {}\n");
    const after = await versionFileAssetLinks(before, {
      assetsDir,
      productPath: "/docs/mdmbox",
    });

    expect(after).not.toBe(before);
    expect(after).not.toContain("?v=stale");
  });

  test("replaces a stale hash while preserving other query parameters and fragments", async () => {
    const { assetsDir } = createFixture();
    const markdown = `{% file src="/docs/mdmbox/assets/examples/docker-compose.yml?download=1&v=stale#example" / %}`;

    const result = await versionFileAssetLinks(markdown, {
      assetsDir,
      productPath: "/docs/mdmbox",
    });

    expect(result).toMatch(/src="\/docs\/mdmbox\/assets\/examples\/docker-compose\.yml\?download=1&v=[a-f0-9]{16}#example"/);
  });

  test("rejects a missing local asset instead of leaving an unsafe immutable URL", async () => {
    const { assetsDir } = createFixture();
    const markdown = `{% file src="/docs/mdmbox/assets/examples/missing.yml" / %}`;

    expect(
      versionFileAssetLinks(markdown, {
        assetsDir,
        productPath: "/docs/mdmbox",
      })
    ).rejects.toThrow("Referenced file asset does not exist");
  });

  test("leaves external file directives unchanged", async () => {
    const { assetsDir } = createFixture();
    const markdown = `{% file src="https://example.com/docker-compose.yml" / %}`;

    expect(
      await versionFileAssetLinks(markdown, {
        assetsDir,
        productPath: "/docs/mdmbox",
      })
    ).toBe(markdown);
  });
});
