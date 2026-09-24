/** Driver access tokens: 32 random bytes as base64url; only the sha256 hex is stored. */

function base64url(bytes: Uint8Array): string {
  let bin = ''
  bytes.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function hashToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function createToken(): Promise<{ raw: string; hash: string }> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const raw = base64url(bytes)
  return { raw, hash: await hashToken(raw) }
}
