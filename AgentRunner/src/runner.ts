/**
 * Agent Runner - Orchestrates multi-step workflows with retry and fallback logic
 */

import {
  ErrorCode,
  OperationTimer,
  generateTraceId,
} from "@shared/types";
import { ToolRegistry, ToolStatus } from "./registry";
import { Logger, getLogger } from "../../Observability/src/logger";
import { MetricsRegistry, getRegistry } from "../../Observability/src/metrics";
import { Tracer, getTracer, SpanStatus } from "../../Observability/src/tracer";

/**
 * Execution mode for workflow steps
 */
export enum ExecutionMode {
  /** Execute steps one after another */
  SEQUENTIAL = "sequential",
  /** Execute all steps concurrently */
  PARALLEL = "parallel",
}

/**
 * Step retry policy
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  retryDelayMs: number;
  /** Exponential backoff multiplier (default: 1 = linear) */
  backoffMultiplier?: number;
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  /** Unique step identifier */
  id: string;
  /** Tool ID to invoke */
  toolId: string;
  /** Tool endpoint path (e.g., "/tools/run_terminal_command") */
  endpoint: string;
  /** Input parameters for the tool */
  input: Record<string, any>;
  /** Step timeout in milliseconds */
  timeoutMs?: number;
  /** Retry policy for this step */
  retryPolicy?: RetryPolicy;
  /** Dependencies - step IDs that must complete before this step */
  dependsOn?: string[];
}

/**
 * Workflow definition
 */
export interface Workflow {
  /** Workflow identifier */
  id: string;
  /** Workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** Execution mode */
  mode: ExecutionMode;
  /** Workflow steps */
  steps: WorkflowStep[];
  /** Global timeout for entire workflow */
  timeoutMs?: number;
}

/**
 * Step execution result
 */
export interface StepResult {
  /** Step ID */
  stepId: string;
  /** Tool ID used */
  toolId: string;
  /** Execution success status */
  success: boolean;
  /** Error code if failed */
  errorCode?: ErrorCode;
  /** Error message if failed */
  errorMessage?: string;
  /** Result data */
  data?: any;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Number of retry attempts made */
  retries: number;
  /** Trace ID for this step */
  traceId: string;
  /** Timestamp when step started */
  startedAt: Date;
  /** Timestamp when step completed */
  completedAt: Date;
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  /** Workflow ID */
  workflowId: string;
  /** Overall success status */
  success: boolean;
  /** Step results */
  steps: StepResult[];
  /** Total execution duration */
  durationMs: number;
  /** Trace ID for the workflow run */
  traceId: string;
  /** Timestamp when workflow started */
  startedAt: Date;
  /** Timestamp when workflow completed */
  completedAt: Date;
  /** Error summary if workflow failed */
  error?: string;
}

/**
 * Agent Runner - Executes workflows with retry and fallback logic
 */
export class AgentRunner {
  private registry: ToolRegistry;
  private activeWorkflows: Map<string, AbortController> = new Map();
  private logger: Logger;
  private metrics: MetricsRegistry;
  private tracer: Tracer;
  private executionCounter;
  private durationHistogram;
  private stepCounter;
  private stepDurationHistogram;

  constructor(registry: ToolRegistry, logger?: Logger, metrics?: MetricsRegistry, tracer?: Tracer) {
    this.registry = registry;
    this.logger = logger || getLogger();
    this.metrics = metrics || getRegistry();
    this.tracer = tracer || getTracer();
    
    // Register metrics
    this.executionCounter = this.metrics.counter("workflow_executions_total", "Total workflow executions");
    this.durationHistogram = this.metrics.histogram("workflow_duration_ms", "Workflow execution duration");
    this.stepCounter = this.metrics.counter("workflow_step_executions_total", "Total workflow step executions");
    this.stepDurationHistogram = this.metrics.histogram("workflow_step_duration_ms", "Workflow step execution duration");
  }

