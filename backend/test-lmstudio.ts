// test-lm-studio.ts
import { ChatOpenAI } from "@langchain/openai";

const testModel = new ChatOpenAI({
  model: "http://127.0.0.1:1234",
  apiKey: "lm-studio",
  configuration: {
    baseURL: "http://localhost:1234/v1",
  }
});

async function testConnection() {
  try {
    const response = await testModel.invoke("Coucou, est-ce que tu es connecté ?");
    console.log("✅ LM Studio connection successful:", response.content);
  } catch (error) {
    console.error("❌ LM Studio connection failed:", error.message);
  }
}

testConnection();