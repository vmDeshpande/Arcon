import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createOllamaClient } from "@arcon/ai";

import { MemoryRepository, MemoryPipeline } from "@arcon/memory";

import { ChatService } from "@arcon/ai";

const aiClient = createOllamaClient({
  baseUrl: "http://localhost:11434",
  model: "qwen3:1.7b",
});

const rl = readline.createInterface({
  input: stdin,
  output: stdout,
});

const repository = new MemoryRepository(
  "./apps/chat/data/personal-memory.sqlite",
);

const pipeline = new MemoryPipeline(repository);

const chatService = new ChatService(repository, pipeline, aiClient);

console.log("");
console.log("================================");
console.log("Arcon CLI");
console.log("type 'exit' to quit");
console.log("================================");
console.log("");

while (true) {
  const message = await rl.question("You: ");

  if (message.toLowerCase() === "exit") {
    break;
  }

  const result = await chatService.chat(message);

  console.log("");
  console.log("");
  console.log("Arcon:");
  console.log(result.reply);
  console.log("");
  console.log("");
  console.log("-------------------------------");
  console.log("");
}

chatService.close();
repository.close();
rl.close();
