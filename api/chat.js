export default async function handler(req, res) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST' });
  }

  const { message, user_email, device } = req.body;

  try {
    const historyRes = await fetch(SUPABASE_URL + '/rest/v1/chat_history?user_email=eq.' + encodeURIComponent(user_email) + '&order=created_at.desc&limit=20', {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      }
    });
    
    if (!historyRes.ok) {
      const errorText = await historyRes.text();
      return res.status(500).json({ error: 'Supabase 讀取失敗', details: errorText });
    }
    
    const history = await historyRes.json();

    let contents = [];
    history.reverse().forEach(function(h) {
      contents.push({ role: 'user', parts: [{ text: h.message }] });
      contents.push({ role: 'model', parts: [{ text: h.response }] });
    });
    contents.push({ role: 'user', parts: [{ text: message }] });

    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: contents })
      }
    );

    const responseText = await geminiRes.text();
    
    if (!geminiRes.ok) {
      return res.status(200).json({ 
        response: 'Gemini API 錯誤：狀態碼 ' + geminiRes.status + '，內容：' + responseText.substring(0, 300)
      });
    }

    let geminiData;
    try {
      geminiData = JSON.parse(responseText);
    } catch (e) {
      return res.status(200).json({ 
        response: 'Gemini 回應不是 JSON，原始內容：' + responseText.substring(0, 300)
      });
    }

    let response = 'Gemini 沒有回應';

    if (geminiData.error) {
      response = 'Gemini API 錯誤：' + JSON.stringify(geminiData.error);
    } else if (geminiData.candidates && geminiData.candidates.length > 0) {
      const candidate = geminiData.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        response = candidate.content.parts[0].text || 'Gemini 回應為空';
      } else if (candidate.finishReason) {
        response = 'Gemini 完成原因：' + candidate.finishReason;
      } else {
        response = '無法解析回應：' + JSON.stringify(candidate).substring(0, 200);
      }
    } else if (geminiData.promptFeedback) {
      response = 'Prompt 被阻擋：' + JSON.stringify(geminiData.promptFeedback);
    } else {
      response = '無候選回應：' + JSON.stringify(geminiData).substring(0, 200);
    }

    await fetch(SUPABASE_URL + '/rest/v1/chat_history', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ user_email: user_email, message: message, response: response, device: device })
    });

    res.status(200).json({ response: response, history: history });

  } catch (error) {
    res.status(500).json({ error: '伺服器錯誤：' + error.message });
  }
}
