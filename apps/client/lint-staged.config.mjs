const config = {
  "src/**/*.{js,jsx,ts,tsx}": (files) => {
    const quotedFiles = files.map((file) => JSON.stringify(file)).join(" ");

    return [
      `prettier --write ${quotedFiles}`,
      `eslint --fix ${quotedFiles}`,
      "pnpm run type-check",
      "pnpm run type-check:test",
    ];
  },
};

export default config;
