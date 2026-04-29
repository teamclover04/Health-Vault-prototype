export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        console.error("GEMINI_API_KEY environment variable is not set.");
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    const MAX_RETRIES = 2;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body)
            });
            
            const data = await response.json();
            
            // If it's a 503 (Overloaded) and we haven't exhausted retries, try again
            if (response.status === 503 && attempt < MAX_RETRIES) {
                console.warn(`Gemini API overloaded (503). Retrying attempt ${attempt + 1}...`);
                await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1))); // Simple backoff
                continue;
            }
            
            return res.status(response.status).json(data);
        } catch (error) {
            if (attempt === MAX_RETRIES) {
                console.error("Error communicating with Gemini API:", error);
                return res.status(500).json({ error: 'Failed to communicate with AI provider' });
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}


