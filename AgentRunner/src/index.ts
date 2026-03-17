/**
 * Agent Runner - Main Entry Point
 * 
 * Provides orchestration and workflow execution for LLM Toolkit.
 */

export {
  ToolRegistry,
  ToolMetadata,
  ToolCapability,
  ToolStatus,
  ToolSchema,
  defaultRegistry,
  registerDefaultTools,
} from "./registry";

export {
  AgentRunner,
  ExecutionMode,
  Workflow,
  WorkflowStep,
  WorkflowResult,
  StepResult,
  RetryPolicy,
} from "./runner";

export {
  MemoryStore,
  RunRecord,
  StepRecord,
  SessionContext,
} from "./memory";

import { defaultRegistry, registerDefaultTools, ToolRegistry } from "./registry";
import { AgentRunner } from "./runner";
import { MemoryStore } from "./memory";

/**
 * Create a fully configured agent runner instance
 */
export function createAgentRunner(options?: {
  registry?: ToolRegistry;
  memoryDbPath?: string;
  autoRegisterTools?: boolean;
  startHealthMonitor?: boolean;
  healthCheckIntervalMs?: number;
}): {
  registry: ToolRegistry;
  runner: AgentRunner;
  memory: MemoryStore;
} {
  const registry = options?.registry || defaultRegistry;

  if (options?.autoRegisterTools !== false) {
    registerDefaultTools(registry);
  }

  if (options?.startHealthMonitor) {
    registry.startHealthCheckMonitor(options.healthCheckIntervalMs);
  }

  const runner = new AgentRunner(registry);
  const memory = new MemoryStore(options?.memoryDbPath);

  return { registry, runner, memory };
}
