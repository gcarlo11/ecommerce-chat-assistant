import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
    ChatPromptTemplate,
    MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StateGraph, Annotation } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoClient } from "mongodb";
import { z } from "zod";
import "dotenv/config";

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3
 ) : Promise<T> {
    for ( let attempt = 1; attempt <= maxRetries; attempt++) {}
        try {
            return await fn();
        } catch (error) {
            if (error.status === 429 && attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
                console.error(`Rate limit hit. Retrying in ${delay/1000} seconds...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    throw new Error("Max retries reached");
}

// Main function that creates and runs the AI agent
export async function callAgent(client: MongoClient, query: string, thread_id: string) {
  try {
    // Database configuration
    const dbName = "inventory_database"        // Name of the MongoDB database
    const db = client.db(dbName)              // Get database instance
    const collection = db.collection("items") // Get the 'items' collection

    // Define the state structure for the agent workflow
    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        // Reducer function: how to combine old and new messages
        reducer: (x, y) => x.concat(y), // Simply concatenate old messages (x) with new messages (y)
      }),
    })

    // Create a custom tool for searching furniture inventory
    const itemLookupTool = tool(
      // The actual function that will be executed when tool is called
      async ({ query, n = 10 }) => {
        try {
          console.log("Item lookup tool called with query:", query)

          // Check if database has any data at all
          const totalCount = await collection.countDocuments()
          console.log(`Total documents in collection: ${totalCount}`)

          // Early return if database is empty
          if (totalCount === 0) {
            console.log("Collection is empty")
            return JSON.stringify({ 
              error: "No items found in inventory", 
              message: "The inventory database appears to be empty",
              count: 0 
            })
          }

          // Get sample documents for debugging purposes
          const sampleDocs = await collection.find({}).limit(3).toArray()
          console.log("Sample documents:", sampleDocs)

          // Configuration for MongoDB Atlas Vector Search
          const dbConfig = {
            collection: collection,           // MongoDB collection to search
            indexName: "vector_index",       // Name of the vector search index
            textKey: "embedding_text",       // Field containing the text used for embeddings
            embeddingKey: "embedding",       // Field containing the vector embeddings
          }

          // Create vector store instance for semantic search using Google Gemini embeddings
          const vectorStore = new MongoDBAtlasVectorSearch(
            new GoogleGenerativeAIEmbeddings({
              apiKey: process.env.GOOGLE_API_KEY, // Google API key from environment
              model: "text-embedding-004",         // Gemini embedding model
            }),
            dbConfig
          )
