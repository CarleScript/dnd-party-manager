import { config } from './config/env.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import app from './app.js';
// import { initDB } from './config/db.js';
import { partyManager } from './services/PartyManager.js';
import setupPlayerListSocket from './sockets/playerList.js';

async function startServer() {
    try {
        // const db = await initDB();

        const server = createServer(app);

        const io = new Server(server, {
            connectionStateRecovery: {}
        });

        // setupSockets(io, db);
        setupPlayerListSocket(io, partyManager);

        const PORT = config.port;
        server.listen(PORT, () => {
            console.log(`server is running at http://localhost:${PORT}`);
        });

        const shutdown = (signal) => {
            console.log(`signal ${signal} received, shutting down...`);
            io.close(() => {
                console.log('Server shut down gracefully');
                process.exit(0);
            });
            setTimeout(() => {
                console.error('Shutdown timed out, some connections did not close in time, forcing exit...');
                process.exit(1);
            }, 5000).unref();
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

startServer();