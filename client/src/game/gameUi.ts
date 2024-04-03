import { type GameOverPacket } from "../../../common/src/packets/gameOverPacket";
import { getElem } from "../utils";
import { type Game } from "./game";

export class GameUi {
    constructor(public game: Game) { }

    playAgainButton = getElem("#play-again-btn");
    gameOverScreen = getElem("#game-over-screen");
    gameOverKills = getElem("#game-over-kill-count");

    setupUi() {
        this.playAgainButton.addEventListener("click", () => {
            this.game.endGame();
            this.gameOverScreen.style.display = "none";
        });
    }

    showGameOverScreen(packet: GameOverPacket): void {
        this.gameOverScreen.style.display = "block";
        this.gameOverKills.innerText = `Kills: ${packet.kills}`;
    }
}
