# MoodBloom

MoodBloom is a browser-based private journaling app with a per-user login flow, generated user IDs, and encrypted personal entries stored in IndexedDB.

What changed:

- New sign-up and login flow that creates a user ID at registration.
- Passwords are hashed before storage.
- Journal entries, private notes, and mood check-ins are encrypted per user before they are saved.
- Each signed-in user only sees their own data in the browser database.

How it works:

- Open `landing.html` in a browser.
- Create an account or log in with an existing username and password.
- Use the mood, journal, and private note pages while signed in.
- Log out to clear the current session.

Notes:

- The app uses the browser's IndexedDB storage, so the data stays on the device and in the browser profile.
- If you clear browser storage, the saved accounts and encrypted entries will be removed.

Quick start (local server)

1. Install dependencies:

```bash
npm install
```

2. Run the server:

```bash
npm start
```

3. Open http://localhost:3000 in your browser.

Notes:

- `views/` contains the HTML pages; `public/` serves CSS, JS and assets. The server serves `public/` first so `/style.css` and `/app.js` resolve correctly.
- Copy `.env.example` to `.env` to override the `PORT` or set other environment values.

