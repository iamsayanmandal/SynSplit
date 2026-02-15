import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, '../.env');
const templatePath = resolve(__dirname, 'sw-template.js');
const outputPath = resolve(__dirname, '../public/firebase-messaging-sw.js');

// Simple .env parser
let envVars = {};
if (process.env.VITE_FIREBASE_API_KEY) {
    // If running in environment where vars are already set (e.g. CI/CD)
    envVars = process.env;
} else {
    try {
        const envContent = readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                envVars[key.trim()] = value.trim().replace(/['"]/g, ''); // Remove quotes if any
            }
        });
    } catch (e) {
        console.warn('No .env file found, relying on process.env');
        envVars = process.env;
    }
}

let template = readFileSync(templatePath, 'utf8');

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

writeFileSync(outputPath, template);
console.log('Generated public/firebase-messaging-sw.js from template');