  /**
   * Execute a single step with retry logic
   */
  private async executeStepWithRetry(
    step: WorkflowStep,
    retryPolicy?: RetryPolicy,
    workflowTraceId?: string
  ): Promise<StepResult> {
    const traceId = workflowTraceId || generateTraceId();
    const startedAt = new Date();
    const timer = new OperationTimer();

    // Create child logger for this step
    const stepLogger = this.logger.child(`step-${step.id}`, traceId);

    // Start span for this step
    const spanId = workflowTraceId ? this.tracer.startSpan(workflowTraceId, `step-${step.id}`, {
      toolId: step.toolId,
      endpoint: step.endpoint
    }) : undefined;

    stepLogger.debug(`Executing step ${step.id}`, { toolId: step.toolId, endpoint: step.endpoint });

    const tool = this.registry.getTool(step.toolId);
    if (!tool) {
      const errorMsg = `Tool ${step.toolId} not found in registry`;
      stepLogger.error(errorMsg, { stepId: step.id });
      if (spanId) this.tracer.endSpan(spanId, SpanStatus.ERROR, { error: errorMsg });
      this.stepCounter.inc({ toolId: step.toolId, status: "error", errorCode: ErrorCode.NOT_FOUND });
      
      return {
        stepId: step.id,
        toolId: step.toolId,
        success: false,
        errorCode: ErrorCode.NOT_FOUND,
        errorMessage: errorMsg,
        durationMs: timer.elapsed(),
        retries: 0,
        traceId,
        startedAt,
        completedAt: new Date(),
      };
    }

    if (tool.status === ToolStatus.UNHEALTHY) {
      const errorMsg = `Tool ${step.toolId} is unhealthy: ${tool.healthError}`;
      stepLogger.warn(errorMsg, { stepId: step.id });
      if (spanId) this.tracer.endSpan(spanId, SpanStatus.ERROR, { error: errorMsg });
      this.stepCounter.inc({ toolId: step.toolId, status: "unhealthy" });
      
      return {
        stepId: step.id,
        toolId: step.toolId,
        success: false,
        errorCode: ErrorCode.EXECUTION_FAILED,
        errorMessage: `Tool ${step.toolId} is unhealthy: ${tool.healthError}`,
        durationMs: timer.elapsed(),
        retries: 0,
        traceId,
        startedAt,
        completedAt: new Date(),
      };
    }

    const policy = retryPolicy || step.retryPolicy || { maxRetries: 0, retryDelayMs: 1000 };
    let lastError: Error | null = null;
    let retries = 0;

    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      if (attempt > 0) {
        retries++;
        const delay =
          policy.retryDelayMs * Math.pow(policy.backoffMultiplier || 1, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        const url = `${tool.httpEndpoint}${step.endpoint}`;
        const timeoutMs = step.timeoutMs || 30000;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(step.input),
          signal: AbortSignal.timeout(timeoutMs),
        });

        const data = await response.json() as { success?: boolean; ok?: boolean; errorMessage?: string; error?: string };

        // Check if response indicates success
        const isSuccess = response.ok && (data.success === true || data.ok === true);

        if (isSuccess) {
          const duration = timer.elapsed();
          stepLogger.info(`Step ${step.id} completed successfully`, { 
            toolId: step.toolId, 
            durationMs: duration, 
            retries 
          });
          if (spanId) this.tracer.endSpan(spanId, SpanStatus.SUCCESS, { durationMs: duration });
          this.stepCounter.inc({ toolId: step.toolId, status: "success" });
          this.stepDurationHistogram.observe(duration);
          
          return {
            stepId: step.id,
            toolId: step.toolId,
            success: true,
            data,
            durationMs: timer.elapsed(),
            retries,
            traceId,
            startedAt,
            completedAt: new Date(),
          };
        }

        // Non-successful response - may retry on next iteration
        lastError = new Error(
          data.errorMessage || data.error || `HTTP ${response.status}`
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    // All retries exhausted
    const duration = timer.elapsed();
    const errorMsg = lastError?.message || "Step execution failed";
    stepLogger.error(`Step ${step.id} failed after ${retries} retries`, {
      toolId: step.toolId,
      error: errorMsg,
      durationMs: duration
    });
    if (spanId) this.tracer.endSpan(spanId, SpanStatus.ERROR, { error: errorMsg, retries });
    this.stepCounter.inc({ toolId: step.toolId, status: "error" });
    this.stepDurationHistogram.observe(duration);
    
    return {
      stepId: step.id,
      toolId: step.toolId,
      success: false,
      errorCode: ErrorCode.EXECUTION_FAILED,
      errorMessage: lastError?.message || "Unknown error",
      durationMs: timer.elapsed(),
      retries,
      traceId,
      startedAt,
      completedAt: new Date(),
    };
  }

  /**
   * Execute workout steps sequentially
   */
  private async executeSequential(
    workflow: Workflow,
    abortSignal?: AbortSignal,
    workflowTraceId?: string
  ): Promise<StepResult[]> {
    const results: StepResult[] = [];
    const completedSteps = new Set<string>();
    const stepOutputs = new Map<string, any>(); // Store step outputs for dependencies

    for (const step of workflow.steps) {
      if (abortSignal?.aborted) {
        break;
      }

      // Check dependencies
      const missingDeps = step.dependsOn?.filter((dep) => !completedSteps.has(dep)) || [];
      if (missingDeps.length > 0) {
        results.push({
          stepId: step.id,
          toolId: step.toolId,
          success: false,
          errorCode: ErrorCode.EXECUTION_FAILED,
          errorMessage: `Missing dependencies: ${missingDeps.join(", ")}`,
          durationMs: 0,
          retries: 0,
          traceId: generateTraceId(),
          startedAt: new Date(),
          completedAt: new Date(),
        });
        continue;
      }

      // Merge dependency outputs into step input
      const stepInput = { ...step.input };
      if (step.dependsOn && step.dependsOn.length > 0) {
        for (const depId of step.dependsOn) {
          const depOutput = stepOutputs.get(depId);
          if (depOutput) {
            // Merge dependency output data into input
            Object.assign(stepInput, depOutput);
          }
        }
      }

      // Execute step with merged input
      const stepWithInput = { ...step, input: stepInput };
      const result = await this.executeStepWithRetry(stepWithInput, undefined, workflowTraceId);
      results.push(result);

      if (result.success) {
        completedSteps.add(step.id);
        // Store output data for dependent steps
        // Unwrap the response envelope if it has a nested 'data' property
        if (result.data) {
          const outputData = result.data.data !== undefined ? result.data.data : result.data;
          stepOutputs.set(step.id, outputData);
        }
      } else {
        // Stop on first failure in sequential mode
        break;
      }
    }

    return results;
  }

  /**
   * Execute workflow steps in parallel
   */
  private async executeParallel(
    workflow: Workflow,
    abortSignal?: AbortSignal,
    workflowTraceId?: string
  ): Promise<StepResult[]> {
    const stepPromises = workflow.steps.map((step) => {
      if (abortSignal?.aborted) {
        return Promise.resolve({
          stepId: step.id,
          toolId: step.toolId,
          success: false,
          errorCode: ErrorCode.EXECUTION_FAILED,
          errorMessage: "Workflow aborted",
          durationMs: 0,
          retries: 0,
          traceId: generateTraceId(),
          startedAt: new Date(),
          completedAt: new Date(),
        });
      }

      return this.executeStepWithRetry(step, undefined, workflowTraceId);
    });

    return await Promise.all(stepPromises);
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflow: Workflow): Promise<WorkflowResult> {
    const traceId = this.tracer.startTrace(workflow.id, workflow.name, {
      mode: workflow.mode,
      stepCount: workflow.steps.length
    });
    const startedAt = new Date();
    const timer = new OperationTimer();

    // Create child logger for this workflow
    const workflowLogger = this.logger.child(`workflow-${workflow.id}`, traceId);

    workflowLogger.info(`Starting workflow ${workflow.id}`, {
      name: workflow.name,
      mode: workflow.mode,
      stepCount: workflow.steps.length
    });

    const abortController = new AbortController();
    this.activeWorkflows.set(workflow.id, abortController);

    let timedOut = false;

    try {
      // Set global workflow timeout if specified
      let timeoutHandle: NodeJS.Timeout | undefined;
      if (workflow.timeoutMs) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          abortController.abort();
        }, workflow.timeoutMs);
      }

