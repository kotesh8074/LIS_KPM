import { createPrivateKey, randomUUID, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [deviceId, expiresAt, issuedTo = 'Local administrator', contact = '', licenseTypeArg = 'new'] = process.argv.slice(2);
const licenseType = licenseTypeArg;
const recipient = issuedTo.trim();
const recipientContact = contact.trim();
if (!deviceId || deviceId.length > 128 || !recipient || recipient.length > 120
  || recipientContact.length > 120 || !['new', 'renewal'].includes(licenseType)
  || !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt || '')) {
  console.error('Usage: node backend/scripts/create-offline-license.mjs <device-id> <YYYY-MM-DD> [issued-to] [contact] [new|renewal]');
  process.exitCode = 1;
} else {
  const expiryDate = new Date(`${expiresAt}T00:00:00.000Z`);
  if (Number.isNaN(expiryDate.getTime())
    || expiryDate.toISOString().slice(0, 10) !== expiresAt
    || expiresAt <= new Date().toISOString().slice(0, 10)) {
    throw new Error('Expiry date must be a valid future date.');
  }

  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const privateKeyPath = join(scriptDirectory, '..', 'license-private-key.txt');
  const privateKeyBase64 = (await readFile(privateKeyPath, 'utf8')).trim();
  if (!privateKeyBase64) throw new Error('The license signing private key file is empty.');
  const privateKey = createPrivateKey(Buffer.from(privateKeyBase64, 'base64').toString('utf8'));
  const licenseId = randomUUID();
  const timeUrl = '';
  const issuedAt = new Date().toISOString();
  const payload = `${licenseId}|${deviceId}|${expiresAt}|${timeUrl}|${recipient}|${recipientContact}|${issuedAt}|${licenseType}`;
  const ticket = {
    licenseId,
    deviceId,
    expiresAt,
    timeUrl,
    issuedTo: recipient,
    contact: recipientContact,
    issuedAt,
    licenseType,
    signature: sign(
      'RSA-SHA256',
      Buffer.from(payload),
      privateKey
    ).toString('base64')
  };
  console.log(`LAB1-${Buffer.from(JSON.stringify(ticket)).toString('base64url')}`);
}
