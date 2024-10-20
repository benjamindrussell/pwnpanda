import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import fetch from 'node-fetch';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const HIBP_API_KEY = process.env.HIBP_API_KEY;

async function checkHaveIBeenPwned(email: string) {
  const response = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${email}`, {
    method: 'GET',
    headers: {
      'hibp-api-key': HIBP_API_KEY as string,
      'user-agent': 'YourAppName'
    }
  });
  if (response.status === 404) {
    return "Good news! This email hasn't been found in any known data breaches.";
  } else if (response.ok) {
    const breaches = await response.json() as any;
    return `This email was found in ${breaches.length} data breach(es). Here are the details: ${JSON.stringify(breaches)}`;
  } else {
    throw new Error('Failed to check HaveIBeenPwned');
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, email, isFirstMessage, conversationHistory } = body;

  let messages = [];

  if (isFirstMessage) {
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required for the first message' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const hibpResult = await checkHaveIBeenPwned(email);
    
    messages = [
      {role: "system", content: "You are a helpful assistant that provides online security advice. You have just received information about an email address from the HaveIBeenPwned API. Provide a helpful interpretation of this information and offer advice on what steps the user should take next."},
      {role: "user", content: `Here's the result of the HaveIBeenPwned check: ${hibpResult}`}
    ];
  } else {
    if (!message) {
      return new Response(JSON.stringify({ error: 'No message provided' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    messages = [
      {role: "system", content: "You are a helpful assistant that provides online security advice."},
      ...(Array.isArray(conversationHistory) ? conversationHistory : []),
      {role: "user", content: message}
    ];
  }

  // Ensure all messages have the required 'role' field
  messages = messages.map(msg => {
    if (!msg.role) {
      console.warn('Message without role detected:', msg);
      return { ...msg, role: 'user' }; // Default to 'user' if role is missing
    }
    return msg;
  });

  console.log('Messages being sent to OpenAI:', JSON.stringify(messages, null, 2));

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messages,
      max_tokens: 250,
      stream: true,
    });

    return new Response(
      new ReadableStream({
        async start(controller) {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(JSON.stringify({ content }) + '\n');
            }
          }
          controller.close();
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ error: 'An error occurred while processing your request' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}