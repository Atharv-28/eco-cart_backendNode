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

app.post('/chatbot-getRating', async (req, res) => {
    try {
        const { query, productName, brand, material } = req.body;

        if (!query || !productName || !brand || !material) {
            return res.status(400).json({ error: 'Query, product name, brand, and material are required.' });
        }

        // Construct the query for Gemini with context
        const geminiQuery = `
            Product Name: ${productName}
            Brand: ${brand}
            Material: ${material}
            User Question: ${query}
            Respond as a helpful chatbot for an eco-friendly e-commerce platform, keeping the product details in mind.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [geminiQuery],
        });

        console.log('Response from Gemini API:', response.text);

        // Extract the chatbot's response
        const chatbotResponse = response.text.trim();

        res.status(200).json({ response: chatbotResponse });
    } catch (error) {
        console.error('Error in chatbot-getRating:', error);
        res.status(500).json({ error: 'Failed to process the chatbot query.' });
    }
});

app.post('/gemini-ecoLens', async (req, res) => {
    try {
        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required.' });
        }

        // Fetch the image from Cloudinary
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');

        // Structured prompt for better analysis
        const prompt = {
            text: `Analyze this product image and identify:
            1. Brand name (if visible)
            2. Product name (primary identification)
            3. Short description (focus on materials and environmental impact)
            
            Format your response as:
            Brand: [brand name or "unavailable"]
            Product: [product name]
            Description: [2-3 sentence description in lowercase]`
        };

        // Gemini Vision API request
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash-002", // Use latest stable version
            contents: [{
                role: "user",
                parts: [
                    { text: prompt.text },
                    {
                        inlineData: {
                            mimeType: "image/png", 
                            data: base64Image
                        }
                    }
                ]
            }]
        });
        console.log('Response from Gemini API:', response.text);
        

        // Parse the response
        const responseText = response.text;
        const parsedResponse = {
            brand: extractValue(responseText, 'Brand'),
            product: extractValue(responseText, 'Product'),
            details: extractValue(responseText, 'Description')
        };

        res.status(200).json(parsedResponse);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to analyze image' });
    }
});

function extractValue(text, field) {
    const regex = new RegExp(`${field}:\\s*(.+?)(?=\\n|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim().toLowerCase() : 'unavailable';
}

app.post('/search-product', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required.' });
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        const cx = process.env.GOOGLE_CX;

        const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent("Eco-Friendly " + query)}&key=${apiKey}&cx=${cx}`;

        const response = await axios.get(url);

        const products = response.data.items
      .slice(0, 3) // Get top 3 results
      .map(item => ({ link: item.link })); // Directly map to links

    res.status(200).json({ products });
    } catch (error) {
        console.error('Error fetching product data:', error);
        res.status(500).json({ error: 'Failed to fetch product data' });
    }
});

app.post('/upload-Img', async (req, res) => {
    try {
        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).json({ error: 'Image URL is required.' });
        }

        // Construct the query for Gemini
        const query = `
            Analyze the product in the given image: ${imageUrl}.
            Provide the product name, brand name, and categorize the product with a basic common name.
            Format: product name: ..., brand name: ..., category: ...
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [query], // Ensure contents is passed as an array
        });

        console.log('Response from Gemini API:', response.text);

        // Extract product name, brand name, and category from the response
        const responseText = response.text;
        const productMatch = responseText.match(/product name:\s*(.+?)(?=\n|$)/i); // Extract "product name: ..."
        const brandMatch = responseText.match(/brand name:\s*(.+?)(?=\n|$)/i); // Extract "brand name: ..."
        const categoryMatch = responseText.match(/category:\s*(.+?)(?=\n|$)/i); // Extract "category: ..."

        const product = productMatch ? productMatch[1].trim() : null;
        const brand = brandMatch ? brandMatch[1].trim() : null;
        const category = categoryMatch ? categoryMatch[1].trim() : null;

        res.status(200).json({ product, brand, category });
    } catch (error) {
        console.error('Error processing image with Gemini API:', error);
        res.status(500).json({ error: 'Failed to process the image with Gemini API' });
    }
});

app.post('/chatbot-general', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required.' });
        }

        // Construct the query for Gemini
        const query = `
            User Message: ${message}
            Respond as a helpful chatbot for an eco-friendly e-commerce platform.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [query],
        });

        console.log('Response from Gemini API:', response.text);

        // Extract the chatbot's response
        const chatbotResponse = response.text.trim();

        res.status(200).json({ response: chatbotResponse });
    } catch (error) {
        console.error('Error in chatbot-general:', error);
        res.status(500).json({ error: 'Failed to process the chatbot query.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});