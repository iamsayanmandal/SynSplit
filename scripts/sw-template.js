importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "{{VITE_FIREBASE_API_KEY}}",
    authDomain: "{{VITE_FIREBASE_AUTH_DOMAIN}}",
    projectId: "{{VITE_FIREBASE_PROJECT_ID}}",
    storageBucket: "{{VITE_FIREBASE_STORAGE_BUCKET}}",
    messagingSenderId: "{{VITE_FIREBASE_MESSAGING_SENDER_ID}}",
    appId: "{{VITE_FIREBASE_APP_ID}}",
    measurementId: "{{VITE_FIREBASE_MEASUREMENT_ID}}"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // If the message already has a notification object, the SDK will display it automatically.
    // We only call showNotification if there's no notification field (i.e., data-only message).
    if (!payload.notification) {
        const notificationTitle = payload.data?.title || 'SynSplit Update';
        const notificationOptions = {
            body: payload.data?.body || '',
            icon: '/icon.svg'
        };
        self.registration.showNotification(notificationTitle, notificationOptions);
    }
});
