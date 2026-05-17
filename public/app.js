const DB_NAME = "mood_bloom_private_journal";
const DB_VERSION = 2;
const SESSION_KEY = "moodBloom:session";
const DAILY_TIP_KEY = "moodBloom:dailyTip";
const ITERATIONS = 150000;
const PUBLIC_POST_MAX_LENGTH = 600;
const HEART_DUMP_BLOCKED_PATTERNS = [
	/\bkill yourself\b/i,
	/\bgo (?:kill|die) yourself\b/i,
	/\bend yourself\b/i,
	/\byou(?:'re| are)?\s+(?:an?\s+)?(?:idiot|stupid|worthless|loser|trash|pathetic|dumb)\b/i,
	/\b(?:idiot|stupid|worthless|loser|trash|pathetic|dumb)\b.*\byou\b/i,
	/\b(?:hate|h8)\s+you\b/i,
	/\bshut\s+up\b/i,
	/\bget\s+lost\b/i,
	/\b(?:I\s+will|I'll)\s+(?:hurt|hit|attack)\s+you\b/i,
	/\b(?:kill|murder)\s+you\b/i
];
const HEART_DUMP_SELF_HARM_PATTERNS = [
	/\bkill myself\b/i,
	/\bend my life\b/i,
	/\b(?:want|going)\s+to\s+die\b/i,
	/\b(?:self\s*harm|hurt myself)\b/i
];

const MOOD_MESSAGES = {
	calm: "Your pace can stay gentle today. Keep the good momentum small and steady.",
	joyful: "Hold onto what is working. Small wins are worth keeping on purpose.",
	low: "Low days still count. Do one small thing and let that be enough for now.",
	anxious: "Name one thing you can control, then take one slower breath than usual.",
	frustrated: "Frustration is a signal, not a failure. Slow down, release some pressure, and choose one clear next step.",
	overwhelmed: "Trim the next step down until it feels possible, not perfect.",
	grateful: "Write down why this mattered. Gratitude sticks better when you name it clearly."
};

const MOOD_PLANS = {
	calm: {
		title: "Calm can be your steady base today.",
		body: "You are already in a grounded place, so keep it gentle and protect the calm.",
		actions: [
			"Take a slow walk and notice three small details around you.",
			"Choose one task and finish it without rushing.",
			"End the day with a warm drink and a quiet check-in."
		]
	},
	joyful: {
		title: "Joy is worth savoring.",
		body: "Let this feeling stretch a little by sharing it or capturing it.",
		actions: [
			"Send a short thank-you or kind note to someone.",
			"Write down what helped today feel lighter.",
			"Play a favorite song and let your body move a bit."
		]
	},
	low: {
		title: "Low moments still deserve kindness.",
		body: "Keep expectations small and focus on comfort, not productivity.",
		actions: [
			"Pick one tiny task and let that be enough.",
			"Wrap up in something cozy and rest your eyes for 5 minutes.",
			"Reach out to a trusted person with a simple check-in."
		]
	},
	anxious: {
		title: "Anxious energy can soften with small anchors.",
		body: "Bring your attention to what is steady and close by.",
		actions: [
			"Try box breathing: inhale 4, hold 4, exhale 4, hold 4.",
			"Name five things you can see to bring your mind into the room.",
			"Write one worry and one possible next step."
		]
	},
	frustrated: {
		title: "Frustration can be redirected into clarity.",
		body: "When tension rises, reset your body first, then narrow your focus to one doable action.",
		actions: [
			"Unclench your jaw and shoulders, then take 5 slow breaths.",
			"Write what feels blocked in one sentence.",
			"Choose one 10-minute action that moves the situation forward."
		]
	},
	overwhelmed: {
		title: "Overwhelm eases when the next step is smaller.",
		body: "You do not have to fix everything, just the next gentle step.",
		actions: [
			"Choose one 10-minute task and ignore the rest for now.",
			"Make a short list of what can wait until tomorrow.",
			"Stretch your neck and shoulders for one minute."
		]
	},
	grateful: {
		title: "Gratitude can brighten even a quiet day.",
		body: "Let this feeling deepen by naming the details.",
		actions: [
			"Write down three small things you appreciate today.",
			"Share one moment of gratitude with someone you trust.",
			"Take a photo or note of the moment you want to remember."
		]
	}
};

const MINDFULNESS_TIPS = [
	"Pause for 4 slow breaths and notice one thing that feels safe right now.",
	"Look around and name 3 things you can see, 2 things you can hear, and 1 thing you can feel.",
	"Before your next task, relax your shoulders and unclench your jaw.",
	"Drink a glass of water slowly and let that be your reset.",
	"Write one kind sentence to yourself the way you would to a friend.",
	"Step away from your screen for 2 minutes and let your eyes rest."
];

const HEART_DUMP_GUIDELINES_TEXT =
	"Community guidelines: keep posts anonymous, kind, and supportive. Share coping ideas, small wins, or honest reflections, and avoid harassment, threats, or personal details.";

const HEART_DUMP_POST_NOTICE_TEXT =
	"Every post is shared anonymously in the community feed, so only the message content is visible to other people.";

const REFLECTION_PROMPTS = [
	"What felt steady today, even if it was small?",
	"What is one kind thing you can do for yourself next?",
	"What did you handle better than you expected?",
	"What do you need more of right now: rest, connection, or clarity?",
	"What would feel like a gentle win today?"
];

let databasePromise = null;
let cachedSessionKey = null;
let cachedSessionUserId = null;
let selectedMood = "calm";
let cachedSessionCryptoKey = null;

function createGuestSession() {
	return {
		mode: "guest",
		userId: createId("guest"),
		displayName: "Guest",
		username: null,
		loggedInAt: new Date().toISOString()
	};
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes) {
	let binary = "";
	const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

	for (const byte of source) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

function base64ToBytes(value) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes;
}

function toText(value) {
	return textDecoder.decode(value);
}

function toBytes(value) {
	return textEncoder.encode(value);
}

function createId(prefix) {
	return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

async function createUniqueUserId() {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const candidate = createId("user");
		const exists = await idbGet("users", candidate);
		if (!exists) {
			return candidate;
		}
	}

	// Extremely unlikely fallback to keep IDs unique even under repeated collisions.
	return `user_${crypto.randomUUID().replaceAll("-", "")}`;
}

// Encryption helpers (AES-GCM) using password-derived key (PBKDF2)
async function deriveKeyFromPassword(password, salt) {
	const baseKey = await crypto.subtle.importKey(
		'raw',
		toBytes(password),
		{ name: 'PBKDF2' },
		false,
		['deriveKey']
	);

	const key = await crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: toBytes(salt || ''),
			iterations: ITERATIONS,
			hash: 'SHA-256'
		},
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt']
	);

	return key;
}

