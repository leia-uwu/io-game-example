import { DefinitionList } from "../utils/definitionList";

interface ClassDef {
    fireDelay: number
    damage: number
    bulletSpeed: number
    cameraZoom: number
}

export const ClassDefs = new DefinitionList({
    main: {
        fireDelay: 250,
        damage: 15,
        bulletSpeed: 80,
        cameraZoom: 64
    },
    sniper: {
        fireDelay: 1000,
        damage: 80,
        bulletSpeed: 130,
        cameraZoom: 72
    },
    auto: {
        fireDelay: 100,
        damage: 8,
        bulletSpeed: 70,
        cameraZoom: 50
    }
} satisfies Record<string, ClassDef>);

export type ClassDefKey = keyof typeof ClassDefs["definitions"];
