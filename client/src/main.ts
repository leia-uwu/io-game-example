import { Game } from "./game/game";
import "./scss/style.scss";
import { GameConstants } from "../../common/src/constants";
import { getElem } from "./utils";

const game = new Game();

const playButton = getElem("#play-btn");
const nameInput = getElem("#name-input") as HTMLInputElement;
nameInput.maxLength = GameConstants.nameMaxLength;

playButton.addEventListener("click", () => {
    game.connect(`ws://localhost:8000/play?name=${encodeURIComponent(nameInput.value)}`);
});
