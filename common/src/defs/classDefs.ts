import { DefinitionList } from "../utils/definitionList";

interface ClassDef {
    fireDelay: number
    damage: number
    bulletSpeed: number
}

export const ClassDefs = new DefinitionList({
    main: {
        fireDelay: 250,
        damage: 15,
        bulletSpeed: 80
    },
    sniper: {
        fireDelay: 1000,
        damage: 80,
        bulletSpeed: 130
    },
    auto: {
        fireDelay: 100,
        damage: 8,
        bulletSpeed: 70
    }
} satisfies Record<string, ClassDef>);

export type ClassDefKey = keyof typeof ClassDefs["definitions"];