function generateSaltBase64(length = 16) {
	return bytesToBase64(crypto.getRandomValues(new Uint8Array(length)));
}

async function hashPassword(password, saltBase64) {
	const baseKey = await crypto.subtle.importKey(
		"raw",
		toBytes(password),
		{ name: "PBKDF2" },
		false,
		["deriveBits"]
	);

	const bits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: toBytes(saltBase64),
			iterations: ITERATIONS,
			hash: "SHA-256"
		},
		baseKey,
		256
	);

	return bytesToBase64(new Uint8Array(bits));
}

async function verifyPassword(password, saltBase64, expectedHash) {
	const actual = await hashPassword(password, saltBase64);
	return actual === expectedHash;
}

async function exportKeyToBase64(key) {
	const raw = await crypto.subtle.exportKey('raw', key);
	return bytesToBase64(new Uint8Array(raw));
}

async function importKeyFromBase64(b64) {
	const raw = base64ToBytes(b64);
	return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function encryptString(plain, key) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, toBytes(plain));
	return { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(cipher)) };
}

async function decryptString(cipherObj, key) {
	const iv = base64ToBytes(cipherObj.iv);
	const data = base64ToBytes(cipherObj.data);
	const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
	return toText(new Uint8Array(plain));
}

async function getSessionCryptoKey() {
	if (cachedSessionCryptoKey) return cachedSessionCryptoKey;
	const session = getSession();
	if (!session) return null;
	// legacy: if a base64 key was stored in session (older versions), try to import it
	if (session.encryptionKey) {
		try {
			const key = await importKeyFromBase64(session.encryptionKey);
			cachedSessionCryptoKey = key;
			return key;
		} catch (e) {
			return null;
		}
	}

	return null;
}

function getSession() {
	const raw = localStorage.getItem(SESSION_KEY);

	if (!raw) {
		return null;
	}

	try {
		return JSON.parse(raw);
	} catch (error) {
		return null;
	}
}

async function validateStoredSession() {
	const session = getSession();

	if (!session || session.mode !== "user") {
		return session;
	}

	if (!session.userId || !session.username) {
		clearSession();
		return null;
	}

	const userById = await idbGet("users", session.userId);
	if (!userById || userById.username !== session.username) {
		clearSession();
		return null;
	}

	return session;
}

function saveSession(session) {
	localStorage.setItem(SESSION_KEY, JSON.stringify(session));
	cachedSessionKey = null;
	cachedSessionUserId = session.userId;
}

function clearSession() {
	const session = getSession();
	localStorage.removeItem(SESSION_KEY);
	cachedSessionKey = null;
	cachedSessionUserId = null;
	cachedSessionCryptoKey = null;

	if (session && session.mode === "guest" && session.userId) {
		deleteEntriesByUserId(session.userId).catch(() => {});
	}
}

function isGuestSession(session = getSession()) {
	return Boolean(session && session.mode === "guest");
}

