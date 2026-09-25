// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBFqfwnMb0egXSVfwePRFM4wEopb4TkIbo",
  authDomain: "fila-lancheria.firebaseapp.com",
  projectId: "fila-lancheria",
  storageBucket: "fila-lancheria.firebasestorage.app",
  messagingSenderId: "155616836208",
  appId: "1:155616836208:web:565e994a5dba5f7be352b5",
  measurementId: "G-1FM04DSJ60"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };