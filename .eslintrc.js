module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "prettier"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:prettier/recommended",
  ],
  parserOptions: {
    project: "./tsconfig.eslint.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/no-misused-promises": "error",
    // Intentional SDK pattern: `"KNOWN_VALUE" | "OTHER_VALUE" | string` gives IDE
    // autocomplete for documented values while still accepting any string Marqeta
    // might add server-side without a type error. This is the same pattern Stripe's
    // and Twilio's official SDKs use for forward-compatible enums.
    "@typescript-eslint/no-redundant-type-constituents": "off",
    "no-console": "warn",
    "prettier/prettier": "error",
  },
};
