const Alexa = require('ask-sdk-core');
const request = require('sync-request');
const { GEMINI_API_KEY } = require('./config');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Welcome to Brilliant Answers powered by Google Gemini. Say "Hello" followed by your question to get started.';
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
    handle(handlerInput) {
        const catchAllSlot = handlerInput.requestEnvelope.request.intent.slots.catchAll;
        const catchAllValue = catchAllSlot && catchAllSlot.value;
        
        if (!catchAllValue) {
            return handlerInput.responseBuilder
                .speak("Please ask your question after saying hello. For example: 'Hello, how do airplanes fly?'")
                .reprompt("Try asking something like: 'Hello, what is the capital of France?'")
                .getResponse();
        }

        let speakOutput;
        try {
            const response = request('POST',
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        "contents": [{
                            "parts": [{
                                "text": `You are an expert assistant dedicated to providing accurate and helpful responses. Deliver your answer within 8 seconds to ensure Alexa processes it before timing out. Include as much relevant and useful information as possible while maintaining clarity and precision.: ${catchAllValue}`
                            }]
                        }],
                        "safetySettings": [
                            { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH" },
                            { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH" },
                            { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH" },
                            { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH" }
                        ],
                        "generationConfig": {
                            "temperature": 0.9,
                            "topK": 40,
                            "topP": 0.95,
                            "maxOutputTokens": 2048,  // Increased to allow longer responses
                            "stopSequences": []
                        }
                    })
                });

            const responseBody = JSON.parse(response.getBody('utf8'));

            if (response.statusCode === 200 && 
                responseBody.candidates && 
                responseBody.candidates[0].content) {
                
                // Extract all parts of the response to get a complete answer
                speakOutput = responseBody.candidates[0].content.parts.map(part => part.text).join(" ");
                
                // Clean and truncate response for Alexa
                speakOutput = speakOutput
                    .replace(/\*\*/g, '') // Remove bold markers
                    .replace(/\[.*?\]/g, '') // Remove citations
                    .substring(0, 6000); // Ensure it's within Alexa's speech limit
                
                speakOutput += " <break time='2s'/> Would you like to ask another question? Say 'Hello' followed by your question.";
                    
            } else if (responseBody.promptFeedback && responseBody.promptFeedback.blockReason) {
                speakOutput = "I can't answer that question due to content restrictions.";
            } else {
                console.error('Gemini API Error:', responseBody);
                speakOutput = "Hmm, I'm having trouble with that question. Could you try rephrasing?";
            }
        } catch (error) {
            console.error('API Request Failed:', error);
            speakOutput = "Sorry, I'm having trouble connecting to the knowledge service. Please try again later.";
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Would you like to ask another question? Say "Hello" followed by your question.')
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
        console.log(`Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error(`Error handled: ${error.message}`);
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
    .withCustomUserAgent('hello-world/v1.0')
    .lambda();
