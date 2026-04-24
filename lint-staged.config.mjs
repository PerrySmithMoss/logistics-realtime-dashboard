import path from "node:path";

const quoteFiles = (files) => files.map((file) => JSON.stringify(file)).join(" ");

const stripPrefix = (files, prefix) =>
  files.map((file) => {
    const relativeFile = path.relative(process.cwd(), file);

    if (!relativeFile.startsWith(prefix)) {
      throw new Error(
        `Expected ${JSON.stringify(relativeFile)} to start with ${JSON.stringify(prefix)}`,
      );
    }

    return relativeFile.slice(prefix.length);
  });

const scopedLint =
  (dir, prefix, runTypeChecks = true) =>
  (files) => {
    const scopedFiles = stripPrefix(files, prefix);

    const commands = [
      `prettier --write ${quoteFiles(files)}`,
      `pnpm --dir ${dir} exec eslint --fix ${quoteFiles(scopedFiles)}`,
    ];

    if (runTypeChecks) {
      commands.push(`pnpm --dir ${dir} run type-check`);
      commands.push(`pnpm --dir ${dir} run type-check:test`);
    }

    return commands;
  };

export default {
  "apps/client/**/*.{js,mjs,ts,tsx}": scopedLint("apps/client", "apps/client/"),
  "apps/server/**/*.{js,mjs,ts,tsx}": scopedLint("apps/server", "apps/server/"),
  "packages/common/**/*.{js,mjs,ts,tsx}": scopedLint("packages/common", "packages/common/"),
  "*.{js,mjs,ts,tsx}": (files) => `prettier --write ${quoteFiles(files)}`,
  "**/*.{json,md,yml}": (files) => `prettier --write ${quoteFiles(files)}`,
};