function ensureGuestSession() {
	const session = getSession();

	if (session) {
		return session;
	}

	const guestSession = createGuestSession();
	saveSession(guestSession);
	return guestSession;
}

function activateGuestSession() {
	const guestSession = createGuestSession();
	saveSession(guestSession);
	return guestSession;
}

function getDailyMindfulnessTip() {
	const now = Date.now();
	const dayMs = 24 * 60 * 60 * 1000;

	try {
		const stored = JSON.parse(localStorage.getItem(DAILY_TIP_KEY) || "null");

		if (
			stored &&
			typeof stored.index === "number" &&
			typeof stored.timestamp === "number" &&
			now - stored.timestamp < dayMs
		) {
			return MINDFULNESS_TIPS[stored.index % MINDFULNESS_TIPS.length];
		}
	} catch (error) {
		// Fallback to a new tip when localStorage is unavailable.
	}

	const nextIndex = Math.floor(Math.random() * MINDFULNESS_TIPS.length);

	try {
		localStorage.setItem(
			DAILY_TIP_KEY,
			JSON.stringify({ index: nextIndex, timestamp: now })
		);
	} catch (error) {
		// Ignore storage write errors.
	}

	return MINDFULNESS_TIPS[nextIndex];
}

function getDailyReflectionPrompt() {
	const day = new Date().toDateString();
	let hash = 0;

	for (const character of day) {
		hash = (hash * 37 + character.charCodeAt(0)) >>> 0;
	}

	return REFLECTION_PROMPTS[hash % REFLECTION_PROMPTS.length];
}

function normalizeUsername(username) {
	return username.trim().toLowerCase();
}

function openDatabase() {
	if (databasePromise) {
		return databasePromise;
	}

	databasePromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;

			if (!db.objectStoreNames.contains("users")) {
				const users = db.createObjectStore("users", { keyPath: "userId" });
				users.createIndex("username", "username", { unique: true });
			}

			if (!db.objectStoreNames.contains("entries")) {
				const entries = db.createObjectStore("entries", { keyPath: "entryId" });
				entries.createIndex("userId", "userId", { unique: false });
				entries.createIndex("userIdKind", "userIdKind", { unique: false });
				entries.createIndex("kind", "kind", { unique: false });
				entries.createIndex("createdAt", "createdAt", { unique: false });
			}

			if (!db.objectStoreNames.contains("publicPosts")) {
				const publicPosts = db.createObjectStore("publicPosts", { keyPath: "postId" });
				publicPosts.createIndex("createdAt", "createdAt", { unique: false });
			}
		};

		request.onerror = () => reject(request.error || new Error("Unable to open MoodBloom database."));
		request.onsuccess = () => resolve(request.result);
	});

	return databasePromise;
}

// Simple IndexedDB helpers
async function idbPut(storeName, value) {
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readwrite');
		const store = tx.objectStore(storeName);
		const req = store.put(value);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function idbGetAll(storeName) {
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readonly');
		const store = tx.objectStore(storeName);
		const req = store.getAll();
		req.onsuccess = () => resolve(req.result || []);
		req.onerror = () => reject(req.error);
	});
}

async function idbGetAllByIndex(storeName, indexName, key) {
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readonly');
		const store = tx.objectStore(storeName);
		const index = store.index(indexName);
		const req = index.getAll(key);
		req.onsuccess = () => resolve(req.result || []);
		req.onerror = () => reject(req.error);
	});
}

async function idbGetFirstByIndex(storeName, indexName, key) {
	const rows = await idbGetAllByIndex(storeName, indexName, key);
	return rows.length ? rows[0] : null;
}

async function idbGetAllSorted(storeName, sortKey = 'createdAt', desc = true) {
	const items = await idbGetAll(storeName);
	items.sort((a, b) => {
		const ta = a[sortKey] || '';
		const tb = b[sortKey] || '';
		return desc ? tb.localeCompare(ta) : ta.localeCompare(tb);
	});
	return items;
}

async function idbGet(storeName, key) {
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readonly');
		const store = tx.objectStore(storeName);
		const req = store.get(key);
		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
	});
}

async function idbDelete(storeName, key) {
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readwrite');
		const store = tx.objectStore(storeName);
		const req = store.delete(key);
		req.onsuccess = () => resolve(true);
		req.onerror = () => reject(req.error);
	});
}

async function deleteEntriesByUserId(userId) {
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const tx = db.transaction("entries", "readwrite");
		const index = tx.objectStore("entries").index("userId");
		const req = index.openCursor(IDBKeyRange.only(userId));

		req.onsuccess = () => {
			const cursor = req.result;
			if (cursor) {
				cursor.delete();
				cursor.continue();
				return;
			}
			resolve(true);
		};

		req.onerror = () => reject(req.error);
	});
}

async function putUser(user) {
	await idbPut('users', user);
}

