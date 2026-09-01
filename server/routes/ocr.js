const express = require('express');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const router = express.Router();

// ─── Multer Setup ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
    filename: (req, file, cb) => cb(null, `bill_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/jpeg|jpg|png|gif|bmp|webp/.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
        else cb(new Error('Only image files allowed (JPG, PNG, BMP, GIF, WEBP)'));
    }
});

// ─── AI Models List (Fallback strategy) ──────────────────────────────────────
const MODELS = [
    "openai/gpt-4o-mini",                            // Extremely cost-effective, high accuracy vision
    "google/gemini-1.5-flash",                       // Very cheap, fast, great OCR capabilities
    "google/gemini-2.0-flash-001",                   // Fast, high-quality vision (if available)
    "meta-llama/llama-3.2-11b-vision-instruct",      // Reliable open-weights vision
    "anthropic/claude-3-haiku"                       // Fast fallback
];

// ─── AI Extraction with OpenRouter Retries ───────────────────────────────────
async function extractWithAI(base64Image) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey.includes('your_openrouter_api_key')) {
        throw new Error('OPENROUTER_API_KEY is not set. Please get a key from https://openrouter.ai/keys and add it to your .env file.');
    }

    let lastError = null;

    // Try multiple models in case of rate limits or failures
    for (const model of MODELS) {
        try {
            console.log(`[AI OCR] Attempting extraction with model: ${model}`);
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": process.env.APP_URL || "https://ledgera.app",
                    "X-Title": "Ledgera-FinanceAI",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": model,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": `Extract all data from this receipt into a precise JSON object. 
                                    Guidelines:
                                    1. Identify 'storeName', 'billDate' (YYYY-MM-DD), 'totalAmount' (the final cash/card amount paid), and 'discountAmount' (total savings/deductions shown on the bill).
                                    2. CRITICAL: If the bill shows separate 'net total' and 'discount', ensure 'totalAmount' is the final amount AFTER the discount.
                                    3. Extract 'items' array with: 'name', 'quantity', 'unitPrice' (price per single unit), 'totalPrice' (line total), 'category', and 'subcategory'.
                                    4. For 'subcategory', provide a more specific classification (e.g., if category is 'dairy', subcategory could be 'milk', 'cheese', or 'yogurt').
                                    5. For 'category', prefer these standard ones if they fit: [food_and_drink, housing, vehicle, communication_and_pc, vegetables, fruits, dairy, meat, household, snacks, beverages, personal_care].
                                    5. IMPORTANT: If an item belongs to a specific category NOT listed above (e.g., 'electronics', 'clothing', 'pharmacy', 'luxury', 'education'), you MUST provide that new category name.
                                    6. If an item has a specific brand name, include it in the 'name'.
                                    7. Return ONLY the JSON object.`
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`
                                    }
                                }
                            ]
                        }
                    ],
                    "response_format": { "type": "json_object" },
                    "temperature": 0.1
                })
            });

            const data = await response.json();

            if (data.error) {
                console.warn(`[AI OCR] Model ${model} failed:`, data.error.message);
                lastError = data.error.message;
                continue; // Try next model
            }

            const content = data.choices[0].message.content;
            const parsed = JSON.parse(content);

            // Basic validation of AI output
            if (!parsed.items || !Array.isArray(parsed.items)) {
                console.warn(`[AI OCR] Model ${model} returned invalid structure`);
                continue;
            }

            return { ...parsed, model_used: model };
        } catch (err) {
            console.error(`[AI OCR] Error using model ${model}:`, err.message);
            lastError = err.message;
            continue;
        }
    }

    throw new Error(`AI Extraction failed after trying multiple models. Last error: ${lastError}`);
}

// ─── POST /scan (multipart) ──────────────────────────────────────────────────
router.post('/scan', auth, upload.single('billImage'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image file provided' });

        const fs = require('fs');
        const buffer = fs.readFileSync(req.file.path);
        const base64 = buffer.toString('base64');
        const mime = req.file.mimetype;
        const dataUrl = `data:${mime};base64,${base64}`;

        const result = await extractWithAI(dataUrl);

        res.json({
            ...result,
            strategy: `AI-Powered (${result.model_used})`,
            imageUrl: `/uploads/${req.file.filename}`
        });
    } catch (err) {
        console.error('[OCR /scan]', err.message);
        res.status(500).json({
            error: 'AI Scan Failed',
            detail: err.message,
            suggestion: 'Make sure your OPENROUTER_API_KEY is correctly set in .env'
        });
    }
});

// ─── POST /scan-base64 ───────────────────────────────────────────────────────
router.post('/scan-base64', auth, async (req, res) => {
    try {
        const { imageData } = req.body;
        if (!imageData) return res.status(400).json({ error: 'No image data provided' });

        const result = await extractWithAI(imageData);

        res.json({
            ...result,
            strategy: `AI-Powered (${result.model_used})`,
            itemsFound: result.items?.length || 0,
            message: `✅ Extracted by ${result.model_used}`
        });
    } catch (err) {
        console.error('[OCR /scan-base64]', err.message);
        res.status(500).json({
            error: 'AI Scan Failed',
            detail: err.message,
            suggestion: 'Go to https://openrouter.ai/keys to get an API key.'
        });
    }
});

module.exports = router;
