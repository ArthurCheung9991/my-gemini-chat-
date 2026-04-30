export default async function handler(req, res) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
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

    let messages = [];
    history.reverse().forEach(function(h) {
      messages.push({ role: 'user', content: h.message });
      messages.push({ role: 'assistant', content: h.response });
    });
    messages.push({ role: 'user', content: message });

    const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://my-gemini-chat-jet.vercel.app',
        'X-Title': 'My Gemini Chat'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001:free',
        messages: messages
      })
    });

    const openrouterData = await openrouterRes.json();

    let response = '沒有回應';
    if (openrouterData.choices && openrouterData.choices.length > 0) {
      response = openrouterData.choices[0].message.content || '回應為空';
    } else if (openrouterData.error) {
      response = 'API 錯誤：' + JSON.stringify(openrouterData.error);
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
