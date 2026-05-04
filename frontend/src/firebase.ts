import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDTnKwNioeoz6tunEF-IwQDY4AlQGTnYio",
  authDomain: "wastemanagementsimulator-fb69e.firebaseapp.com",
  projectId: "wastemanagementsimulator-fb69e",
  storageBucket: "wastemanagementsimulator-fb69e.firebasestorage.app",
  messagingSenderId: "447472888889",
  appId: "1:447472888889:web:93f25788ed5b435e35f1e8",
  measurementId: "G-DMP9J9JDYB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export { app, analytics };