async function putEntry(entry) {
	await idbPut('entries', entry);
}

async function putPublicPost(post) {
	await idbPut('publicPosts', post);
}

function updateMindfulnessText() {
	const dailyTip = getDailyMindfulnessTip();
	const dailyTipNode = document.querySelector("[data-daily-tip]");
	const mindfulnessNode = document.querySelector("[data-mindfulness-tip]");

	if (dailyTipNode) {
		dailyTipNode.textContent = dailyTip;
	}

	if (mindfulnessNode) {
		mindfulnessNode.textContent = dailyTip;
	}
}

function updateReflectionPrompt() {
	const promptNode = document.querySelector("[data-reflection-prompt]");

	if (promptNode) {
		promptNode.textContent = getDailyReflectionPrompt();
	}
}

function getActiveSessionLabel(session = getSession()) {
	if (!session) {
		return "Not signed in";
	}

	if (isGuestSession(session)) {
		return "Guest mode";
	}

	return session.displayName || session.username || "Signed in";
}

function setNodeText(selector, value) {
	const node = document.querySelector(selector);

	if (node) {
		node.textContent = value;
	}
}

function renderSessionBar() {
	const sessionBar = document.querySelector("[data-session-bar]");

	if (!sessionBar) {
		return;
	}

	const session = getSession();
	const sessionLabel = document.createElement("span");
	sessionLabel.className = "session-identity";

	const labelText = document.createElement("strong");
	labelText.textContent = getActiveSessionLabel(session);
	sessionLabel.appendChild(labelText);

	if (session) {
		const modeText = document.createElement("span");
		modeText.textContent = isGuestSession(session) ? "preview" : "private";
		sessionLabel.appendChild(modeText);
	}

	const container = document.createElement('span');
	container.style.display = 'inline-flex';
	container.style.gap = '0.5rem';

	if (session && !isGuestSession(session)) {
		// If we don't have the in-memory crypto key, show an Unlock button
		if (!cachedSessionCryptoKey) {
			const unlockBtn = document.createElement('button');
			unlockBtn.className = 'button-small button-ghost';
			unlockBtn.textContent = 'Unlock';
			unlockBtn.type = 'button';
			unlockBtn.addEventListener('click', () => showUnlockModal(session.username));
			container.appendChild(unlockBtn);
		}

		const signOut = document.createElement('button');
		signOut.className = 'button-small button-ghost';
		signOut.type = 'button';
		signOut.textContent = 'Sign out';
		signOut.addEventListener('click', () => {
			// clear in-memory crypto key as well
			cachedSessionCryptoKey = null;
			clearSession();
			window.location.href = 'landing.html';
		});

		container.appendChild(signOut);
		sessionBar.replaceChildren(sessionLabel, container);
		return;
	}

	const action = document.createElement('a');
	action.className = 'button-small button-ghost';
	action.href = 'landing.html';
	action.textContent = 'Log in';

	sessionBar.replaceChildren(sessionLabel, action);
}

async function decryptVisibleEntries() {
	const key = await getSessionCryptoKey();
	if (!key) return;

	// Decrypt journal and mood entries rendered with data-entry-id
	const entryEls = Array.from(document.querySelectorAll('[data-entry-id]'));
	for (const el of entryEls) {
		const id = el.dataset.entryId;
		if (!id) continue;
		try {
			const entry = await idbGet('entries', id);
			if (!entry) continue;
			let text = '';
			if (entry.kind === 'journal') {
				if (entry.encrypted) {
					try {
						text = await decryptString(entry.content, key);
					} catch (e) {
						text = 'Locked - click Unlock to view';
					}
				} else {
					text = entry.content || '';
				}
			} else if (entry.kind === 'mood') {
				if (entry.encrypted) {
					try {
						text = await decryptString(entry.note, key);
					} catch (e) {
						text = 'Locked - click Unlock to view';
					}
				} else {
					text = entry.note || '';
				}
			}

			const p = el.querySelector('p');
			if (p) p.textContent = text;
		} catch (e) {
			// ignore
		}
	}
}

