// Netlify function for My Room Simulator
// This function handles background removal using an image-editing model.

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("APIキーがサーバーに設定されていません。");
    }

    const { prompt, image } = JSON.parse(event.body);
    if (!prompt || !image) {
      throw new Error("プロンプトまたは画像データがありません。");
    }

    const imagePart = {
      inlineData: {
        data: image,
        mimeType: "image/jpeg", // Can be jpeg or png
      },
    };
    
    const modelToUse = "gemini-2.5-flash-image-preview";
    // FIX: Ensure the v1beta endpoint is used, as required by this model
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: prompt }, imagePart]
        }],
        // FIX: Removed incorrect generationConfig that caused the error.
        // This model does not use response_mime_type in generationConfig.
    };

    const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
        const errorBody = await apiResponse.json().catch(() => ({}));
        console.error("Google API Error:", errorBody);
        const errorMessage = errorBody?.error?.message || 'Google APIでエラーが発生しました。';
         if (errorMessage.includes("API key not valid")) {
            throw new Error('Google APIからエラーが返されました。APIキーまたは請求設定をご確認ください。');
        }
        throw new Error(errorMessage);
    }
    
    const result = await apiResponse.json();
    const image_parts = result.candidates?.[0]?.content?.parts?.filter(part => part.inlineData);

    if (!image_parts || image_parts.length === 0) {
        console.error("No image parts in API response:", result);
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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'サーバーで不明なエラーが発生しました。' }),
    };
  }
};

