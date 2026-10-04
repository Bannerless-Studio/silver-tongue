import { defineConfig } from "vitest/config";

export default defineConfig({
  // 20s: the tools tests build whole courses, which under a full parallel run can pass 5s.
  test: { include: ["packages/*/test/**/*.test.ts", "tools/test/**/*.test.ts"], testTimeout: 20_000 },
});
