const form = document.querySelector('#license-form');
const adminToken = document.querySelector('#admin-token');
const deviceId = document.querySelector('#device-id');
const expiresAt = document.querySelector('#expires-at');
const generateButton = document.querySelector('#generate-button');
const message = document.querySelector('#message');
const result = document.querySelector('#result');
const activationKey = document.querySelector('#activation-key');
const expiryNote = document.querySelector('#expiry-note');
const copyButton = document.querySelector('#copy-button');

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
        deviceId: deviceId.value.trim(),
        expiresAt: expiresAt.value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    activationKey.value = data.activationKey;
    expiryNote.textContent = `This key expires on ${data.expiresAt}.`;
    result.hidden = false;
    message.textContent = 'Key created. Copy it and send it to the user.';
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
