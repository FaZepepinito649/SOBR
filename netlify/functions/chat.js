// netlify/functions/chat.js
// Función serverless que conecta el chatbot del frontend con la API de Groq.
// La API key se lee de la variable de entorno GROQ_API_KEY (configúrala en Netlify > Site settings > Environment variables).

exports.handler = async function (event, context) {
  // Headers CORS para que el frontend pueda llamar sin problemas
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Solo aceptamos POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido. Usa POST.' }),
    };
  }

  // Verificar que la API key exista
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    console.error('GROQ_API_KEY no está configurada en Netlify');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'El servidor no tiene configurada la API key de Groq.',
        reply: 'Uy, el servidor no está configurado aún. Avisa al admin de la página 🙏',
      }),
    };
  }

  // Parsear el body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Body inválido (no es JSON)' }),
    };
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Falta el campo "messages" (debe ser un array)' }),
    };
  }

  // Llamar a Groq
  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        // Modelo rápido y gratuito de Groq. Si quieres otro, cámbialo aquí.
        // Opciones comunes: "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
        top_p: 0.95,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', groqResponse.status, errorText);
      return {
        statusCode: groqResponse.status,
        headers,
        body: JSON.stringify({
          error: `Groq API respondió ${groqResponse.status}`,
          reply: 'Uy, tuve un problema con el servicio de IA. Intenta de nuevo en un momentito 🙏',
          detail: errorText,
        }),
      };
    }

    const data = await groqResponse.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Respuesta vacía de Groq',
          reply: 'No pude generar una respuesta, intenta reformular tu pregunta 🤔',
        }),
      };
    }

    // Respuesta exitosa — el frontend espera { reply }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    console.error('Error llamando a Groq:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error interno del servidor',
        reply: 'Uy, algo salió mal de mi lado. Intenta de nuevo en un ratito 😅',
        detail: err.message,
      }),
    };
  }
};