function showUnlockModal(username) {
	if (document.querySelector('.unlock-modal')) {
		return;
	}

	const overlay = document.createElement('div');
	overlay.className = 'unlock-modal';
	Object.assign(overlay.style, {
		position: 'fixed',
		inset: 0,
		background: 'rgba(0,0,0,0.35)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 9999
	});

	const panel = document.createElement('div');
	Object.assign(panel.style, {
		background: '#fff',
		padding: '18px',
		borderRadius: '12px',
		width: '360px',
		boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
	});

	const title = document.createElement('h3');
	title.textContent = 'Unlock private entries';
	title.style.marginTop = '0';

	const info = document.createElement('p');
	info.textContent = `Enter password for ${username}`;

	const pwd = document.createElement('input');
	pwd.type = 'password';
	pwd.placeholder = 'Password';
	Object.assign(pwd.style, {
		width: '100%',
		padding: '10px',
		margin: '8px 0',
		boxSizing: 'border-box'
	});

	const row = document.createElement('div');
	Object.assign(row.style, {
		display: 'flex',
		gap: '8px',
		justifyContent: 'flex-end',
		marginTop: '8px'
	});

	const cancel = document.createElement('button');
	cancel.className = 'button-secondary';
	cancel.textContent = 'Cancel';
	cancel.addEventListener('click', () => document.body.removeChild(overlay));

	const submit = document.createElement('button');
	submit.className = 'button';
	submit.textContent = 'Unlock';
	submit.addEventListener('click', async () => {
		const session = getSession();
		if (!session || !session.username) {
			return;
		}

		const password = pwd.value || '';
		if (!password) {
			return;
		}

		const user = await idbGet('users', session.userId);
		if (!user || user.username !== session.username || !user.passwordSalt || !user.passwordHash) {
			clearSession();
			alert('User record is missing verification data.');
			window.location.href = 'landing.html';
			return;
		}

		const ok = await verifyPassword(password, user.passwordSalt, user.passwordHash);
		if (!ok) {
			alert('Incorrect password.');
			return;
		}

		cachedSessionCryptoKey = await deriveKeyFromPassword(password, user.encryptionSalt || user.username);
		document.body.removeChild(overlay);
		renderSessionBar();
		await decryptVisibleEntries();
	});

	row.appendChild(cancel);
	row.appendChild(submit);
	panel.appendChild(title);
	panel.appendChild(info);
	panel.appendChild(pwd);
	panel.appendChild(row);
	overlay.appendChild(panel);
	document.body.appendChild(overlay);
	pwd.focus();
}

function showEditModal(entry, kind, onSaved) {
	if (document.querySelector('.edit-modal')) {
		return;
	}

	const overlay = document.createElement('div');
	overlay.className = 'edit-modal';
	Object.assign(overlay.style, {
		position: 'fixed',
		inset: 0,
		background: 'rgba(0,0,0,0.35)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 10000
	});

	const panel = document.createElement('div');
	Object.assign(panel.style, {
		background: '#fff',
		padding: '18px',
		borderRadius: '12px',
		width: '420px',
		maxWidth: '95vw',
		boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
	});

	const title = document.createElement('h3');
	title.style.marginTop = '0';
	title.textContent = kind === 'mood' ? 'Edit mood note' : 'Edit journal entry';

	const input = document.createElement('textarea');
	Object.assign(input.style, {
		width: '100%',
		minHeight: '140px',
		padding: '10px',
		boxSizing: 'border-box'
	});

	(async () => {
		let current = kind === 'mood' ? (entry.note || '') : (entry.content || '');
		if (entry.encrypted) {
			const key = await getSessionCryptoKey();
			if (key) {
				try {
					current = await decryptString(kind === 'mood' ? entry.note : entry.content, key);
				} catch (e) {
					current = '';
				}
			} else {
				current = '';
			}
		}
		input.value = current;
	})();

	const row = document.createElement('div');
	Object.assign(row.style, {
		display: 'flex',
		justifyContent: 'flex-end',
		gap: '8px',
		marginTop: '10px'
	});

	const cancel = document.createElement('button');
	cancel.className = 'button-secondary';
	cancel.textContent = 'Cancel';
	cancel.addEventListener('click', () => document.body.removeChild(overlay));

	const save = document.createElement('button');
	save.className = 'button';
	save.textContent = 'Save changes';
	save.addEventListener('click', async () => {
		const updated = input.value || '';
		const copy = Object.assign({}, entry);

		if (kind === 'mood') {
			copy.note = updated;
		} else {
			copy.content = updated;
		}

		if (entry.encrypted) {
			const key = await getSessionCryptoKey();
			if (key) {
				if (kind === 'mood') {
					copy.note = await encryptString(updated, key);
				} else {
					copy.content = await encryptString(updated, key);
				}
				copy.encrypted = true;
			}
		}

		await putEntry(copy);
		document.body.removeChild(overlay);
		if (typeof onSaved === 'function') {
			await onSaved();
		}
	});

	row.appendChild(cancel);
	row.appendChild(save);
	panel.appendChild(title);
	panel.appendChild(input);
	panel.appendChild(row);
	overlay.appendChild(panel);
	document.body.appendChild(overlay);
	input.focus();
}

function renderMoodPageCopy() {
	const session = getSession();
	const guestNotice = document.querySelector("[data-guest-notice]");

	if (!guestNotice) {
		return;
	}

	if (session && !isGuestSession(session)) {
		guestNotice.textContent = "Your check-ins are saved to your private account and shown only to you.";
		return;
	}

	guestNotice.textContent = "Guest mode lets you preview the mood check-in flow locally. Log in to save mood history privately.";
}

