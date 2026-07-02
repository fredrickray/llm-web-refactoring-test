import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
		setupFiles: ["./tests/setup.ts"],
		// Prevent parallel test files from sharing the mocked in-memory DB
		fileParallelism: false,
		hookTimeout: 30000,
		testTimeout: 15000,
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["src/services/**/*.ts"],
			exclude: ["src/**/*.test.ts"],
		},
	},
});
