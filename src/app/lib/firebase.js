// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCTbmXB3M2Oboudv893bFOJlvfu3HUaNq4",
  authDomain: "gymadmin-1fbc7.firebaseapp.com",
  projectId: "gymadmin-1fbc7",
  storageBucket: "gymadmin-1fbc7.firebasestorage.app",
  messagingSenderId: "936861914879",
  appId: "1:936861914879:web:669fa58017c94e15b6deca",
  measurementId: "G-BQEGTVGV9S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };