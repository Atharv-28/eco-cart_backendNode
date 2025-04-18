import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
dotenv.config();

const app = express();
const PORT = 3000;
app.use(express.json()); // Middleware to parse JSON request bodies

const apiKey = process.env.GEMINI_API_KEY; // Gemini API key
const ai = new GoogleGenAI({ apiKey });

app.post('/gemini-test', async (req, res) => {
    try {
        const { title, brand, features, material } = req.body;
        console.log('Request body:', req.body);

        if (!title || !brand || !features || !material) {
            return res.status(400).json({ error: 'Invalid request: All fields (title, brand, features, material) are required.' });
        }

        // Construct the query
        const query = `
            Title: ${title}
            Brand: ${brand}
            Features: ${features}
            Material: ${material}
            Rate between 1-5 its eco-friendly ness based on brand ethics and material.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [query], // Ensure contents is passed as an array
        });

        console.log('Response from Gemini API:', response.text);


        console.log('Response DATA from Gemini API:', response.data);

        res.status(200).json({ response: response.text });
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ error: 'Failed to call Gemini API' });
    }
});

app.post('/search-product', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required.' });
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        const cx = process.env.GOOGLE_CX;

        const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${cx}`;

        const response = await axios.get(url);

        const products = response.data.items.map(item => ({
            title: item.title,
            link: item.link,
            thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src || null,
        }));

        res.status(200).json({ products });
    } catch (error) {
        console.error('Error fetching product data:', error);
        res.status(500).json({ error: 'Failed to fetch product data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});