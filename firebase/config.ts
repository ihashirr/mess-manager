import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
	apiKey: "AIzaSyA7tFkWlw6HmsjgcJhp-mLri_WXSDGO0To",
	authDomain: "curious-furnace-471522-u0.firebaseapp.com",
	projectId: "curious-furnace-471522-u0",
	storageBucket: "curious-furnace-471522-u0.firebasestorage.app",
	messagingSenderId: "1060484408053",
	appId: "1:1060484408053:web:c27a24a73a776ab0be1bbc",
	measurementId: "G-HPQW993MR7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export default app;
