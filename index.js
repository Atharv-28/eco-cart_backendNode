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

app.post('/gemini-getRating', async (req, res) => {
    try {
        const { title, brand, material } = req.body;
        console.log('Request body:', req.body);

        // Construct the query
        const query = `
            Title: ${title}
            Brand: ${brand}
            Material: ${material}
            Rate between 1-5 its eco-friendliness based on brand ethics and material, and categorize the product based on it's basic common name. Format: rating: %d/5, review: ..., category: ... review should be max 2 statements.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [query], // Ensure contents is passed as an array
        });

        console.log('Response from Gemini API:', response.text);

        // Extract rating, description, and category from the response
        const responseText = response.text;
        const ratingMatch = responseText.match(/rating:\s*(\d)\/5/i); // Extract "Rating: X/5"
        const categoryMatch = responseText.match(/category:\s*(.+?)(?=\n|$)/i); // Extract "Category: ..."
        const description = responseText.replace(/rating:\s*\d\/5/i, '').replace(/category:\s*.+/i, '').trim(); // Remove rating and category from the text

        const rating = ratingMatch ? ratingMatch[1] : null;
        const category = categoryMatch ? categoryMatch[1].trim() : null; // Ensure only the first match is used

        // Map the category to an ID (you can expand this mapping as needed)
        
        res.status(200).json({ rating, description, category });
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ error: 'Failed to call Gemini API' });
    }
});

app.post('/gemini-ecoLens', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required.' });
        }

        // Construct the query for Gemini
        const query = `
            Analyze the product details from the given URL: ${url}.
            Provide the brand name, product name, and a short description of the product in lowercase.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [query], // Ensure contents is passed as an array
        });

        console.log('Response from Gemini API:', response.text);

        // Extract brand name, product name, and description from the response
        const responseText = response.text;
        const brandMatch = responseText.match(/brand name:\s*(.+?)(?=\n|$)/i); // Extract "brand: ..."
        const productMatch = responseText.match(/product name:\s*(.+?)(?=\n|$)/i); // Extract "product: ..."
        const detailsMatch = responseText.match(/description:\s*(.+?)(?=\n|$)/i); // Extract "details: ..."

        const brand = brandMatch ? brandMatch[1].trim() : null;
        const product = productMatch ? productMatch[1].trim() : null;
        const details = detailsMatch ? detailsMatch[1].trim() : null;

        console.log('Brand:', brand);

        res.status(200).json({ brand, product, details });
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ error: 'Failed to process the URL with Gemini API' });
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