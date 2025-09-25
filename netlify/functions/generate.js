// Netlify function to securely handle API calls to Google Gemini
// This function acts as a proxy, hiding the API key from the frontend.
// This function is specifically for the "My Room Simulator" and handles background removal.

const { GoogleGenerativeAI } = require("@google/generative-ai");

// CORS headers to allow requests from any origin.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  // Handle preflight requests (for CORS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("APIキーがサーバーに設定されていません。");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use the image-editing capable model ("nano-banana")
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image-preview" });

    const { prompt, image } = JSON.parse(event.body);
    if (!prompt || !image) {
      throw new Error("プロンプトまたは画像データがありません。");
    }

    const imagePart = {
      inlineData: {
        data: image,
        mimeType: "image/jpeg", // Assuming JPEG/PNG from upload
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    
    const image_parts = response.candidates[0].content.parts.filter(part => part.inlineData);
    if(image_parts.length === 0){
        throw new Error("AIが画像の切り抜きに失敗しました。");
    }
    const base64Data = image_parts[0].inlineData.data;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ base64: base64Data }),
    };

  } catch (error) {
    console.error('Error in Netlify function:', error);
    // Check for specific API key error from Google
    if (error.message && error.message.includes("API key not valid")) {
         return {
            statusCode: 401, // Unauthorized
            headers,
            body: JSON.stringify({ error: 'Google APIからエラーが返されました。APIキーまたは請求設定をご確認ください。' }),
        };
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'サーバーで不明なエラーが発生しました。' }),
    };
  }
};

