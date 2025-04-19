import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import cors from 'cors';
dotenv.config();

const app = express();
app.use(cors());
const PORT = 3000;
app.use(express.json()); // Middleware to parse JSON request bodies

const apiKey = process.env.GEMINI_API_KEY; // Gemini API key
const ai = new GoogleGenAI({ apiKey });

app.post('/gemini-test', async (req, res) => {
    try {
        const { title, brand, material } = req.body;
        console.log('Request body:', req.body);

        /*
        if (!title || !brand || !material) {
            return res.status(400).json({ error: 'Invalid request: All fields (title, brand, material) are required.' });
        }*/

        // Construct the query
        const query = `
            Title: ${title}
            Brand: ${brand}
            Material: ${material}
            Rate between 1-5 its eco-friendly ness based on brand ethics and material and max 4 lines as direct description. in format- rating: %d/5 & review: and all letters should be lowercase.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [query], // Ensure contents is passed as an array
        });

        console.log('Response from Gemini API:', response.text);

        // Split the response into rating and description
        const responseText = response.text;
        console.log('Response text:', responseText);
        const ratingMatch = responseText.match(/rating:\s*\d\/5/i); // Extract "Rating: X/5" (case-insensitive)
        console.log('Rating match:', ratingMatch);
        const rating = ratingMatch ? ratingMatch[0] : null; // Get the rating
        const description = responseText.replace(ratingMatch, '').trim(); // Remove the rating from the text

        res.status(200).json({ rating, description });
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