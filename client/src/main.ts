import "./scss/home.scss";
import "./scss/game.scss";
import { Game } from "./game/game";
import { UiManager } from "./ui";
import { Application } from "pixi.js";
import { getElem } from "./utils";
import { SettingsManager } from "./settings";

export class App {
    settings = new SettingsManager();
    uiManager = new UiManager(this);
    pixi = new Application();
    game = new Game(this);

    async init(): Promise<void> {
        await this.pixi.init({
            canvas: getElem<HTMLCanvasElement>("#game-canvas"),
            resizeTo: window,
            resolution: window.devicePixelRatio ?? 1,
            antialias: true,
            preference: "webgl",
            background: 0x000000
        });
        this.pixi.canvas.addEventListener("contextmenu", e => {
            e.preventDefault();
        });

        await this.game.init();

        app.uiManager.playButton.disabled = false;
    }
}

const app = new App();

await app.init();
