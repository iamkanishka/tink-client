/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/tests/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "CommonJS",
          moduleResolution: "Node",
          isolatedModules: true,
        },
        diagnostics: { ignoreCodes: [151002] },
      },
    ],
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/__tests__/**", "!src/index.ts"],
  coverageThreshold: {
    global: { branches: 60, functions: 70, lines: 70, statements: 70 },
  },
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
};
