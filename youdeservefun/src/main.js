// Import necessary functions from Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-fun-wall';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- App Initialization ---
let app, db, auth, userId;
let reasonsCache = [];
let isFetching = false;

// --- DOM Elements ---
const loader = document.getElementById('loader');
const reasonText = document.getElementById('reason-text');
const anotherReasonBtn = document.getElementById('another-reason-btn');
const reasonForm = document.getElementById('reason-form');
const reasonInput = document.getElementById('reason-input');
const submitBtn = document.getElementById('submit-btn');
const submitBtnText = document.getElementById('submit-btn-text');
const messageModal = document.getElementById('message-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const closeModalBtn = document.getElementById('close-modal-btn');
const userIdDisplay = document.getElementById('user-id-display');

/**
 * Shows a modal with a custom title and message.
 * @param {string} title - The title for the modal.
 * @param {string} message - The message content for the modal.
 */
function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    messageModal.style.display = 'flex';
}

/**
 * Initializes Firebase and sets up authentication.
 */
async function initializeFirebase() {
    try {
        if (!firebaseConfig.apiKey) {
            throw new Error("Firebase configuration is missing.");
        }

        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        setLogLevel('debug');
        await authenticateUser();
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        reasonText.textContent = "Could not connect to the Fun Wall. Please check configuration and try again.";
        loader.style.display = 'none';
        reasonText.style.display = 'block';
    }
}

/**
 * Authenticates the user either with a provided token or anonymously.
 */
async function authenticateUser() {
     onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            userIdDisplay.textContent = userId;
            await fetchAndDisplayReasons();
        } else {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Authentication error:", error);
                showModal("Authentication Error", "Could not authenticate. Please check your Firebase settings (Authorized Domains, Anonymous Sign-in) and refresh the page.");
            }
        }
    });
}

/**
 * Fetches all reasons from Firestore and stores them in a local cache.
 */
async function fetchAndDisplayReasons() {
    if (isFetching || !db) return;
    isFetching = true;
    loader.style.display = 'block';
    reasonText.style.display = 'none';

    try {
        const reasonsCollection = collection(db, `/artifacts/${appId}/public/data/reasons`);
        const querySnapshot = await getDocs(reasonsCollection);
        reasonsCache = [];
        querySnapshot.forEach((doc) => {
            reasonsCache.push(doc.data().reason);
        });
        displayRandomReason();
    } catch (error) {
        console.error("Error fetching reasons: ", error);
        reasonText.textContent = "Could not fetch reasons. Maybe you're the first to add one!";
    } finally {
        loader.style.display = 'none';
        reasonText.style.display = 'block';
        isFetching = false;
    }
}

/**
 * Displays a random reason from the cache.
 */
function displayRandomReason() {
    if (reasonsCache.length === 0) {
        reasonText.textContent = "No reasons yet. Be the first to share why you deserve fun!";
        return;
    }
    const randomIndex = Math.floor(Math.random() * reasonsCache.length);
    const randomReason = reasonsCache[randomIndex];
    
    reasonText.classList.remove('fade-in');
    void reasonText.offsetWidth; 
    reasonText.textContent = `"${randomReason}"`;
    reasonText.classList.add('fade-in');
}

/**
 * Handles the submission process.
 * @param {Event} e - The form submission event.
 */
async function handleSubmission(e) {
    e.preventDefault();
    const reason = reasonInput.value.trim();
    if (reason.length < 5) {
        showModal("Hold on!", "Please share a little more in your reason.");
        return;
    }
    if (!db) {
        showModal("Error", "Database not connected. Please try again later.");
        return;
    }

    // --- Start loading state ---
    submitBtn.disabled = true;
    submitBtnText.innerHTML = '<span class="btn-spinner"></span>Sharing...';

    // --- Directly add to Firestore ---
    try {
        const reasonsCollection = collection(db, `/artifacts/${appId}/public/data/reasons`);
        await addDoc(reasonsCollection, {
            reason: reason,
            createdAt: serverTimestamp(),
            authorId: userId
        });
        
        reasonsCache.push(reason);
        reasonInput.value = '';
        showModal("Thank You!", "Your reason has been added to the wall for others to see. We hope it brightens someone's day.");

    } catch (error) {
        console.error("Error adding document: ", error);
        showModal("Error", "Sorry, we couldn't save your reason. Please try again.");
    } finally {
        submitBtn.disabled = false;
        submitBtnText.innerHTML = 'Share My Reason';
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', initializeFirebase);
anotherReasonBtn.addEventListener('click', displayRandomReason);
reasonForm.addEventListener('submit', handleSubmission);
closeModalBtn.addEventListener('click', () => {
    messageModal.style.display = 'none';
});
