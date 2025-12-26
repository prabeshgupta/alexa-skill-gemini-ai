const Alexa = require('ask-sdk-core');
const axios = require('axios'); // Use axios for async requests
const { GEMINI_API_KEY } = require('./config');

// Helper function to call the Gemini API
async function getGeminiResponse(history) {
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
                "contents": history, // Send the entire conversation history
                "systemInstruction": {
                    "parts": [{
                        "text": "You are an expert assistant. Your responses should be concise and suitable for a voice assistant."
                    }]
                },
                "safetySettings": [
                    { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH" },
                    { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH" },
                    { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH" },
                    { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH" }
                ],
                "generationConfig": {
                    "temperature": 0.8,
                    "topK": 40,
                    "topP": 0.95,
                    "maxOutputTokens": 2048,
                    "stopSequences": []
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );

        if (response.status === 200 && response.data.candidates && response.data.candidates[0].content) {
            // Join all parts of the response to get a complete answer
            return response.data.candidates[0].content.parts.map(part => part.text).join(" ");
        } else if (response.data.promptFeedback && response.data.promptFeedback.blockReason) {
            return "I can't answer that question due to content restrictions.";
        } else {
            console.error('Gemini API Error:', response.data);
            return "Hmm, I'm having trouble with that question. Could you try rephrasing?";
        }

    } catch (error) {
        console.error('API Request Failed:', error.response ? error.response.data : error.message);
        return "Sorry, I'm having trouble connecting to the knowledge service. Please try again later.";
    }
}


const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Welcome to Brilliant Answers. Say "Hello" followed by your question to get started.';
        
        // Initialize session attributes
        const sessionAttributes = {};
        sessionAttributes.history = []; // Create an empty history array
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const HelloWorldIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HelloWorldIntent';
    },
    async handle(handlerInput) { // Make the handler async
        const catchAllSlot = handlerInput.requestEnvelope.request.intent.slots.catchAll;
        const userQuestion = catchAllSlot && catchAllSlot.value;

        if (!userQuestion) {
            return handlerInput.responseBuilder
                .speak("Please ask your question after saying hello. For example: 'Hello, how do airplanes fly?'")
                .reprompt("Try asking something like: 'Hello, what is the capital of France?'")
                .getResponse();
        }

        // Get session attributes and history
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const history = sessionAttributes.history || [];

        // Add the user's new question to the history
        history.push({
            "role": "user",
            "parts": [{ "text": userQuestion }]
        });

        // Get the response from Gemini using the full history
        const geminiAnswer = await getGeminiResponse(history);
        
        // Clean the response for Alexa's voice
        let speakOutput = geminiAnswer
            .replace(/\*\*/g, '') // Remove bold markers
            .replace(/\[.*?\]/g, '') // Remove citations
            .substring(0, 6000); // Ensure it's within Alexa's speech limit

        // Add the model's response to history for future context
        history.push({
            "role": "model",
            "parts": [{ "text": geminiAnswer }] // Save the raw answer for context
        });

        // Save the updated history back to session attributes
        sessionAttributes.history = history;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        
        const repromptText = 'Would you like to ask another question?';
        speakOutput += ` <break time='1s'/> ${repromptText}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptText)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'I can answer questions on almost any topic! Just say "Hello" followed by your question. For example: "Hello, what is the theory of relativity?" or "Hello, how do plants make oxygen?". What would you like to know?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        // By ending the session, the session attributes (including history) are automatically cleared.
        const speakOutput = 'Goodbye! Feel free to return anytime with more questions.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = "I didn't catch that. Try saying 'Hello' followed by your question, or say 'Help' for examples.";
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
        // Any cleanup logic goes here. The session attributes are already gone.
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error(`Error handled: ${error.stack}`);
        return handlerInput.responseBuilder
            .speak("Sorry, I'm having trouble processing your request. Please try again.")
            .reprompt("Could you please repeat your question?")
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        HelloWorldIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(
        ErrorHandler
    )
    .withCustomUserAgent('brilliant-answers/v1.1')
    .lambda();
