const form = document.querySelector('#license-form');
const adminToken = document.querySelector('#admin-token');
const issuedTo = document.querySelector('#issued-to');
const contact = document.querySelector('#contact');
const deviceId = document.querySelector('#device-id');
const licenseType = document.querySelector('#license-type');
const expiresAt = document.querySelector('#expires-at');
const generateButton = document.querySelector('#generate-button');
const message = document.querySelector('#message');
const result = document.querySelector('#result');
const activationKey = document.querySelector('#activation-key');
const expiryNote = document.querySelector('#expiry-note');
const copyButton = document.querySelector('#copy-button');
const copyDetailsButton = document.querySelector('#copy-details-button');
let licenseDetails = '';

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
expiresAt.min = tomorrow.toISOString().slice(0, 10);
const defaultExpiry = new Date();
defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);
expiresAt.value = defaultExpiry.toISOString().slice(0, 10);

form.addEventListener('submit', async event => {
  event.preventDefault();
  message.hidden = true;
  result.hidden = true;
  generateButton.disabled = true;
  generateButton.textContent = 'Generating...';

  try {
    const response = await fetch('/api/licenses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        issuedTo: issuedTo.value.trim(),
        contact: contact.value.trim(),
        deviceId: deviceId.value.trim(),
        expiresAt: expiresAt.value,
        licenseType: licenseType.value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    activationKey.value = data.activationKey;
    const issuedDate = new Date(data.issuedAt);
    const details = [
      `License action: ${data.licenseType === 'renewal' ? 'Renewal' : 'New activation'}`,
      `Issued to: ${data.issuedTo}`,
      data.contact ? `Contact: ${data.contact}` : null,
      `Device ID: ${data.deviceId}`,
      `License ID: ${data.licenseId}`,
      `Generated: ${issuedDate.toLocaleString()}`,
      `Expires: ${data.expiresAt}`
    ].filter(Boolean);
    licenseDetails = details.join('\n');
    expiryNote.textContent = licenseDetails;
    result.hidden = false;
    message.textContent = 'Offline license key generated. Save the details and provide the key to the recipient.';
    message.className = 'message success';
    message.hidden = false;
  } catch (error) {
    message.textContent = error.message || 'Could not create the activation key.';
    message.className = 'message';
    message.hidden = false;
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = 'Generate key';
  }
});

copyDetailsButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(licenseDetails);
    message.textContent = 'License details copied.';
    message.className = 'message success';
  } catch (error) {
    console.error('Could not copy license details:', error);
    message.textContent = 'Could not copy details. Select and copy them from the summary above.';
    message.className = 'message';
  }
  message.hidden = false;
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(activationKey.value);
    message.textContent = 'Key copied.';
    message.className = 'message success';
  } catch (error) {
    console.error('Could not copy activation key:', error);
    activationKey.focus();
    activationKey.select();
    message.textContent = 'Select and copy the key above.';
    message.className = 'message';
  }
  message.hidden = false;
});
