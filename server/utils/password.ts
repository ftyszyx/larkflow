const encoder = new TextEncoder()

const b64uEncode = (bytes: Uint8Array) => {
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  const b64 = btoa(bin)
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

const b64uDecode = (value: string) => {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export type PasswordHash = {
  v: 1
  iter: number
  saltB64u: string
  hashB64u: string
}

export const hashPassword = async (password: string, opts?: { iterations?: number }) => {
  const iterations = opts?.iterations ?? 210_000
  const salt = crypto.getRandomValues(new Uint8Array(16))

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    key,
    32 * 8,
  )

  const hash = new Uint8Array(bits)

  const payload: PasswordHash = {
    v: 1,
    iter: iterations,
    saltB64u: b64uEncode(salt),
    hashB64u: b64uEncode(hash),
  }

  return JSON.stringify(payload)
}

export const verifyPassword = async (password: string, passwordHashJson: string) => {
  let parsed: PasswordHash
  try {
    parsed = JSON.parse(passwordHashJson) as PasswordHash
  } catch {
    return false
  }

  if (!parsed || parsed.v !== 1 || !parsed.iter || !parsed.saltB64u || !parsed.hashB64u) return false

  const salt = b64uDecode(parsed.saltB64u)
  const expected = b64uDecode(parsed.hashB64u)

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: parsed.iter,
    },
    key,
    expected.length * 8,
  )

  const actual = new Uint8Array(bits)
  if (actual.length !== expected.length) return false

  // constant-ish time compare
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}
