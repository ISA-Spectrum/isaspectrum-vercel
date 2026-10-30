import { destroyBusinessSession } from '../_lib/session.js';

export async function onRequestGet({ request, env }) {
  // 获取清除session的Set‑Cookie字符串
  const setCookieStr = await destroyBusinessSession(request, env);

  const headers = new Headers();
  
  // 🎯 核心修改：写死主站绝对路径，并且去掉 .html
  headers.set("Location", "https://isaspectrum.celestivast.com/main");
  
  // Set‑Cookie允许多个，用append，不要set，防止覆盖
  headers.append("Set-Cookie", setCookieStr);

  return new Response(null, {
    status: 302,
    headers
  });
}

// 只允许GET
export function onRequest() {
  return new Response(null, { status: 405 });
}
export const config = { runtime: 'edge' };

export default async function handler(request) {
  // 把 Vercel 的 process.env 伪装成 CF 的 env 传进去
  const context = { request, env: process.env };
  
  if (request.method === 'GET') return onRequestGet(context);
  if (request.method === 'PUT') return onRequestPut(context);
  
  return onRequest();
}