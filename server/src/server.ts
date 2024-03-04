import { App, DEDICATED_COMPRESSOR_256KB } from "uWebSockets.js";
import { GameBitStream } from "../../common/src/net";
import { type Player } from "./objects/player";
import { Game } from "./game";

const port = 8000;

const app = App();

export interface PlayerData {
    joined: boolean
    /**
     * The player socket game object
     */
    gameObject?: Player
}

app.listen(port, () => {
    console.log(`Websocket server running on https://localhost:${port}`);
});

const game = new Game();

app.ws<PlayerData>("/play", {
    compression: DEDICATED_COMPRESSOR_256KB,
    idleTimeout: 30,

    open(socket) {
        setTimeout(() => {
            if (!socket.getUserData().joined) {
                socket.close();
            }
        }, 1000);
        game.addPlayer(socket);
    },

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
