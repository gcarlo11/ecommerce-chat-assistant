import 'dotenv/config' //otomatis membaca variabel dari file .env
import express, { Express, Request, Response } from "express" //framework untuk bikin server HTTP
import { MongoClient } from "mongodb" //library resmi untuk connect MongoDB
import { callAgent } from './agent' // function custom (dibuat difile ./agent) yang nantinya akan menjadi inti logika Chatbot

const app: Express = express() 
import cors from 'cors' //middleware biar server bisa diakses dari domain/frontend lain
app.use(cors())
app.use(express.json()) //parsing request body JSON biar gampang dipakai

//Koneksi MongoDB
const client = new MongoClient(process.env.MONGODB_ATLAS_URL as string) //membuat koneksi ke MongoDB Atlas dengan URL dari .env
async function startServer() {
    try {
        await client.connect() //menyambungkan ke db
        await client.db("admin").command({ping: 1})   // testing akses ke db

        //API endpoints
        app.get('/', (req: Request, res: Response) => { //checking server jalan or no
            res.send('LangGraph Agent Server')
        })

        ///API endpoint memulai chat baru
        app.post('/chat', async (req: Request, res: Response) => {
            const initialMessage = req.body.message
            const threadId = Date.now().toString() //membuat threadID berdasarkan timestamp
            console.log(initialMessage)
            try {
                const response = await callAgent(client, initialMessage, threadId)
                res.json({ threadId, response})
            } catch (error) {
                console.error('Error starting conversation: ', error)
                res.status(500).json({ error: 'Internal server error'})
            }
        }) // berfungsi ketika user mau memulai session baru, server bikin ID khusus untuk session itu

        //Endpoint melanjutkan chat lama
        app.post('/chat/:threadId', async (req: Request, res: Response) => {
            const {  threadId } = req.params
            const { message } = req.body
            try{
                const response= await callAgent(client, message, threadId)
                res.json({ response })
            } catch (error) {
                console.error(error)
                res.status(500).json({ error: 'Internal server error'})
            }
        })

        const PORT = process.env.PORT || 8000
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`)
        })

    } catch (error){
        console.error('Error connecting to MongoDB:', error)
        process.exit(1)
    }
}

startServer()