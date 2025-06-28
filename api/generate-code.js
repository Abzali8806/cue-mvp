// Vercel Serverless Function - No External Dependencies
import https from 'https';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { description } = req.body;

        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }

        // OpenAI API call using built-in https module
        const openaiData = await callOpenAI(description);
        
        if (!openaiData || !openaiData.choices || !openaiData.choices[0]) {
            return res.status(500).json({ 
                error: 'No content generated',
                details: 'OpenAI returned empty response'
            });
        }

        const generatedContent = openaiData.choices[0].message.content;

        // Parse the JSON response from OpenAI
        let parsedResponse;
        try {
            // Extract JSON from the response (in case it's wrapped in markdown)
            const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : generatedContent;
            parsedResponse = JSON.parse(jsonString);
        } catch (parseError) {
            console.error('Failed to parse OpenAI response:', parseError);
            // Fallback: create a basic response
            parsedResponse = {
                workflowType: "custom",
                code: generatedContent,
                placeholders: [],
                description: "Generated workflow function",
                deploymentInstructions: "Deploy as a serverless function"
            };
        }

        // Ensure all required fields exist
        const response = {
            success: true,
            workflowType: parsedResponse.workflowType || "custom",
            code: parsedResponse.code || generatedContent,
            placeholders: parsedResponse.placeholders || [],
            description: parsedResponse.description || "Generated workflow function",
            deploymentInstructions: parsedResponse.deploymentInstructions || "Deploy as a serverless function",
            timestamp: new Date().toISOString()
        };

        res.status(200).json(response);

    } catch (error) {
        console.error('Error generating code:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
}

// OpenAI API call using built-in https module
function callOpenAI(description) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert workflow automation engineer. Generate production-ready serverless function code based on user descriptions.

CRITICAL REQUIREMENTS:
1. ALWAYS generate Python code suitable for serverless deployment
2. Use proper function structure with handler(event, context)
3. Include comprehensive error handling and logging
4. Add placeholder values for API keys and secrets (use {{PLACEHOLDER_NAME}} format)
5. Include proper imports and dependencies
6. Add detailed comments explaining the workflow
7. Ensure code is secure and follows best practices
8. Maximum 50 lines of core logic (excluding imports and comments)

WORKFLOW TYPES TO DETECT:
- Webhook Handler: Responds to HTTP requests/form submissions
- Scheduled Task: Runs on a schedule (cron-like)
- Event Processor: Processes events from queues/streams
- Notification System: Sends alerts via email/SMS/Slack
- Data Integration: Connects different services/APIs

RESPONSE FORMAT:
{
  "workflowType": "detected_type",
  "code": "complete_python_code",
  "placeholders": ["list", "of", "placeholder", "keys"],
  "description": "brief_explanation",
  "deploymentInstructions": "platform_agnostic_instructions"
}`
                },
                {
                    role: 'user',
                    content: `Generate a serverless function for this workflow: "${description}"`
                }
            ],
            max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000,
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.2,
        });

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve(jsonData);
                    } else {
                        reject(new Error(`OpenAI API error: ${res.statusCode} - ${data}`));
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse OpenAI response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Request error: ${error.message}`));
        });

        req.write(postData);
        req.end();
    });
}

