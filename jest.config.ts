import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testTimeout: 15000,
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  collectCoverageFrom: [
    "Terminal/src/**/*.ts",
    "WebBrowser/src/**/*.ts",
    "Calculator/src/**/*.ts",
    "DocumentScraper/src/**/*.ts",
    "Clock/src/**/*.ts",
    "Browserless/src/**/*.ts",
    "AskUser/src/**/*.ts",
    "RAG/src/**/*.ts",
    "Memory/src/**/*.ts",
    "!**/*.d.ts",
  ],
  coverageThreshold: {
    global: {
      statements: 50,
      branches: 40,
      functions: 50,
      lines: 50,
    },
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react",
          esModuleInterop: true,
          baseUrl: ".",
          paths: {
            "@shared/*": ["shared/*"],
          },
        },
      },
    ],
  },
};

export default config;
