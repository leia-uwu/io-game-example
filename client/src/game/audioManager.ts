// add a namespace to pixi sound imports because it has annoying generic names like "sound" and "filters" without a namespace
import * as PixiSound from "@pixi/sound";
import { Vec2, type Vector } from "../../../common/src/utils/vector";
import { MathUtils } from "../../../common/src/utils/math";
import { type Game } from "./game";

export interface SoundOptions {
    position?: Vector
    falloff: number
    maxRange: number
    loop: boolean
    /**
     * If the sound volume and panning will be updated
     * when the camera position changes after it started playing
     */
    dynamic: boolean
    onEnd?: () => void
}

PixiSound.sound.disableAutoPause = true;

export class GameSound {
    readonly manager: AudioManager;

    name: string;
    position?: Vector;
    fallOff: number;
    maxRange: number;
    onEnd?: () => void;

    readonly dynamic: boolean;

    instance?: PixiSound.IMediaInstance;

    readonly stereoFilter: PixiSound.filters.StereoFilter;

    ended = false;

    constructor(name: string, options: SoundOptions, manager: AudioManager) {
        this.name = name;
        this.manager = manager;
        this.position = options.position;
        this.fallOff = options.falloff;
        this.maxRange = options.maxRange;
        this.dynamic = options.dynamic;
        this.onEnd = options.onEnd;
        this.stereoFilter = new PixiSound.filters.StereoFilter(0);

        if (!PixiSound.sound.exists(name)) {
            console.warn(`Unknown sound with name ${name}`);
            return;
        }

        const instanceOrPromise = PixiSound.sound.play(name, {
            loaded: (_err, _sound, instance) => {
                if (instance) this.init(instance);
            },
            filters: [this.stereoFilter],
            loop: options.loop,
            volume: this.manager.volume
        });

        // PixiSound.sound.play returns a promise if the sound has not finished loading
        if (!(instanceOrPromise instanceof Promise)) {
            this.init(instanceOrPromise);
        }
    }

    init(instance: PixiSound.IMediaInstance): void {
        this.instance = instance;
        instance.on("end", () => {
            this.onEnd?.();
            this.ended = true;
        });
        instance.on("stop", () => {
            this.ended = true;
        });
        this.update();
    }

    update(): void {
        if (this.instance && this.position) {
            const diff = Vec2.sub(this.manager.position, this.position);

            this.instance.volume = (1
            - MathUtils.clamp(
                Math.abs(Vec2.length(diff) / this.maxRange),
                0,
                1
            )) ** (1 + this.fallOff * 2) * this.manager.volume;

            this.stereoFilter.pan = MathUtils.clamp(diff.x / this.maxRange * -1, -1, 1);
        }
    }

    stop(): void {
        // trying to stop a sound that already ended or was stopped will stop a random sound
        // (maybe a bug? idk)
        if (this.ended) return;
        this.instance?.stop();
        this.ended = true;
    }
}

export class AudioManager {
    readonly dynamicSounds: GameSound[] = [];

    volume = 1;
    position = Vec2.new(0, 0);

    constructor(public game: Game) {
        this.loadSounds();
    }

    play(name: string, options?: Partial<SoundOptions>): GameSound {
        const sound = new GameSound(name, {
            falloff: 1,
            maxRange: 256,
            dynamic: false,
            loop: false,
            ...options
        }, this);

        if (sound.dynamic) this.dynamicSounds.push(sound);

        return sound;
    }

    update(): void {
        if (this.game.activePlayer) {
            this.position = this.game.activePlayer.position;
        }

        for (let i = 0; i < this.dynamicSounds.length; i++) {
            const sound = this.dynamicSounds[i];
            if (sound.ended) {
                this.dynamicSounds.splice(i, 1);
                continue;
            }
            sound.update();
        }
    }

    loadSounds(): void {
        // Load all mp3s from the sounds folder
        // and sets an alias with the file name
        // similar to how svgs are loaded
        const sounds = import.meta.glob("/public/sounds/**/*.mp3");

        const soundsToLoad: Record<string, string> = {};

        for (const sound in sounds) {
            const path = sound.split("/");
            const name = path[path.length - 1];
            soundsToLoad[name] = sound.replace("/public", "");
        }
        PixiSound.sound.add(soundsToLoad);
    }
}