function renderJournalPageCopy() {
	const session = getSession();
	const journalNotice = document.querySelector("[data-journal-guest]");

	if (!journalNotice) {
		return;
	}

	if (session && !isGuestSession(session)) {
		journalNotice.textContent = "Your journal entries are encrypted for your private account and remain visible only to you.";
		return;
	}

	journalNotice.textContent = "Guest mode lets you preview the journal. Log in to save entries privately and keep a history.";
}

function renderMessagePageCopy() {
	setNodeText("[data-heart-guidelines]", HEART_DUMP_GUIDELINES_TEXT);
	setNodeText("[data-heart-post-notice]", HEART_DUMP_POST_NOTICE_TEXT);
	setNodeText("[data-heart-empty]", "No anonymous posts yet. Share the first supportive message when you are ready.");
}

function renderPageGreeting() {
	const session = getSession();
	const page = document.body?.dataset.page;
	const greeting = document.querySelector("[data-page-greeting]");

	if (!greeting) {
		return;
	}

	if (!session) {
		return;
	}

	if (page === "home") {
		greeting.textContent = isGuestSession(session)
			? "Guest mood check-in"
			: `Welcome back, ${session.displayName || session.username || "friend"}.`;
		return;
	}

	if (page === "journal") {
		greeting.textContent = isGuestSession(session)
			? "Guest journal preview"
			: `Private journal for ${session.displayName || session.username || "you"}.`;
	}
}

function showLoginMessage(message, state = "info") {
	const loginMessage = document.querySelector("[data-login-message]");

	if (!loginMessage) {
		return;
	}

	loginMessage.textContent = message;
	loginMessage.setAttribute("data-state", state);
}

function goToDashboard() {
	window.location.href = "dashboard.html";
}

function initLandingPage() {
	const guestButton = document.querySelector("[data-guest-mode]");
	const loginForm = document.querySelector("[data-login-form]");
	const usernameInput = document.querySelector("[data-login-username]");
	const passwordInput = document.querySelector("[data-login-password]");

	if (guestButton) {
		guestButton.addEventListener("click", () => {
			activateGuestSession();
			goToDashboard();
		});
	}

	if (!loginForm) {
		return;
	}

	loginForm.addEventListener("submit", async (event) => {
		event.preventDefault();

		const username = normalizeUsername(usernameInput?.value || "");
		const password = passwordInput?.value || "";

		if (!username || !password) {
			showLoginMessage("Enter username and password to continue.", "warning");
			return;
		}

		let user = await idbGetFirstByIndex("users", "username", username);

		if (!user) {
			const passwordSalt = generateSaltBase64();
			const encryptionSalt = generateSaltBase64();
			const passwordHash = await hashPassword(password, passwordSalt);
			const userId = await createUniqueUserId();

			user = {
				userId,
				username,
				displayName: username,
				passwordSalt,
				passwordHash,
				encryptionSalt,
				createdAt: new Date().toISOString()
			};

			await putUser(user);
		} else {
			if (user.passwordSalt && user.passwordHash) {
				const ok = await verifyPassword(password, user.passwordSalt, user.passwordHash);
				if (!ok) {
					showLoginMessage("Invalid username or password.", "error");
					return;
				}
			} else {
				const passwordSalt = generateSaltBase64();
				user.passwordSalt = passwordSalt;
				user.passwordHash = await hashPassword(password, passwordSalt);
				user.encryptionSalt = user.encryptionSalt || generateSaltBase64();
				await putUser(user);
			}
		}

		try {
			const key = await deriveKeyFromPassword(password, user.encryptionSalt || username);
			cachedSessionCryptoKey = key;
		} catch (e) {
			cachedSessionCryptoKey = null;
		}

		const userSession = {
			mode: "user",
			userId: user.userId,
			displayName: user.displayName || user.username,
			username: user.username,
			loggedInAt: new Date().toISOString()
		};

		saveSession(userSession);
		showLoginMessage("Signed in successfully. Redirecting...", "success");
		window.setTimeout(goToDashboard, 250);
	});
}

