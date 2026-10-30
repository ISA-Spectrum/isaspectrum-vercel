/**
 * 中文敏感词库匹配器（Vercel 备站版 - Supabase 读取）
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 备站缓存 24 小时，省钱！
const MIN_LEN = 2;
const MAX_LEN = 32;
const MAX_HITS = 20;

let cache = null;

/**
 * 归一化。词库侧与待检文本侧必须使用同一函数，否则对不上。
 */
export function compact(text) {
  return String(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function buildIndex(rawText, fingerprint) {
  const set = new Set();
  const firstChars = new Set();
  const lengths = new Set();
  let maxLen = 0;
  let skipped = 0;

  for (const line of rawText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const word = compact(trimmed);
    if (word.length < MIN_LEN || word.length > MAX_LEN) {
      skipped++;
      continue;
    }
    if (set.has(word)) continue;
    set.add(word);
    firstChars.add(word[0]);
    lengths.add(word.length);
    if (word.length > maxLen) maxLen = word.length;
  }

  return {
    fingerprint,
    set,
    firstChars,
    maxLen,
    lengths: [...lengths].sort((a, b) => a - b),
    size: set.size,
    skipped,
    loadedAt: Date.now()
  };
}

/**
 * 读取词库。
 */
export async function loadLexicon(env) {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) return cache;

  let rawText = '';

  // 纯 Vercel 逻辑：直接走 Supabase
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
        console.log(`[Lexicon] Vercel 从 Supabase 加载了 ${rows.length} 个敏感词`);
      } else {
        console.error('[Lexicon] Supabase 读取失败，状态码:', resp.status);
      }
    } catch (e) {
      console.error('[Lexicon] 请求 Supabase 异常:', e);
    }
  }

  // Fail-Safe 兜底
  if (!rawText) {
    console.error('[Lexicon] Vercel 词库彻底失效，返回 null');
    return null; 
  }

  const fingerprint = `${rawText.length}:${rawText.slice(0, 48)}`;
  if (cache && cache.fingerprint === fingerprint) {
    cache.loadedAt = now;
    return cache;
  }

  cache = buildIndex(rawText, fingerprint);
  return cache;
}

/**
 * 🎯 补上的关键函数：扫描文本，这就是报错里缺失的那个！
 */
export function scanLexicon(text, lex) {
  const miss = { hit: false, words: [] };
  if (!lex || !lex.size || !text) return miss;

  const haystack = compact(text);
  const n = haystack.length;
  if (!n) return miss;

  const lengths = lex.lengths;
  const hits = new Set();

  for (let i = 0; i < n; i++) {
    if (!lex.firstChars.has(haystack[i])) continue;
    for (let k = 0; k < lengths.length; k++) {
      const len = lengths[k];
      if (i + len > n) break;
      if (lex.set.has(haystack.slice(i, i + len))) {
        hits.add(haystack.slice(i, i + len));
        if (hits.size >= MAX_HITS) return { hit: true, words: [...hits] };
      }
    }
  }

  return { hit: hits.size > 0, words: [...hits] };
}