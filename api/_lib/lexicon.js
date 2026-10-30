const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 小时超长缓存，极大节省 Supabase 带宽
let cache = null;

export async function loadLexicon(env) {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) return cache;

  let rawText = '';

  // 🎯 Vercel 专属逻辑：直接去问 Supabase
  if (env?.BUSINESS_SUPABASE_URL && env?.BUSINESS_SUPABASE_PUBLISHABLE_KEY) {
    try {
      const url = `${env.BUSINESS_SUPABASE_URL.replace(/\/$/, '')}/rest/v1/lexicon?select=word`;
      const resp = await fetch(url, {
        headers: {
          apikey: env.BUSINESS_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${env.BUSINESS_SUPABASE_PUBLISHABLE_KEY}`
        }
      });
      
      if (resp.ok) {
        const rows = await resp.json();
        rawText = rows.map(r => r.word).join('\n');
        console.log(`[Lexicon] Vercel 端从 Supabase 成功加载了 ${rows.length} 个敏感词`);
      } else {
        console.error('[Lexicon] Supabase 读取失败，状态码:', resp.status);
      }
    } catch (e) {
      console.error('[Lexicon] 请求 Supabase 异常:', e);
    }
  }

  // 🛡️ Fail-Safe 兜底：只要没拿到词库，直接返回 null，让外层强制转人工
  if (!rawText) {
    console.error('[Lexicon] 词库彻底失效！触发 Fail-Safe');
    return null; 
  }

  // 计算指纹，如果和缓存一样就不重新构建索引
  const fingerprint = `${rawText.length}:${rawText.slice(0, 48)}`;
  if (cache && cache.fingerprint === fingerprint) {
    cache.loadedAt = now;
    return cache;
  }

  // 构建索引（buildIndex 是你原本文件底部的函数，保留不动）
  cache = buildIndex(rawText, fingerprint);
  return cache;
}