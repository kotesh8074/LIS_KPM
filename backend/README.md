# Simple Render setup

## One-time setup

1. From the project folder, run:

   ```powershell
   node backend/scripts/generate-license-keys.mjs
   ```

   This automatically saves the public key in `.env.local` and the private key in `backend/license-private-key.txt`.

2. Create a Render **Web Service** from this project:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`

3. In Render → **Environment**, add these values:
   - `LICENSE_PRIVATE_KEY_BASE64`: copy the full contents of `backend/license-private-key.txt`
   - `LICENSE_ADMIN_TOKEN`: choose a password only you know
   - `LICENSE_PUBLIC_URL`: the public HTTPS origin assigned to your Render service, such as `https://your-service.onrender.com`

4. Deploy the service. From the project root, build the Windows installer:

   ```powershell
   npm run dist:win
   ```

   The installer is created in `windows-installer\Lab Software Setup 1.0.0.exe`. Send that `.exe` to users.

   The app can activate and run offline. When the server is reachable, expiry checks use server time; offline, the app starts from the computer clock and counts elapsed time while open. The countdown displays days, hours, minutes, and seconds. Without a trusted clock, changing the computer's clock while offline and restarting the app can affect expiry.

## Every activation

1. Ask the user to copy **This computer's ID** from the app and send it to you.
2. Open your Render service URL, enter your admin password, paste the ID, choose the expiry, and click **Generate key**.
3. Send the key to the user to paste into the app.

Keep `backend/license-private-key.txt` and the Render admin password private.

Activation keys issued before this trusted-time update do not contain the signed time-service URL. After updating the app, issue replacement keys for existing users.
