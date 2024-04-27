import { GameConstants } from "../../common/src/constants";
import { ClassDefs } from "../../common/src/defs/classDefs";
import { Config } from "./config";
import { type App } from "./main";
import { getElem } from "./utils";

export class UiManager {
    playButton = getElem<HTMLButtonElement>("#play-btn");
    nameInput = getElem<HTMLInputElement>("#name-input");
    serverSelect = getElem<HTMLSelectElement>("#server-selector");
    classSelect = getElem<HTMLSelectElement>("#class-selector");
    homeDiv = getElem<HTMLDivElement>("#home");
    gameDiv = getElem<HTMLDivElement>("#game");

    app: App;
    constructor(app: App) {
        this.app = app;
        this.setupMainMenu();
    }

    setupMainMenu(): void {
        this.nameInput.maxLength = GameConstants.player.nameMaxLength;

        this.playButton.disabled = true;
        this.playButton.addEventListener("click", () => {
            if (this.playButton.disabled) return;
            const server = Config.servers[this.serverSelect.value];
            this.app.game.connect(`ws${server.https ? "s" : ""}://${server.address}/play`);
        });

        this.loadServerInfo();

        for (const defId of ClassDefs) {
            const option = document.createElement("option");
            option.value = defId;
            option.innerText = defId.charAt(0).toUpperCase() + defId.slice(1);
            this.classSelect.appendChild(option);
        }
    }

    /**
     * Load server selector menu
     */
    loadServerInfo(): void {
        this.serverSelect.innerHTML = "";

        for (const serverId in Config.servers) {
            const server = Config.servers[serverId];
            const option = document.createElement("option");
            this.serverSelect.appendChild(option);
            option.value = serverId;
            option.innerText = server.name;

            fetch(`http${server.https ? "s" : ""}://${server.address}/server_info`).then(async(res) => {
                const data = await res.json();
                option.innerText = `${server.name} - ${data.playerCount} Players`;
            }).catch(err => {
                console.error(`Failed to fetch server info for region ${server.name}: ${err}`);
            });
        }
    }
}
