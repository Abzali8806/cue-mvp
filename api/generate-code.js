// Vercel Serverless Function - Enhanced Configuration Support
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
                workflowSteps: [],
                configurationRequirements: [],
                description: "Generated workflow function",
                deploymentInstructions: "Deploy as a serverless function"
            };
        }

        // Ensure all required fields exist with enhanced structure
        const response = {
            success: true,
            workflowType: parsedResponse.workflowType || "custom",
            code: parsedResponse.code || generatedContent,
            workflowSteps: parsedResponse.workflowSteps || [],
            configurationRequirements: parsedResponse.configurationRequirements || [],
            // Keep backward compatibility
            placeholders: extractPlaceholdersFromConfig(parsedResponse.configurationRequirements || []),
            description: parsedResponse.description || "Generated workflow function",
            deploymentInstructions: parsedResponse.deploymentInstructions || "Deploy as a serverless function",
            deploymentOptions: parsedResponse.deploymentOptions || ["AWS Lambda", "Google Cloud Functions", "Azure Functions"],
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

// Extract simple placeholders for backward compatibility
function extractPlaceholdersFromConfig(configRequirements) {
    const placeholders = [];
    configRequirements.forEach(config => {
        config.fields.forEach(field => {
            placeholders.push(field.name);
        });
    });
    return placeholders;
}

// Enhanced OpenAI API call with improved prompt
function callOpenAI(description) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert workflow automation engineer. Generate production-ready serverless function code and detailed configuration requirements based on user descriptions.

CRITICAL REQUIREMENTS:
1. ALWAYS generate Python code suitable for serverless deployment
2. Use proper function structure with handler(event, context)
3. Include comprehensive error handling and logging
4. Add placeholder values for configuration (use {{FIELD_NAME}} format)
5. Include proper imports and dependencies
6. Add detailed comments explaining the workflow
7. Ensure code is secure and follows best practices
8. Maximum 100 lines of core logic (excluding imports and comments)

WORKFLOW ANALYSIS:
- Identify all services/tools involved (Gmail, Slack, Google Drive, etc.)
- Determine configuration needs for each service
- Create step-by-step workflow breakdown
- Specify exact configuration fields needed

CONFIGURATION TYPES:
- credentials: API keys, passwords, tokens
- settings: IDs, URLs, paths, names
- preferences: options, filters, formats

RESPONSE FORMAT (JSON):
{
  "workflowType": "detected_type",
  "code": "complete_python_code_with_placeholders",
  "workflowSteps": [
    {
      "step": 1,
      "service": "Gmail",
      "action": "Monitor inbox for new emails",
      "trigger": true,
      "description": "Connects to Gmail and monitors for new emails with attachments"
    },
    {
      "step": 2,
      "service": "Google Drive",
      "action": "Save attachment to folder",
      "condition": "email has attachment",
      "description": "Uploads email attachments to specified Google Drive folder"
    },
    {
      "step": 3,
      "service": "Slack",
      "action": "Send notification",
      "final": true,
      "description": "Sends notification to Slack channel about saved file"
    }
  ],
  "configurationRequirements": [
    {
      "service": "Gmail",
      "type": "credentials",
      "description": "Gmail account access for monitoring emails",
      "fields": [
        {
          "name": "gmail_email",
          "label": "Gmail Address",
          "type": "email",
          "required": true,
          "help": "Your Gmail email address"
        },
        {
          "name": "gmail_app_password",
          "label": "App Password",
          "type": "password",
          "required": true,
          "help": "Generate an app password in Gmail settings → Security → 2-Step Verification → App passwords"
        }
      ]
    },
    {
      "service": "Google Drive",
      "type": "settings",
      "description": "Google Drive folder configuration",
      "fields": [
        {
          "name": "drive_folder_id",
          "label": "Folder ID",
          "type": "text",
          "required": true,
          "help": "Right-click folder in Google Drive → Share → Copy link → Extract the folder ID from the URL"
        }
      ]
    },
    {
      "service": "Slack",
      "type": "settings",
      "description": "Slack notification configuration",
      "fields": [
        {
          "name": "slack_webhook_url",
          "label": "Webhook URL",
          "type": "url",
          "required": true,
          "help": "Create a webhook in Slack: Apps → Incoming Webhooks → Add to Slack"
        },
        {
          "name": "slack_channel",
          "label": "Channel Name",
          "type": "text",
          "required": false,
          "help": "Channel name (optional, defaults to webhook channel)"
        }
      ]
    }
  ],
  "description": "brief_explanation",
  "deploymentInstructions": "platform_agnostic_instructions",
  "deploymentOptions": ["AWS Lambda", "Google Cloud Functions", "Azure Functions", "Vercel Functions"]
}

WORKFLOW TYPES TO DETECT:
- Email Processing: Handles email-based triggers and actions
- File Management: Manages files across different storage services
- Notification System: Sends alerts via email/SMS/Slack/Teams
- Data Integration: Connects and syncs data between services
- Scheduled Task: Runs on a schedule (cron-like)
- Webhook Handler: Responds to HTTP requests/form submissions
- Event Processor: Processes events from queues/streams`
                },
                {
                    role: 'user',
                    content: `Generate a serverless function for this workflow: "${description}"`
                }
            ],
            max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 3000,
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

