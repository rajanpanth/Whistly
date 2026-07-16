const nextJest = require("next/jest.js");

const createJestConfig = nextJest({
    dir: __dirname,
});

/** @type {import('jest').Config} */
const config = {
    coverageProvider: "v8",
    testEnvironment: "jsdom",
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    testMatch: [
        "<rootDir>/src/**/__tests__/**/*.{ts,tsx}",
        "<rootDir>/src/**/*.test.{ts,tsx}",
    ],
    transformIgnorePatterns: [
        // Transform the ESM deps in the @solana/web3.js chain too, or Jest
        // chokes on `export` in jayson/rpc-websockets/@noble.
        "/node_modules/(?!(@solana|@noble|bs58|tweetnacl|superstruct|jayson|rpc-websockets|uuid|@coral-xyz)/)",
    ],
};

module.exports = createJestConfig(config);
