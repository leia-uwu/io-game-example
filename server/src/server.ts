import { App, type HttpResponse, SSLApp } from "uWebSockets.js";
import { GameBitStream } from "../../common/src/net";
import { type Player } from "./objects/player";
import { Game } from "./game";
import { Config } from "./config";

// Initialize the server
const app = Config.ssl
    ? SSLApp({
        key_file_name: Config.ssl.keyFile,
        cert_file_name: Config.ssl.certFile
    })
    : App();

export interface PlayerData {
    joined: boolean
    /**
     * The player socket game object
     */
    gameObject?: Player
}

app.listen(Config.host, Config.port, () => {
    console.log(`Websocket server running on ${Config.host}:${Config.port}`);
});

const game = new Game();

/**
 * Apply CORS headers to a response.
 * @param res The response sent by the server.
 */
function cors(res: HttpResponse): void {
    res.writeHeader("Access-Control-Allow-Origin", "*")
        .writeHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        .writeHeader("Access-Control-Allow-Headers", "origin, content-type, accept, x-requested-with")
        .writeHeader("Access-Control-Max-Age", "3600");
}

app.get("/server_info", (res) => {
    cors(res);
    const response = {
        playerCount: game.players.size
    };
    res.cork(() => {
        res.writeHeader("Content-Type", "application/json").end(JSON.stringify(response));
    });
});

app.ws<PlayerData>("/play", {
    idleTimeout: 30,

    open(socket) {
        // disconnect players that didn't send a join packet after 1 second
        setTimeout(() => {
            if (!socket.getUserData().joined) {
                socket.close();
            }
        }, 1000);
        socket.getUserData().gameObject = game.addPlayer(socket);
    },

    /**
     * Handle packets
     */
    message(socket, message) {
        const stream = new GameBitStream(message);
        try {
            const player = socket.getUserData().gameObject;
            if (player === undefined) return;
            player.processPacket(stream);
        } catch (e) {
            console.warn("Error parsing message:", e);
        }
    },

    close(socket) {
        const player = socket.getUserData();
        if (player.gameObject) game.removePlayer(player.gameObject);
    }
});
