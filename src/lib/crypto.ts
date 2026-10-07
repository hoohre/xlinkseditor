import { AUTH_RSA_PUBLIC_KEY } from '../config/rsaPublicKey'

export interface EncryptedEnvelope {
  encryptedKey: string
  iv: string
  ciphertext: string
}

const toBase64 = (input: ArrayBuffer): string => {
  const bytes = new Uint8Array(input)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

const importPublicKey = async (): Promise<CryptoKey> => {
  const base64 = AUTH_RSA_PUBLIC_KEY
    .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '')
  const binary = atob(base64)
  const der = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
}

export async function encryptEmailCredentials(input: {
  intent: 'login' | 'register' | 'change_password'
  email: string
  password: string
  newPassword?: string
}): Promise<EncryptedEnvelope> {
  const rsaKey = await importPublicKey()
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
  ])
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey)
  const encryptedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaKey, rawAesKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ ...input, email: input.email.trim().toLowerCase(), issuedAt: Date.now() }),
  )
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext)
  return {
    encryptedKey: toBase64(encryptedKey),
    iv: toBase64(iv.buffer),
    ciphertext: toBase64(ciphertext),
  }
}
