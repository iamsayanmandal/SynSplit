importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDTHZ2WD6ZfTcqksA8FYzTzv_wYxCUk-sQ",
    authDomain: "sayansplit.firebaseapp.com",
    projectId: "sayansplit",
    storageBucket: "sayansplit.firebasestorage.app",
    messagingSenderId: "637535115717",
    appId: "1:637535115717:web:950dcbf9c42bef9ef4d3ac",
    measurementId: "G-85XPN1D7KX"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon.svg'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
