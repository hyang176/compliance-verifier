// api/verify.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const { content } = req.body || {};
    if (!content) return res.status(400).json({ message: 'Please provide content' });

    const isUrl = (s) => /^https?:\/\//i.test(s);
    let userText = content;

    if (isUrl(content)) {
      try {
        const page = await fetch(content, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await page.text();
        const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)||[])[1] || '';
        const paras = Array.from(html.matchAll(/<p[^>]*>(.*?)<\/p>/gis))
          .slice(0,6).map(m => m[1].replace(/<[^>]+>/g,'').trim()).join(' ');
        userText = (title + '\n' + paras).trim() || '(No readable text)';
      } catch (e) {
        userText = `(Failed to fetch link: ${e})`;
      }
    }

    const prompt = `你是合规与事实核查助手。请基于下列输入给出：
1) 真实性：可信/存疑/不可信（含理由）；
2) 合规风险：是否涉及虚假宣传、误导、政治/医疗/金融等；
3) 建议：如存在风险，给出更合规的表述建议。

【内容】
${userText}`;

    const oai = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });

    if (!oai.ok) {
      const err = await oai.text();
      return res.status(500).json({ message: `OpenAI error: ${err}` });
    }
    const data = await oai.json();
    const msg = data.choices?.[0]?.message?.content?.trim() || '(no result)';
    res.status(200).json({ message: msg });
  } catch (e) {
    res.status(500).json({ message: `Server error: ${e}` });
  }
}
