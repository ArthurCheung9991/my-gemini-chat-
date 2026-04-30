export default async function handler(req, res) {
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

    const response = '【測試回應】你說了：' + message + '。這是假回應，用來測試同步功能。';

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
