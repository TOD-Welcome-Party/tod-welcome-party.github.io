// ===== FIREBASE CONFIG =====
// This connects the website to your Firebase project's database.
// (These values are not secrets - access is controlled by the Firestore Security Rules.)
const firebaseConfig = {
  apiKey: "AIzaSyCSn69GMg96JXPgsMjDy3kZINmLbHQlWtA",
  authDomain: "welcome-party-bdf41.firebaseapp.com",
  projectId: "welcome-party-bdf41",
  storageBucket: "welcome-party-bdf41.firebasestorage.app",
  messagingSenderId: "861528089296",
  appId: "1:861528089296:web:8cb65540aaa79b38e474d5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Venue / university Wi-Fi often blocks Firestore's streaming connection.
// This lets the SDK fall back to long-polling automatically instead of hanging.
db.settings({ experimentalAutoDetectLongPolling: true, merge: true });