function initMoodPage() {
	renderMoodPageCopy();
	const form = document.querySelector('[data-mood-form]');
	const note = document.querySelector('[data-mood-note]');
	const buttons = Array.from(document.querySelectorAll('[data-mood-option]'));
	const feedback = document.querySelector('[data-mood-feedback]');

	function renderMoodResponse(moodKey) {
		if (!feedback) {
			return;
		}

		const message = MOOD_MESSAGES[moodKey] || "Thank you for checking in. Keep going one gentle step at a time.";
		const plan = MOOD_PLANS[moodKey];

		if (!plan) {
			feedback.textContent = message;
			feedback.setAttribute('data-state', 'success');
			return;
		}

		const actions = plan.actions
			.map((action) => `<li>${action}</li>`)
			.join('');

		feedback.innerHTML = `<strong>${plan.title}</strong><p>${message}</p><p>${plan.body}</p><ul>${actions}</ul>`;
		feedback.setAttribute('data-state', 'success');
	}

	buttons.forEach((btn) => {
		btn.addEventListener('click', () => {
			buttons.forEach((b) => {
				b.classList.remove('is-selected');
				b.setAttribute('aria-pressed', 'false');
			});
			btn.classList.add('is-selected');
			btn.setAttribute('aria-pressed', 'true');
			selectedMood = btn.dataset.moodOption;
		});
	});

	async function loadMoodHistory() {
		const node = document.querySelector('[data-mood-history]');
		if (!node) return;
		const session = getSession();
		const sessionKey = await getSessionCryptoKey();
		let items = [];
		const active = session || ensureGuestSession();
		items = await idbGetAllByIndex('entries', 'userId', active.userId);
		items = items.filter((i) => i.kind === 'mood');
		node.replaceChildren();
		for (const it of items) {
			let noteText = it.note || '';
			if (it.encrypted && sessionKey) {
				try {
					noteText = await decryptString(it.note, sessionKey);
				} catch (e) {
							noteText = 'Locked — click Unlock to view';
				}
			}
			const el = document.createElement('div');
			el.className = 'entry-card';
			el.dataset.entryId = it.entryId || '';
			const when = new Date(it.createdAt).toLocaleString();
			el.innerHTML = `<strong>${it.mood} · ${when}</strong><p>${noteText}</p><div class="entry-actions"><button class="button-small edit-entry">Edit</button><button class="button-small button-secondary delete-entry">Delete</button></div>`;
			node.appendChild(el);

			const editBtn = el.querySelector('.edit-entry');
			const delBtn = el.querySelector('.delete-entry');

			if (editBtn) {
				editBtn.addEventListener('click', () => showEditModal(it, 'mood', loadMoodHistory));
			}

			if (delBtn) {
				delBtn.addEventListener('click', async () => {
					if (!confirm('Delete this mood entry?')) return;
					await idbDelete('entries', it.entryId);
					await loadMoodHistory();
				});
			}
		}
	}

	if (form) {
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			const session = getSession() || ensureGuestSession();
			const entry = {
				entryId: createId('entry'),
				userId: session.userId,
				kind: 'mood',
				mood: selectedMood,
				note: note?.value || '',
				createdAt: new Date().toISOString()
			};
			const sessionKey = await getSessionCryptoKey();
			if (sessionKey && entry.note) {
				try {
					entry.note = await encryptString(entry.note, sessionKey);
					entry.encrypted = true;
				} catch (e) {
					// fallback to plaintext
				}
			}
			await putEntry(entry);
			renderMoodResponse(selectedMood);
			note.value = '';
			await loadMoodHistory();
		});
	}

	const initiallySelected = buttons.find((button) => button.dataset.moodOption === selectedMood);
	if (initiallySelected) {
		initiallySelected.classList.add('is-selected');
		initiallySelected.setAttribute('aria-pressed', 'true');
	}

	loadMoodHistory();
}

