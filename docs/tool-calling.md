# Tool Calling

## Overview

Arcon supports tool-augmented conversations where the model can decide to invoke registered tools (`get_current_time`, `get_system_status`, `list_directory`, `read_file`, `search_files`) and use their results to produce a final answer.

## How the Model Selects Tools

1. The system prompt includes a `TOOLS:` section listing every registered tool with its name, description, and JSON input schema.
2. The model processes the prompt and generates a text response.
3. If the model intends to use a tool, it outputs the call as a JSON object inside a Markdown code block:

```
Here is what I need:
```json
{"tool": "get_current_time", "arguments": {}}
```
```

4. A JSON code block without the `json` language tag is also accepted.
5. Plain JSON (no markdown code block) is also accepted as a fallback.
6. If no tool-call block is found, the response is treated as a final answer.

## Tool-Call Format

The model must output a valid JSON object with:

| Field        | Type                 | Required | Description                                   |
|--------------|----------------------|----------|-----------------------------------------------|
| `tool`       | string               | Yes      | Exact name of a registered tool               |
| `toolName`   | string               | Optional | Alternative to `tool`                         |
| `tool_name`  | string               | Optional | Alternative to `tool`                         |
| `function_call` | object            | Optional | Alternative with `name` and `arguments` fields |
| `arguments`  | object               | Yes      | Parameter object matching the tool's schema   |

Alternative field names (`toolName`, `tool_name`, `function_call`) are all accepted for `tool`. Lookup is case-insensitive.

Malformed output (invalid JSON, missing fields, wrong types, null bytes) is treated as a final answer and returned verbatim to the user.

## Execution Loop

When a `ToolExecutor` is configured on `ChatService`:

1. The user message is processed normally (intent, context, cognitive decision, prompt building).
2. The model's response is checked for a tool call.
3. If found:
   a. The tool name and arguments are validated strictly against the registered schema.
   b. Validation failures return a `VALIDATION_ERROR` result.
   c. Unknown tools return a `NOT_FOUND` result.
   d. The tool is executed via `ToolExecutor` (supports timeout, cancellation).
   e. The tool result is appended to conversation history.
   f. The loop repeats: the model sees previous results and decides again.
4. If not a tool call: the response is the final answer.
5. A configurable iteration limit (`maxToolIterations`, default 5) prevents infinite loops.
6. When the limit is reached, a safe message is returned instead of looping forever.

The full flow:

```
user message → model decision → tool execution → tool result → model continuation → final answer
```

## Safety Limits

| Limit | Default | Purpose                              |
|-------|---------|--------------------------------------|
| `maxToolIterations` | 5 | Prevents infinite tool loops           |
| `defaultTimeoutMs` (ToolExecutor) | 5000ms | Prevents hanging on slow tools |
| `iterationDelayMs` (executeToolLoop) | 0ms | Delay between tool-call iterations (prevents rapid model hammering) |
| `maxInputLength` (executeToolLoop) | 500000 chars | Truncates overly long model responses to prevent OOM |

When the iteration limit is reached, the model's response becomes the final answer and no further tool calls are made.

## Error Tracking

The `ToolLoopResult` tracks error statistics:

| Field | Description                                    |
|-------|------------------------------------------------|
| `toolErrors` | Number of tool results with `success: false` |
| `toolTimeouts` | Number of tool results with status `timeout` |

These are surfaced via runtime diagnostics for monitoring.

## Failure Handling

All failure modes produce structured `ToolResult` objects with `success: false`, a `code`, and a safe error message:

| Code              | When                                          |
|-------------------|-----------------------------------------------|
| `NOT_FOUND`       | Model requested an unregistered tool          |
| `VALIDATION_ERROR`| Model provided invalid arguments              |
| `TIMEOUT`         | Tool execution exceeded timeout               |
| `CANCELLED`       | Abort signal triggered before completion      |
| `EXECUTION_ERROR` | Tool threw an exception                       |

Error messages never expose stack traces or filesystem details.
## Streaming Behavior

`chatStream()` handles streaming and tool execution as follows:

1. If the AI client supports `generateReplyStream` (e.g., Ollama), response chunks are streamed to the caller as they arrive.
2. If streaming is not available (e.g., `ArconLoRAProvider`), the full model response is fetched non-streaming and yielded at once.
3. After the response is received, if a `ToolExecutor` is configured, `runToolLoop` executes (non-streaming, sequential).
4. The async generator does not complete until all tool calls and their results are finished.
5. Memory extraction and commit still happen after all tool processing is done.

## Registering Tools

