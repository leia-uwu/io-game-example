import { Game } from "./game/game";
import "./scss/style.scss";
import { GameConstants } from "../../common/src/constants";
import { getElem } from "./utils";
import { Config } from "./config";

const game = new Game();

const playButton = getElem<HTMLButtonElement>("#play-btn");
const nameInput = getElem<HTMLInputElement>("#name-input");
nameInput.maxLength = GameConstants.nameMaxLength;

const serverSelect = getElem<HTMLSelectElement>("#server-selector");
for (const serverId in Config.servers) {
    const server = Config.servers[serverId];
    const option = document.createElement("option");
    serverSelect.appendChild(option);
    option.value = serverId;
    option.innerText = server.name;

    fetch(`http${server.https ? "s" : ""}://${server.address}/server_info`).then(async(res) => {
        const data = await res.json();
        option.innerText = `${server.name} - ${data.playerCount} Players`;
    }).catch(err => {
        console.error(`Failed to fetch server info for region ${server.name}: ${err}`);
    });
}

playButton.addEventListener("click", () => {
    const server = Config.servers[serverSelect.value];
    game.connect(`ws${server.https ? "s" : ""}://${server.address}/play`);
});
