import { config } from './config/env.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import app from './app.js';
// import { initDB } from './config/db.js';
import setupPlayerListSocket from './sockets/playerList.js';

async function startServer() {
    try {
        // const db = await initDB();

        const server = createServer(app);

        const io = new Server(server, {
            connectionStateRecovery: {}
        });

        // setupSockets(io, db);
        setupPlayerListSocket(io);

        const PORT = config.port;
        server.listen(PORT, () => {
            console.log(`erver is running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

startServer();