# Local Integration Flow

## Overview

Arcon uses a verified local integration layer where the Qwen3-4B model invokes registered tools to augment its responses. Registered tools: `get_current_time`, `get_system_status`, `list_directory`, `read_file`, `search_files`.

The flow is:

```
user message → ChatService → cognitive processing → prompt building →
model decision → tool-call detection → input validation → tool execution →
tool result in context → model continuation → final answer
```

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  ChatService.chat(message)                           │
│                                                      │
│  1. Intent classification (classifyIntent)           │
│  2. Memory retrieval (MemoryRetriever)               │
│  3. Context selection (selectContext)                │
│  4. Prompt building (PromptBuilder)                  │
│     → includes TOOLS section from registry           │
│  5. Model call (AiClient.generateReply)             │
│  6. Tool-call detection (parseToolCall)              │
│  7. Validation (validateInput)                       │
│  8. Execution (ToolExecutor.execute)                 │
│  9. Tool result appended to messages                 │
│  10. Loop or final answer                            │
└──────────────────────────────────────────────────────┘
```

## Components

### ToolRegistry
- Stores registered `Tool` objects by name
- Provides `get(name)`, `list()`, `register()`, `unregister()`

### ToolExecutor
- Validates inputs against tool schema before execution
- Executes tool with timeout (default 5000ms) and cancellation support
- Returns structured `ToolResult` with success status, output/error, code, durationMs

### Tool-Call Parser
- Extracts JSON from markdown code blocks in model output
- Supports `tool`, `toolName`, `tool_name`, and `function_call` field names
- Case-insensitive tool name lookup
- Returns `finalReply` for non-tool responses (no throw)

### Prompt Builder
- Includes `TOOLS:` section with all registered tool descriptions and schemas
- Includes `RUNTIME IDENTITY:`, `RUNTIME CAPABILITIES:`, `RELEVANT MEMORIES:` sections
- Includes `TOOL RESULTS:` section after tool execution

## Running Tests

```bash
# All tests (includes runtime integration tests)
npm test -w @arcon/ai

# Runtime integration tests only (requires inference service running)
npx tsx --test tests/runtime-integration.test.ts

# Runtime verification tests (requires inference service running)
npx tsx --test tests/runtime-verification.test.ts

# Real runtime tests (requires inference service running, tests against live model)
npx tsx --test tests/runtime-real.test.ts

# Tool unit tests
npx tsx --test tests/tools/*.test.ts
```

## Test Types

### Unit Tests
Test individual components in isolation (tools, parser, executor, validation).

### Integration Tests
Test the full ChatService path with real tools and mocked model responses:
- Real tool call through ChatService
- Multi-step tool sequence
- Invalid arguments → structured error
- Unknown tool → NOT_FOUND
- Path traversal → PATH_DENIED
- Tool execution failure → EXECUTION_ERROR
- Final response incorporates tool result

### Runtime Verification
Tests against the live Python inference service (Qwen/Qwen3-4B + arcon-v1 LoRA):
- Provider health check
- Basic inference (generateReply)
- Model info and runtime identity
- Tool call detection with real model output
- Tool execution loop with real tools
- Path traversal blocked with real tools
- Unknown tool rejection

**Actual latencies** (RTX 3050 6GB, first inference warm):
- Health check: ~65ms
- Simple inference: ~2000-10000ms (highly variable)
- Full response (no tool): ~4500-15000ms
- Tool flow (with cognitive pipeline): ~10000-165000ms (model-dependent)
- Tool execution (e.g., get_current_time): ~20ms
- Safety validations: <1ms

Run: `npx tsx --test tests/runtime-real.test.ts`

#### Runtime Real Test Results

| Scenario | Result |
|----------|--------|
| Normal answer (no tool) | Model answers directly |
| Time request | Model answered "I don't have a clock" (no tool call — model chose direct answer) |
| Path traversal | PATH_DENIED — no stack trace exposed |
| Unknown tool | NOT_FOUND — handled gracefully |
| Tool execution | get_current_time succeeded (~20ms) |
| Live inference end-to-end | Server returns reply + toolResults structure via /chat endpoint |

## Known Limitations (Qwen3-4B)

1. **Response latency**: ~4-5 seconds for simple responses on RTX 3050 6GB (4-bit quantized). Complex prompts take longer.

2. **Tool call format sensitivity**: Qwen3-4B may not always output tool calls in the expected JSON-in-markdown format. It may:
   - Output tool calls without markdown code blocks
   - Include extra text around the tool call JSON
   - Use single quotes or trailing commas (rejected safely as final reply)

3. **Iteration limits**: Default max 5 iterations. Complex tasks requiring many tools may hit the limit.

4. **No streaming tool calls**: Tool execution happens after the streaming response completes. The generator yields final text, then tool loops run sequentially.

5. **Model warmup**: First inference after service start takes longer (model loading into VRAM).

6. **Context window**: Tool results consume context. Very long tool outputs may push the conversation toward the context limit.

