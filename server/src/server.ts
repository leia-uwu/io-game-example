import { App, DEDICATED_COMPRESSOR_256KB } from "uWebSockets.js";
import { GameConstants } from "../../common/src/constants";
import { GameBitStream } from "../../common/src/net";
import { type Player } from "./objects/player";
import { Game } from "./game";

const port = 8000;

const app = App();

export interface PlayerData {
    name: string
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

    /**
     * Upgrade the connection to WebSocket.
     */
    upgrade(res, req, context) {
        /* eslint-disable-next-line @typescript-eslint/no-empty-function */
        res.onAborted((): void => { });

        const searchParams = new URLSearchParams(req.getQuery());

        //
        // Name
        //
        let name = searchParams.get("name");
        name = decodeURIComponent(name ?? "").trim();

        if (name.length > GameConstants.nameMaxLength || name.length === 0) name = GameConstants.defaultName;

        //
        // Upgrade the connection
        //
        const userData: PlayerData = {
            gameObject: undefined,
            name
        };
        res.upgrade(
            userData,
            req.getHeader("sec-websocket-key"),
            req.getHeader("sec-websocket-protocol"),
            req.getHeader("sec-websocket-extensions"),
            context
        );
    },

    open(socket) {
        const userData = socket.getUserData();
        console.log(`"${userData.name}" joined game`);

        game.addPlayer(socket);
    },

    message(socket, message) {
        const stream = new GameBitStream(message);
        try {
            const player = socket.getUserData().gameObject;
            if (player === undefined) return;
            player.processPacket(stream)
        } catch (e) {
            console.warn("Error parsing message:", e);
        }
    },

    close(socket) {
        const player = socket.getUserData();
        console.log(`"${player.name}" left game`);
        if (player.gameObject) game.removePlayer(player.gameObject);
    }
});
