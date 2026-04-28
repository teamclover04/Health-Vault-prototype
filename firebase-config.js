const firebaseConfig = {
  apiKey: "AIzaSyBvPa7WnBCRgBuRW_-oDmEgCG4qNie5OJ8",
  authDomain: "health-vault-43a60.firebaseapp.com",
  projectId: "health-vault-43a60",
  storageBucket: "health-vault-43a60.firebasestorage.app",
  messagingSenderId: "929732559067",
  appId: "1:929732559067:web:836d673519378db4214cfe",
  measurementId: "G-736S4LSPVZ"
};

// Initialize Firebase once the libraries load
setTimeout(() => {
    if (window.initializeApp) {
        const app = window.initializeApp(firebaseConfig);
        window.db = window.getFirestore(app);
        if (window.getStorage) {
            window.storage = window.getStorage(app);
        }
        console.log("Firebase initialized");
    } else {
        console.warn("Firebase not initialized. Please configure firebase-config.js");
    }
}, 500); // Give CDN time to load