1. Create a `Tool` object (name, description, inputSchema, execute function).
2. Register it with the `ToolRegistry` used by your `ToolExecutor`.
3. Pass the `ToolExecutor` to `ChatServiceOptions.toolExecutor`.
4. Tools are automatically discovered and described in the prompt.

Example:

```typescript
import { ToolRegistry, ToolExecutor } from "@arcon/ai";

const registry = new ToolRegistry();
registry.register({
  name: "get_greeting",
  description: "Returns a greeting message.",
  inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  async execute(input) {
    return { success: true, toolName: "get_greeting", status: "success", output: { greeting: `Hello, ${input.name}!` }, durationMs: 5 };
  },
});

const executor = new ToolExecutor(registry);
const service = new ChatService(repository, pipeline, aiClient, { toolExecutor: executor });
```

Future tools (file writing, web access, browser automation, etc.) follow the same registration pattern. They require separate approval before implementation.

## Runtime Integration Tests

The `runtime-integration.test.ts` test suite exercises the actual end-to-end path through ChatService with real local tools:

1. **One successful real tool call** - get_current_time via ChatService
2. **Multi-step tool sequence** - get_system_status → get_current_time
3. **Invalid arguments** - missing required field → VALIDATION_ERROR
4. **Unknown tool** - unregistered tool → NOT_FOUND
5. **Path traversal blocked** - file outside allowed root → PATH_DENIED
6. **Tool execution failure** - tool throws → EXECUTION_ERROR
7. **Final response uses tool result** - model incorporates result into answer

### Running runtime tests (requires inference service):

```bash
npx tsx --test tests/runtime-verification.test.ts
npx tsx --test tests/runtime-integration.test.ts
npx tsx --test tests/runtime-real.test.ts
```

## Real Runtime Verification (Live Inference)

The `runtime-verification.test.ts` and `runtime-integration.test.ts` suites verify the tool layer against the live inference service (Qwen/Qwen3-4B + arcon-v1 LoRA at `localhost:8000`). The `runtime-real.test.ts` suite tests with the real model.

### Actual Latency Measurements (RTX 3050 6GB)

| Operation | Measured Latency |
|-----------|-----------------|
| Health check | ~65ms |
| Model info | ~7ms |
| Simple inference (`generateReply`) | ~2000-10000ms (varies by prompt) |
| Full response (no tool, cognitive pipeline included) | ~4500-15000ms |
| Tool flow (model response + executeToolLoop, cognitive pipeline included) | ~10000-165000ms (model-dependent) |
| Tool execution (e.g., get_current_time) | ~20ms |
| Safety check (path traversal validation) | <1ms |
| Unknown tool rejection | <1ms |

**Note**: On RTX 3050 6GB with 4-bit quantized Qwen3-4B, inference latency is highly variable (2-165 seconds per response). Tool loop overhead is negligible compared to model inference time. The model may choose not to call tools for some prompts, returning a direct text response instead. This is expected behavior.

### Observed Behavior

When asked "What time is it?", Qwen3-4B sometimes responds with a text answer ("I don't have a clock in my current runtime") rather than calling `get_current_time`. This is a known model behavior — the model sometimes answers directly without invoking tools, even when tools are available. The system handles this gracefully by treating the text response as a final answer.

All runtime verification tests pass:

| Test | Description | Result |
|------|-------------|--------|
| Provider health | `healthCheck()` returns true | Pass |
| Model info | Base model, adapter info correct | Pass |
| Inference | `generateReply` returns non-empty | Pass |
| Normal response | No tool call for greetings | Pass |
| Path traversal | `..\\secret.txt` blocked | Pass |
| Tool execution | `get_current_time` succeeds | Pass |
| Unknown tool | `delete_file` rejected → NOT_FOUND | Pass |
| Diagnostics | Runtime stats structure valid | Pass |

## Known Limitations (Qwen3-4B)

1. **Response latency**: ~4-165 seconds for responses on RTX 3050 6GB (4-bit quantized). Highly variable depending on prompt complexity and model generation length.
2. **Tool call format sensitivity**: Qwen3-4B may not always output tool calls in the expected JSON-in-markdown format. It may:
   - Answer directly without calling tools (e.g., "I don't have a clock" instead of calling get_current_time)
   - Output tool calls without markdown code blocks
   - Include extra text around the tool call JSON
3. **Tool choice**: The model decides whether to call tools based on its own judgment. Direct answers may be preferred for some questions.
4. **Iteration limit**: Default max 5 iterations. Complex tasks requiring many tools may hit the limit.
5. **No streaming tool calls**: Tool execution happens after the streaming response completes.
6. **Model warmup**: First inference after service start takes longer (model loading into VRAM).
7. **Context window**: Tool results consume context. Very long tool outputs may push the conversation toward the context limit.
