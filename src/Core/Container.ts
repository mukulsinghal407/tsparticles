import { Canvas } from "./Canvas";
import { EventListeners } from "../Utils/EventListeners";
import type { IRepulse } from "./Interfaces/IRepulse";
import type { IBubble } from "./Interfaces/IBubble";
import type { IContainerInteractivity } from "./Interfaces/IContainerInteractivity";
import { Particles } from "./Particles";
import { Retina } from "./Retina";
import type { IOptions } from "../Options/Interfaces/IOptions";
import { FrameManager } from "./FrameManager";
import type { RecursivePartial } from "../Types/RecursivePartial";
import { Options } from "../Options/Classes/Options";
import { Presets } from "../Utils/Presets";
import type { IPlugin } from "./Interfaces/IPlugin";
import { CanvasUtils } from "../Utils/CanvasUtils";
import type { IShapeDrawer } from "./Interfaces/IShapeDrawer";
import { Plugins } from "../Utils/Plugins";

/**
 * The object loaded into an HTML element, it'll contain options loaded and all data to let everything working
 */
export class Container {
    public readonly sourceOptions?: RecursivePartial<IOptions>;
    public readonly id: string;
    public interactivity: IContainerInteractivity;
    public options: Options;
    public retina: Retina;
    public canvas: Canvas;
    public drawers: { [type: string]: IShapeDrawer };
    public particles: Particles;
    public plugins: IPlugin[];
    public bubble: IBubble;
    public repulse: IRepulse;
    public lastFrameTime: number;
    public pageHidden: boolean;
    public drawer: FrameManager;
    public started: boolean;
    public destroyed: boolean;

    private paused: boolean;
    private drawAnimationFrame?: number;
    private eventListeners: EventListeners;

    /**
     * This is the core class, create an instance to have a new working particles manager
     * @constructor
     * @param id the id to identify this instance
     * @param params the options to load
     * @param presets all the presets to load with options
     */
    constructor(id: string, params?: RecursivePartial<IOptions>, ...presets: string[]) {
        this.started = false;
        this.destroyed = false;
        this.id = id;
        this.paused = true;
        this.sourceOptions = params;
        this.lastFrameTime = 0;
        this.pageHidden = false;
        this.retina = new Retina(this);
        this.canvas = new Canvas(this);
        this.particles = new Particles(this);
        this.drawer = new FrameManager(this);
        this.interactivity = {
            mouse: {},
        };
        this.bubble = {};
        this.repulse = { particles: [] };
        this.plugins = [];
        this.drawers = {};

        /* tsParticles variables with default values */
        this.options = new Options();

        for (const preset of presets) {
            this.options.load(Presets.getPreset(preset));
        }

        /* params settings */
        if (this.sourceOptions) {
            this.options.load(this.sourceOptions);
        }

        /* ---------- tsParticles - start ------------ */
        this.eventListeners = new EventListeners(this);
    }

    public static requestFrame(callback: FrameRequestCallback): number {
        return window.customRequestAnimationFrame(callback);
    }

    public static cancelAnimation(handle: number): void {
        window.cancelAnimationFrame(handle);
    }

    public play(force?: boolean): void {
        const needsUpdate = this.paused || force;

        if (this.paused) {
            this.paused = false;
        }

        if (needsUpdate) {
            for (const plugin of this.plugins) {
                if (plugin.play) {
                    plugin.play();
                }
            }

            this.lastFrameTime = performance.now();
        }

        this.drawAnimationFrame = Container.requestFrame((t) => this.drawer.nextFrame(t));
    }

    public pause(): void {
        if (this.drawAnimationFrame !== undefined) {
            Container.cancelAnimation(this.drawAnimationFrame);

            delete this.drawAnimationFrame;
        }

        if (!this.paused) {
            for (const plugin of this.plugins) {
                if (plugin.pause) {
                    plugin.pause();
                }
            }

            if (!this.pageHidden) {
                this.paused = true;
            }
        }
    }

    public getAnimationStatus(): boolean {
        return !this.paused;
    }

    /* ---------- tsParticles functions - vendors ------------ */

    public densityAutoParticles(): void {
        if (!(this.canvas.element && this.options.particles.number.density.enable)) {
            return;
        }

        let area = this.canvas.element.width * this.canvas.element.height / 1000;

        if (this.retina.isRetina) {
            area /= this.retina.pixelRatio * 2;
        }

        const optParticlesNumber = this.options.particles.number.value;
        const density = this.options.particles.number.density.area;
        const particlesNumber = area * optParticlesNumber / density;
        const particlesCount = this.particles.count;

        if (particlesCount < particlesNumber) {
            this.particles.push(Math.abs(particlesNumber - particlesCount));
        } else if (particlesCount > particlesNumber) {
            this.particles.removeQuantity(particlesCount - particlesNumber);
        }
    }

    public destroy(): void {
        this.stop();

        this.retina.reset();
        this.canvas.destroy();

        delete this.interactivity;
        delete this.options;
        delete this.retina;
        delete this.canvas;
        delete this.particles;
        delete this.bubble;
        delete this.repulse;
        delete this.drawer;
        delete this.eventListeners;

        for (const type in this.drawers) {
            const drawer = this.drawers[type];

            if (drawer.destroy !== undefined) {
                drawer.destroy(this);
            }
        }

        this.drawers = {};

        this.destroyed = true;
    }

    /**
     * @deprecated this method is deprecated, please use the exportImage method
     */
    public exportImg(callback: BlobCallback): void {
        this.exportImage(callback);
    }

    public exportImage(callback: BlobCallback, type?: string, quality?: number): void {
        return this.canvas.element?.toBlob(callback, type ?? "image/png", quality);
    }

    public exportConfiguration(): string {
        return JSON.stringify(this.options, undefined, 2);
    }

    public async refresh(): Promise<void> {
        /* restart */
        this.stop();
        await this.start();
    }

    public stop(): void {
        if (!this.started) {
            return;
        }

        this.started = false;
        this.eventListeners.removeListeners();
        this.pause();
        this.particles.clear();
        this.retina.reset();
        this.canvas.clear();

        for (const plugin of this.plugins) {
            if (plugin.stop !== undefined) {
                plugin.stop();
            }
        }

        this.plugins = [];

        delete this.particles.lineLinkedColor;
    }

    public async start(): Promise<void> {
        if (this.started) {
            return;
        }

        for (const plugin of Plugins.getAvailablePlugins(this)) {
            this.plugins.push(plugin);
        }

        this.started = true;

        this.eventListeners.addListeners();

        for (const plugin of this.plugins) {
            if (plugin.startAsync !== undefined) {
                await plugin.startAsync();
            } else if (plugin.start !== undefined) {
                plugin.start();
            }
        }

        if (this.options.particles.shape.type instanceof Array) {
            for (const type of this.options.particles.shape.type) {
                this.drawers[type] = CanvasUtils.getShapeDrawer(type);
            }
        } else {
            const type = this.options.particles.shape.type;

            this.drawers[type] = CanvasUtils.getShapeDrawer(type);
        }

        for (const type in this.drawers) {
            const drawer = this.drawers[type];

            if (drawer.init !== undefined) {
                await drawer.init(this);
            }
        }

        this.init();
        this.play();
    }

    private init(): void {
        /* init canvas + particles */
        this.retina.init();
        this.canvas.init();
        this.particles.init();

        for (const plugin of this.plugins) {
            if (plugin.init !== undefined) {
                plugin.init();
            }
        }

        this.densityAutoParticles();
    }
}
