import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      // Isolated check builds (MEDX_DIST_DIR=.next-<name>, see next.config.ts) are build output too.
      ".next-*/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "public/patient/**",
      ".data/**",
    ],
  },
];

export default eslintConfig;
