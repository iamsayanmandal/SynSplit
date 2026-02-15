const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
const templatePath = path.resolve(__dirname, 'sw-template.js');
const outputPath = path.resolve(__dirname, '../public/firebase-messaging-sw.js');

// Simple .env parser
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        envVars[key.trim()] = value.trim().replace(/['"]/g, ''); // Remove quotes if any
    }
});

let template = fs.readFileSync(templatePath, 'utf8');

// Replace placeholders
const keys = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_MEASUREMENT_ID'
];

keys.forEach(key => {
    const value = envVars[key] || process.env[key];
    if (value) {
        template = template.replace(`{{${key}}}`, value);
    } else {
        console.warn(`Warning: Missing environment variable ${key}`);
    }
});

fs.writeFileSync(outputPath, template);
console.log('Generated public/firebase-messaging-sw.js from template');
