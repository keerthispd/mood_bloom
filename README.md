# MoodBloom 🌿

MoodBloom is a mental wellbeing web application designed to help users track moods, maintain private journal entries, and anonymously share supportive thoughts in a safe digital space.

The project combines a calm and responsive frontend UI with client-side encryption, IndexedDB storage, and an Express.js backend server.

---

# Features

## Mood Check-in

* Daily mood tracking system
* Multiple mood options such as calm, anxious, overwhelmed, joyful, etc.
* Private notes attached to mood entries
* Mood history tracking
* Reflection prompts and mindfulness tips

## Private Journal

* Personal encrypted journal entries
* Entries stored locally using IndexedDB
* AES-GCM encryption support
* PBKDF2-based key derivation

## Anonymous Heart Dump

* Anonymous community-style posting system
* Supportive message sharing
* Basic harmful-content filtering and moderation
* Public feed without exposing user identity

## Guest Mode

* Allows previewing the application without signing in
* Local temporary session support

## Responsive UI

* Mobile-friendly responsive layout
* Glassmorphism-inspired interface
* Soft wellbeing-focused design language

---

# Tech Stack

## Frontend

* HTML5
* CSS3
* Vanilla JavaScript

## Backend

* Node.js
* Express.js

## Storage & Security

* IndexedDB
* Web Crypto API
* AES-GCM Encryption
* PBKDF2 Key Derivation

---

# Project Structure

```text
MoodBloom/
│
├── public/
│   ├── style.css
│   ├── app.js
│   └── assets/
│
├── views/
│   ├── landing.html
│   ├── dashboard.html
│   ├── home.html
│   ├── journal.html
│   └── message.html
│
├── server.js
├── package.json
├── package-lock.json
└── .gitignore
```

---

# Installation & Setup

## 1. Clone the Repository

```bash
git clone <your-repository-url>
cd MoodBloom
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Start the Server

```bash
npm start
```

OR for development mode:

```bash
npm run dev
```

---

# Running the Project

After starting the server, open:

```text
http://localhost:3000
```

---

# Application Pages

| Page          | Description                  |
| ------------- | ---------------------------- |
| Landing Page  | Login / Guest Mode           |
| Dashboard     | Main wellbeing hub           |
| Mood Check-in | Track moods and reflections  |
| Journal       | Private encrypted journaling |
| Heart Dump    | Anonymous supportive posting |

---

# Security Features

* Client-side encryption using AES-GCM
* PBKDF2 password-based key derivation
* Local IndexedDB storage
* Session-based private access
* Anonymous posting system
* Harmful content filtering

---

# Current Limitations

* Authentication system is currently local/session-based only
* Password verification persistence is not fully implemented
* Data is stored locally in the browser
* No cloud synchronization yet

---

# Future Improvements

* Full user authentication system
* SQLCipher/SQLite integration
* Android application version using Flutter
* Mood analytics and charts
* AI-based emotional insights
* Secure cloud backup
* Emergency mental health support integration

---

# Learning Concepts Used

This project demonstrates:

* Frontend UI design
* Responsive web development
* Express.js routing
* IndexedDB database usage
* Client-side encryption
* Session management
* Form handling
* DOM manipulation
* Secure data storage concepts

---

# Author

Developed as a mental wellbeing and secure journaling project.

---

# License

This project is licensed under the MIT License.
