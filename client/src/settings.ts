import { type ClassDefKey } from "../../common/src/defs/classDefs";
import { ClientConfig } from "./config";

interface GameSettings {
    server: string
    playerClass: ClassDefKey
}

const defaultSettings: GameSettings = {
    server: ClientConfig.defaultServer,
    playerClass: "main"
};

export class SettingsManager {
    readonly settingsKey = "game_settings";
    readonly storedSettings: Partial<GameSettings>;

    constructor() {
        this.storedSettings = JSON.parse(localStorage.getItem(this.settingsKey) ?? "{}");
    }

    writeToLocalStorage() {
        localStorage.setItem(this.settingsKey, JSON.stringify(this.storedSettings));
    }

    get<Key extends keyof GameSettings>(key: Key): GameSettings[Key] {
        return this.storedSettings[key] ?? defaultSettings[key];
    }

    set<Key extends keyof GameSettings>(key: Key, value: GameSettings[Key]) {
        if (value !== this.storedSettings[key]) {
            this.storedSettings[key] = value;
            this.writeToLocalStorage();
        }
    }
}
