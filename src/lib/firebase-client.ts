// src/lib/firebase-client.ts — Firebase Client SDK initialization (browser only)
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAiOxk0AFCOqDJbIYJ36a_TDTDmE5dOB0s",
  authDomain: "desk-rpg.firebaseapp.com",
  databaseURL: "https://desk-rpg-default-rtdb.firebaseio.com",
  projectId: "desk-rpg",
  storageBucket: "desk-rpg.firebasestorage.app",
  messagingSenderId: "379331761481",
  appId: "1:379331761481:web:9f0de3dfe6ce1abd3ff698",
  measurementId: "G-M45C3K836Y",
};

// Prevent re-initialization in HMR / multiple imports
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const firebaseAuth = getAuth(app);
export default app;
