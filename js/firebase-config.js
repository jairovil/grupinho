// =========================================================
// Substitua os valores abaixo pelos dados do SEU projeto Firebase.
// Painel Firebase > Configurações do projeto > Seus apps > SDK setup.
// =========================================================
const firebaseConfig = {
  apiKey: "AIzaSyBdwXJmMwYTk1YJEbVg8ciPKZ9VhjJ_WEY",
  authDomain: "grupinho-bb7a1.firebaseapp.com",
  projectId: "grupinho-bb7a1",
  storageBucket: "grupinho-bb7a1.firebasestorage.app",
  messagingSenderId: "938520648646",
  appId: "1:938520648646:web:cf2d28012626a28889f0c7"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();