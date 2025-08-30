import { ChatGoogleGenerativeAI, 
    GoogleGenerativeAIEmbeddings } from "@langchain/google-genai"

import { StructuredOutputParser } from "@langchain/core/output_parsers" //to ensure AI returens data in the specific format
import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb" 
import { z } from "zod"; //for schema validation
import  "dotenv/config" //to read .env file

const client = new MongoClient(process.env.MONGODB_ATLAS_URL as string) //connect to MongoDB Atlas

const llm = new ChatGoogleGenerativeAI({ //initialize the LLM
    model: "gemini-1.5-flash", //model name
    temperature: 0.7, //creativity level
    apiKey: process.env.GOOGLE_API_KEY //API key from .env
})

const itemsSchema = z.object({ //defining the schema for the data we want from AI
    item_id: z.string(),
    item_name: z.string(),
    item_description: z.string(), 
    brand: z.string(),
    manufacturer_address: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        postal_code: z.string(),
        country: z.string(),
    }),
    prices: z.object({
        full_price: z.number(),
        sale_price: z.number(),
    }),
    categories: z.array(z.string()),
    user_reviews: z.array(
        z.object({
            review_date: z.string(),
            rating: z.number(),
            comment: z.string(),
        })
    ),
    notes: z.string(),  
})

type Item = z.infer<typeof itemsSchema> //TypeScript type for the schema

const parser = StructuredOutputParser.fromZodSchema(z.array(itemsSchema)) //create a parser using the schema

async function setupDatabaseAndCollection(): Promise<void> {
    console.log("Setting up database and collection...")
        const db = client.db("inventory_database")
        const collections = await db.listCollections({ name: "items" }).toArray()

        if (collections.length === 0) {
            await db.createCollection("items")
            console.log("Created 'items' collection ini 'inventory_database' database/")
        } else {
            console.log("'items' collection already exists in 'inventory_database' database.")  
        }  
}

async function createVectorSearchIndex(): Promise<void> {
    try{
        const db = client.db("inventory_database")
        const collection = db.collection("items")
        await collection.dropIndexes() //remove existing indexes to avoid conflicts
        const vectorSearchIdx= {
            name: "vector_index",
            type: "vectorSearch",
            definition: {
                "fields": [
                    {
                        "type": "vector",
                        "path": "embedding",
                        "numDimensions": 768,
                        "similarity": "cosine"
                    }
                ]
            }
        }
        console.log("Creating vector search index...")
        await collection.createSearchIndex(vectorSearchIdx);
        console.log("Vector search index created successfully.")
        
    } catch (error) {
        console.error("Error creating vector search index:", error) 
    }

}