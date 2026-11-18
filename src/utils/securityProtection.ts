/**
 * lnr Studio - Anti-Reverse Engineering & Data Security Module
 * Provides Web Crypto AES-GCM encryption, anti-debugging safeguards,
 * keyboard/context anti-inspection listeners, and domain integrity verification.
 */

// Default AES key seed for lnr Studio quiz pack encryption
const DEFAULT_KEY_SEED = 'lnr-studio-247-security-master-v1';

/**
 * Derives an AES-GCM 256-bit crypto key using SHA-256 from a passphrase.
 */
async function getCryptoKey(passphrase: string = DEFAULT_KEY_SEED): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(passphrase));
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts data using Web Crypto AES-GCM 256-bit algorithm.
 */
export async function encryptData(plainText: string, secretKey: string = DEFAULT_KEY_SEED): Promise<string> {
  try {
    const key = await getCryptoKey(secretKey);
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plainText)
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Convert to base64 payload
    return 'LNR_ENC:' + btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.error('Encryption failed:', err);
    return plainText;
  }
}

/**
 * Decrypts AES-GCM encrypted payload back to plain text.
 */
export async function decryptData(encryptedPayload: string, secretKey: string = DEFAULT_KEY_SEED): Promise<string> {
  try {
    if (!encryptedPayload.startsWith('LNR_ENC:')) {
      return encryptedPayload; // Plaintext fallback if not encrypted
    }
    const base64Data = encryptedPayload.replace('LNR_ENC:', '');
    const binaryStr = atob(base64Data);
    const bytes = Uint8Array.from(binaryStr, c => c.charCodeAt(0));

    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);
    const key = await getCryptoKey(secretKey);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.error('Decryption error or corrupted payload:', err);
    throw new Error('Failed to decrypt data payload.');
  }
}

let antiDebugInterval: number | null = null;

/**
 * Deters DevTools step-by-step debugging by triggering obfuscated debugger traps.
 */
export function startAntiDebuggingGuard(): void {
  if (antiDebugInterval !== null) return;

  const debugTrap = () => {
    try {
      const startTime = performance.now();
      // Obfuscated constructor execution to prevent static AST elimination
      const trap = new Function('debugger');
      trap();
      const duration = performance.now() - startTime;
      if (duration > 100) {
        console.warn('[lnr Security] Inspection detected');
      }
    } catch {
      // Ignore in strict contexts
    }
  };

  antiDebugInterval = window.setInterval(debugTrap, 2500);
}

export function stopAntiDebuggingGuard(): void {
  if (antiDebugInterval !== null) {
    clearInterval(antiDebugInterval);
    antiDebugInterval = null;
  }
}

let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
let contextMenuHandler: ((e: MouseEvent) => void) | null = null;

/**
 * Blocks inspect shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S) and right-click during broadcasting.
 */
export function toggleAntiInspectionListeners(enable: boolean): void {
  if (enable) {
    if (!keydownHandler) {
      keydownHandler = (e: KeyboardEvent) => {
        // F12 key
        if (e.keyCode === 123) {
          e.preventDefault();
          return false;
        }
        // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
          e.preventDefault();
          return false;
        }
        // Ctrl+U (View Source) or Ctrl+S (Save Page)
        if (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 83)) {
          e.preventDefault();
          return false;
        }
      };
      window.addEventListener('keydown', keydownHandler);
    }

    if (!contextMenuHandler) {
      contextMenuHandler = (e: MouseEvent) => {
        // Prevent right click inspect popup
        e.preventDefault();
        return false;
      };
      window.addEventListener('contextmenu', contextMenuHandler);
    }
  } else {
    if (keydownHandler) {
      window.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
    if (contextMenuHandler) {
      window.removeEventListener('contextmenu', contextMenuHandler);
      contextMenuHandler = null;
    }
  }
}

/**
 * Validates domain hostname against authorized hosts.
 */
export function isAuthorizedHost(allowedDomains: string[] = []): boolean {
  if (allowedDomains.length === 0) return true;
  const currentHost = window.location.hostname;
  return allowedDomains.some(domain => currentHost === domain || currentHost.endsWith('.' + domain));
}
