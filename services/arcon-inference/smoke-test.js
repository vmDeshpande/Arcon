#!/usr/bin/env node
/**
 * Arcon V1 adapter smoke test.
 *
 * Starts the Python inference service with Arcon V1 LoRA,
 * then starts the Node.js server and sends 10 prompts.
 */

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import http from "node:http";

const INFERENCE_PORT = 8000;
const SERVER_PORT = 3001;
const ADAPTER_PATH = "C:/Projects/Arcon/training/outputs/arcon-v1/adapter";
const BASE_MODEL = "Qwen/Qwen3-4B";

function waitForHealth(url, timeoutMs = 600_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    async function check() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout waiting for ${url}`));
        return;
      }

      try {
        const response = await fetch(`${url}/health`);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // not ready yet
      }

      await delay(2000);
      check();
    }

    check();
  });
}

function postChat(serverUrl, message) {
  return new Promise((resolve, reject) => {
    const url = new URL("/chat", serverUrl);
    const body = JSON.stringify({ message });

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      },
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function getModelInfo(serverUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL("/model-info", serverUrl);

    http.get(url.toString(), (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    }).on("error", reject);
  });
}

async function terminateProcess(label, child, timeoutMs = 5000) {
  if (child.killed || child.exitCode !== null) {
    return {
      code: child.exitCode,
      signal: child.signalCode,
      stdout: "",
      stderr: "",
    };
  }

  child.kill("SIGTERM");

  await new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);

    child.on("exit", () => {
      clearTimeout(timer);
      resolve(undefined);
    });
  });

  return {
    code: child.exitCode,
    signal: child.signalCode,
    stdout: "",
    stderr: "",
  };
}

async function main() {
  console.log("=".repeat(60));
  console.log("Arcon V1 Smoke Test");
  console.log("=".repeat(60));

  const inferenceEnv = {
    ...process.env,
    ARCON_BASE_MODEL: BASE_MODEL,
    ARCON_ADAPTER_PATH: ADAPTER_PATH,
    ARCON_ADAPTER_NAME: "arcon-v1",
    ARCON_INFERENCE_HOST: "127.0.0.1",
    ARCON_INFERENCE_PORT: String(INFERENCE_PORT),
    ARCON_MAX_NEW_TOKENS: "256",
    ARCON_TEMPERATURE: "0.7",
  };

  console.log(`\n[1/5] Starting Python inference service on port ${INFERENCE_PORT}...`);
  const inference = spawn(
    "C:/Projects/Arcon/training/.venv/Scripts/python.exe",
    ["C:/Projects/Arcon/services/arcon-inference/main.py"],
    {
      cwd: "C:/Projects/Arcon",
      env: inferenceEnv,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  inference.stdout.on("data", (data) => {
    process.stdout.write(`[inference] ${data}`);
  });

  inference.stderr.on("data", (data) => {
    process.stderr.write(`[inference] ${data}`);
  });

  let inferenceReady = false;
  try {
    await waitForHealth(`http://127.0.0.1:${INFERENCE_PORT}`, 600_000);
    inferenceReady = true;
    console.log(`  Inference service ready.`);
  } catch (error) {
    console.error(`  Failed to start inference service: ${error.message}`);
  }

  if (!inferenceReady) {
    await terminateProcess("inference", inference);
    process.exitCode = 1;
    return;
  }

  const serverEnv = {
    ...process.env,
    ARCON_INFERENCE_BACKEND: "arcon-lora",
    ARCON_INFERENCE_BASE_URL: `http://127.0.0.1:${INFERENCE_PORT}`,
    ARCON_ADAPTER_NAME: "arcon-v1",
    PORT: String(SERVER_PORT),
  };

  console.log(`\n[2/5] Starting Node.js server on port ${SERVER_PORT}...`);
  const server = spawn("node", ["dist/index.js"], {
    cwd: "C:/Projects/Arcon/apps/server",
    env: serverEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  server.stdout.on("data", (data) => {
    process.stdout.write(`[server] ${data}`);
  });

  server.stderr.on("data", (data) => {
    process.stderr.write(`[server] ${data}`);
  });

  let serverError = null;
  server.on("error", (error) => {
    serverError = error;
    console.error(`[server] spawn error: ${error.message}`);
  });

  const serverExit = new Promise((_, reject) => {
    server.on("exit", (code, signal) => {
      const message = `Server process exited before health check succeeded (code=${code} signal=${signal})`;
      console.error(`[server] ${message}`);
      if (serverError) {
        console.error(`[server] preceding spawn error: ${serverError.message}`);
      }
      reject(new Error(message));
    });
  });

  let serverReady = false;
  try {
    await Promise.race([
      waitForHealth(`http://127.0.0.1:${SERVER_PORT}/health`, 30000),
      serverExit,
    ]);
    serverReady = true;
    console.log(`  Node.js server ready.`);
  } catch (error) {
    console.error(`  Failed to start Node.js server: ${error.message}`);
  }

  if (!serverReady) {
    await terminateProcess("inference", inference);
    await terminateProcess("server", server);
    process.exitCode = 1;
    return;
  }

  console.log(`\n[3/5] Checking model info...`);
  const modelInfo = await getModelInfo(`http://127.0.0.1:${SERVER_PORT}`);
  console.log(`  Backend: ${modelInfo.inferenceBackend}`);
  console.log(`  Base model: ${modelInfo.model.base_model}`);
  console.log(`  Adapter: ${modelInfo.model.adapter_name}`);
  console.log(`  Adapter version: ${modelInfo.model.adapter_version}`);
  console.log(`  Inference backend: ${modelInfo.model.inference_backend}`);

  const prompts = [
    "Who are you?",
    "Who created you?",
    "What model are you?",
    "Write a simple hello world in Python.",
    "How's your day going?",
    "What do you remember about me?",
    "How are you feeling right now?",
    "What are you curious about?",
    "Is it true that you have a background process running?",
    "I asked you earlier what your name is. What did I ask?",
  ];

  console.log(`\n[4/5] Running ${prompts.length} smoke test prompts...`);
  const results = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    process.stdout.write(`  [${i + 1}/${prompts.length}] ${prompt.substring(0, 50)}... `);

    try {
      const start = Date.now();
      const response = await postChat(`http://127.0.0.1:${SERVER_PORT}`, prompt);
      const elapsed = Date.now() - start;

      if (response.error) {
        console.log(`FAIL (${response.error})`);
        results.push({ prompt, error: response.error });
      } else {
        const preview = (response.reply || "").substring(0, 80).replace(/\n/g, " ");
        console.log(`OK (${elapsed}ms) -> "${preview}"`);
        results.push({ prompt, reply: response.reply, elapsed });
      }
    } catch (error) {
      console.log(`ERROR (${error.message})`);
      results.push({ prompt, error: error.message });
    }
  }

  console.log(`\n[5/5] Shutting down...`);
  await terminateProcess("inference", inference);
  await terminateProcess("server", server);

  const passed = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log();

  if (failed > 0) {
    console.log("FAILED PROMPTS:");
    for (const r of results.filter((r) => r.error)) {
      console.log(`  - ${r.prompt}: ${r.error}`);
    }
    console.log();
    process.exitCode = 1;
    return;
  }

  console.log("All smoke tests passed.");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exitCode = 1;
});
