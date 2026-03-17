import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/?(*.)+(spec|test).ts",
  ],
  collectCoverageFrom: [
    "Terminal/src/**/*.ts",
    "WebBrowser/src/**/*.ts",
    "Calculator/src/**/*.ts",
    "DocumentScraper/src/**/*.ts",
    "Clock/src/**/*.ts",
    "Browserless/src/**/*.ts",
    "Memory/src/**/*.ts",
    "!**/*.d.ts",
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
    "Terminal/src/**": { statements: 85 },
    "Calculator/src/**": { statements: 90 },
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
            "@shared/*": ["shared/*"]
          }
        },
      },
    ],
  },
};

export default config;
