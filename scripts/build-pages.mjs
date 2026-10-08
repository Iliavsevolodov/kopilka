import { cp, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Export an isolated local-only build; keep future server adapters in the source.
const root = process.cwd();
const stage = await mkdtemp(path.join(tmpdir(), "kopilka-pages-"));
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/kopilka";
if (!/^\/[a-zA-Z0-9_-]+$/.test(basePath))
  throw new Error("Invalid Pages base path");
try {
  await cp(root, stage, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(root, source);
      return (
        ![
          "node_modules",
          ".git",
          ".next",
          "out",
          "build",
          "test-results",
          "playwright-report",
        ].includes(relative.split(path.sep)[0]) &&
        !path.basename(source).startsWith(".env")
      );
    },
  });
  await symlink(
    path.join(root, "node_modules"),
    path.join(stage, "node_modules"),
    "dir",
  );
  await rm(path.join(stage, "proxy.ts"), { force: true });
  await rm(path.join(stage, "app/auth/callback"), {
    force: true,
    recursive: true,
  });
  for (const route of ["login", "forgot-password", "reset-password"]) {
    await writeFile(
      path.join(stage, `app/(auth)/${route}/page.tsx`),
      'import { LocalAuthNotice } from "@/components/local-auth-notice";\nexport default function Page(){return <LocalAuthNotice/>;}\n',
    );
  }
  await writeFile(
    path.join(stage, "next.config.ts"),
    `export default {output:'export', trailingSlash:true, basePath:${JSON.stringify(basePath)}, images:{unoptimized:true}, poweredByHeader:false};\n`,
  );
  const result = spawnSync(
    process.execPath,
    [path.join(root, "node_modules/next/dist/bin/next"), "build", "--webpack"],
    {
      cwd: stage,
      stdio: "inherit",
      env: { ...process.env, NEXT_PUBLIC_BASE_PATH: basePath },
    },
  );
  if (result.status !== 0) throw new Error("Pages build failed");
  await rm(path.join(root, "out"), { recursive: true, force: true });
  await cp(path.join(stage, "out"), path.join(root, "out"), {
    recursive: true,
  });
  await mkdir(path.join(root, "out"), { recursive: true });
  await writeFile(path.join(root, "out/.nojekyll"), "");
} finally {
  await rm(stage, { recursive: true, force: true });
}