      // Listen for cancellation (signal will handle abortion)
      // If already aborted, execution below will handle it

      const results =
        workflow.mode === ExecutionMode.PARALLEL
          ? await this.executeParallel(workflow, abortController.signal, traceId)
          : await this.executeSequential(workflow, abortController.signal, traceId);

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      // Check if workflow was aborted
      if (abortController.signal.aborted) {
        const error = timedOut
          ? `Workflow timed out after ${workflow.timeoutMs}ms`
          : "Workflow was cancelled";
        
        const duration = timer.elapsed();
        workflowLogger.warn(`Workflow ${workflow.id} aborted`, { error, durationMs: duration });
        this.tracer.endTrace(traceId, SpanStatus.CANCELLED);
        this.executionCounter.inc({ workflowId: workflow.id, status: "aborted" });
        this.durationHistogram.observe(duration);
        
        return {
          workflowId: workflow.id,
          success: false,
          steps: results,
          durationMs: timer.elapsed(),
          traceId,
          startedAt,
          completedAt: new Date(),
          error,
        };
      }

      const success = results.every((r) => r.success);
      const error = success
        ? undefined
        : `Workflow failed: ${results.filter((r) => !r.success).length} of ${results.length} steps failed`;

      const duration = timer.elapsed();
      
      if (success) {
        workflowLogger.info(`Workflow ${workflow.id} completed successfully`, {
          durationMs: duration,
          stepCount: results.length
        });
        this.tracer.endTrace(traceId, SpanStatus.SUCCESS);
        this.executionCounter.inc({ workflowId: workflow.id, status: "success" });
      } else {
        workflowLogger.error(`Workflow ${workflow.id} failed`, {
          error,
          durationMs: duration,
          failedSteps: results.filter((r) => !r.success).length
        });
        this.tracer.endTrace(traceId, SpanStatus.ERROR);
        this.executionCounter.inc({ workflowId: workflow.id, status: "error" });
      }
      
      this.durationHistogram.observe(duration);

      return {
        workflowId: workflow.id,
        success,
        steps: results,
        durationMs: timer.elapsed(),
        traceId,
        startedAt,
        completedAt: new Date(),
        error,
      };
    } finally {
      this.activeWorkflows.delete(workflow.id);
    }
  }

  /**
   * Cancel a running workflow
   */
  cancelWorkflow(workflowId: string): boolean {
    const controller = this.activeWorkflows.get(workflowId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  /**
   * Get running workflow IDs
   */
  getRunningWorkflows(): string[] {
    return Array.from(this.activeWorkflows.keys());
  }
}
