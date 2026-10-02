// ===== FIREBASE CONFIG =====
// This connects the website to your Firebase project's database.
// (These values are not secrets - access is controlled by the Firestore Security Rules.)
const firebaseConfig = {
  apiKey: "AIzaSyAWEJAAer5CMUpPIm23jsw9ansKDI9dbJE",
  authDomain: "welcome-party-site-58420.firebaseapp.com",
  projectId: "welcome-party-site-58420",
  storageBucket: "welcome-party-site-58420.firebasestorage.app",
  messagingSenderId: "69591483617",
  appId: "1:69591483617:web:8a18f46d667d7fb4c5e3a0"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Venue / university Wi-Fi often blocks Firestore's streaming connection.
// This lets the SDK fall back to long-polling automatically instead of hanging.
db.settings({ experimentalAutoDetectLongPolling: true, merge: true });
