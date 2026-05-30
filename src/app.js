import { config } from './config/env.js';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const publicPath = join(__dirname, '../public');
app.use(express.static(publicPath));

app.get('/', (req, res) => {
    res.sendFile(join(publicPath, 'index.html'));
});

app.get('/api/config', (req, res) => {
    res.json({
        storageKey: config.storageKey,
        maxNameLength: config.maxNameLength,
        maxInitDigits: config.maxInitDigits,
        maxHpDigits: config.maxHpDigits,
        allowedFileMimeType: config.allowedFileMimeType,
        maxFileSizeMb: config.maxFileSizeMb
    });
});

app.use(express.json());

export default app;