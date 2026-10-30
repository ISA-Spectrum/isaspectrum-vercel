import { getConfig } from '../_lib/config.js';
import { cookieNames, json, methodNotAllowed, parseCookies } from '../_lib/http.js';
import { getBusinessSession } from '../_lib/session.js';

export async function onRequestGet({ request, env }) {
  const names = cookieNames(request);
  if (!parseCookies(request)[names.session]) return json({ authenticated: false }, 401);
  let config;
  try { config = getConfig(env); } catch { return json({ authenticated: false, error: 'configuration_error' }, 503); }
  try {
    const result = await getBusinessSession(request, env, config, true);
    const headers = result.setCookie ? { 'Set-Cookie': result.setCookie } : {};
    if (!result.session) return json({ authenticated: false }, 401, headers);
    const session = result.session;
    return json({
      authenticated: true,
      user: {
        id: session.user_id,
        issuer: session.identity_provider,
        subject: session.identity_subject,
        email: session.email,
        name: session.display_name,
        checker: session.is_checker === true
      },
      assurance: {
        acr: session.acr,
        amr: session.amr || [],
        authTime: session.auth_time
      },
      expiresAt: session.expires_at
    }, 200, headers);
  } catch {
    return json({ authenticated: false, error: 'session_unavailable' }, 503);
  }
}

export function onRequest() {
  return methodNotAllowed('GET');
}
export const config = { runtime: 'edge' };

export default async function handler(request) {
  // 把 Vercel 的 process.env 伪装成 CF 的 env 传进去
  const context = { request, env: process.env };
  
  if (request.method === 'GET') return onRequestGet(context);
  if (request.method === 'PUT') return onRequestPut(context);
  
  return onRequest();
}