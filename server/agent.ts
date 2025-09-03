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

export async function callAgent(client: MongoClient, query: string, thread_id:string) {
    try {
        const dbName = "inventory_database";
        const db = client.db(dbName);
        const collection = db.collection("items");

        const GraphState = Annotation.Root({
            messages: Annotation<BaseMessage[]>({
                reducer: (x, y) => [...x, y
            })
        })
    }
}