function initJournalPage() {
	renderJournalPageCopy();

	const form = document.querySelector('[data-journal-form]');
	const input = document.querySelector('[data-journal-input]');
	const feedback = document.querySelector('[data-journal-feedback]');
	const listNode = document.querySelector('[data-journal-list]');

	async function loadJournalList() {
		if (!listNode) return;
		const session = getSession();
		const sessionKey = await getSessionCryptoKey();
		let items = [];
		const active = session || ensureGuestSession();
		items = await idbGetAllByIndex('entries', 'userId', active.userId);
		items = items.filter((i) => i.kind === 'journal');
		items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
		listNode.replaceChildren();
		for (const it of items) {
			let contentText = it.content || '';
			if (it.encrypted && sessionKey) {
				try {
					contentText = await decryptString(it.content, sessionKey);
				} catch (e) {
					contentText = 'Locked — click Unlock to view';
				}
			}
			const el = document.createElement('div');
			el.className = 'entry-card';
			el.dataset.entryId = it.entryId || '';
			const when = new Date(it.createdAt).toLocaleString();
			el.innerHTML = `<strong>${when}</strong><p>${contentText}</p><div class="entry-actions"><button class="button-small edit-entry">Edit</button><button class="button-small button-secondary delete-entry">Delete</button></div>`;
			listNode.appendChild(el);

			const editBtn = el.querySelector('.edit-entry');
			const delBtn = el.querySelector('.delete-entry');

			if (editBtn) {
				editBtn.addEventListener('click', () => showEditModal(it, 'journal', loadJournalList));
			}

			if (delBtn) {
				delBtn.addEventListener('click', async () => {
					if (!confirm('Delete this journal entry?')) return;
					await idbDelete('entries', it.entryId);
					await loadJournalList();
				});
			}
		}
	}

	if (form) {
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			const session = getSession() || ensureGuestSession();
			const entry = {
				entryId: createId('entry'),
				userId: session.userId,
				kind: 'journal',
				content: input?.value || '',
				createdAt: new Date().toISOString()
			};
			const sessionKey = await getSessionCryptoKey();
			if (sessionKey && entry.content) {
				try {
					entry.content = await encryptString(entry.content, sessionKey);
					entry.encrypted = true;
				} catch (e) {
					// fallback to plaintext
				}
			}
			await putEntry(entry);
			if (feedback) {
				feedback.textContent = 'Journal saved.';
				feedback.setAttribute('data-state', 'success');
			}
			if (input) input.value = '';
			await loadJournalList();
		});
	}

	loadJournalList();
}
function initMessagePage() {
	renderMessagePageCopy();

	const form = document.querySelector('[data-heart-form]');
	const input = document.querySelector('[data-heart-input]');
	const feedback = document.querySelector('[data-heart-feedback]');
	const listNode = document.querySelector('[data-heart-list]');
	const emptyNode = document.querySelector('[data-heart-empty]');

	async function loadPosts() {
		if (!listNode) return;
		const items = await idbGetAllSorted('publicPosts');
		listNode.replaceChildren();
		if (!items.length && emptyNode) {
			emptyNode.textContent = 'No anonymous posts yet. Share the first supportive message when you are ready.';
		}
		items.forEach((p) => {
			const el = document.createElement('div');
			el.className = 'message-card';
			el.dataset.postId = p.postId || '';
			const when = new Date(p.createdAt).toLocaleString();
			el.innerHTML = `<strong>${when}</strong><p>${p.content}</p>`;
			listNode.appendChild(el);
		});
	}

	if (form) {
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			const text = (input?.value || '').trim();
			if (!text) {
				if (feedback) {
					feedback.textContent = 'Enter a message before posting.';
					feedback.setAttribute('data-state', 'warning');
				}
				return;
			}

			for (const re of HEART_DUMP_BLOCKED_PATTERNS) {
				if (re.test(text)) {
					if (feedback) {
						feedback.textContent = 'Your post appears to contain disallowed language.';
						feedback.setAttribute('data-state', 'error');
					}
					return;
				}
			}

			const post = {
				postId: createId('post'),
				content: text,
				createdAt: new Date().toISOString()
			};
			await putPublicPost(post);
			if (feedback) {
				feedback.textContent = 'Posted anonymously.';
				feedback.setAttribute('data-state', 'success');
			}
			if (input) input.value = '';
			await loadPosts();
		});
	}

	loadPosts();
}

async function initDbPage() {
	const output = document.getElementById('db-output');
	if (!output) return;
	output.innerHTML = '<p>Loading database...</p>';
	try {
		const users = await idbGetAll('users');
		const entries = await idbGetAll('entries');
		const posts = await idbGetAll('publicPosts');
		const key = await getSessionCryptoKey();

		function renderTable(title, arr, fields) {
			const sec = document.createElement('div');
			sec.style.marginBottom = '1rem';
			const h = document.createElement('h3');
			h.textContent = `${title} (${arr.length})`;
			sec.appendChild(h);
			const pre = document.createElement('pre');
			pre.style.whiteSpace = 'pre-wrap';
			pre.textContent = JSON.stringify(arr.map((r) => {
				const copy = Object.assign({}, r);
				// If encrypted content and we have key, try to decrypt for display
				if (copy.encrypted && key) {
					if (copy.content) {
						try { copy.content = '[decrypted]'; } catch(e) { /* ignore */ }
					}
					if (copy.note) {
						try { copy.note = '[decrypted]'; } catch(e) { /* ignore */ }
					}
				}
				return copy;
			}), null, 2);
			sec.appendChild(pre);
			return sec;
		}

		output.replaceChildren();
		output.appendChild(renderTable('Users', users));
		output.appendChild(renderTable('Entries', entries));
		output.appendChild(renderTable('Public Posts', posts));
	} catch (e) {
		output.innerHTML = '<p>Unable to read database.</p>';
	}
}
function initDashboardPage() {
	return;
}

async function initApp() {
	const page = document.body?.dataset.page;
	const validSession = await validateStoredSession();

	if (page !== "landing" && !validSession) {
		window.location.href = "landing.html";
		return;
	}

	updateMindfulnessText();
	updateReflectionPrompt();
	renderSessionBar();
	renderPageGreeting();

	if (page === "landing") {
	initLandingPage();
		return;
	}

	if (page === "home") {
		initMoodPage();
		return;
	}

	if (page === "journal") {
		initJournalPage();
		return;
	}

	if (page === "message") {
		initMessagePage();
		return;
	}

	if (page === "dashboard") {
		initDashboardPage();
	}

	if (page === "db") {
		initDbPage();
		return;
	}
}

document.addEventListener("DOMContentLoaded", () => {
	initApp();
});
