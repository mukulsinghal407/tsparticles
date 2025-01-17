import type { IPolygonMask } from "../Interfaces/IPolygonMask";
import { InlineArrangement, InlineArrangementAlt, Type } from "../../Enums";
import { Draw } from "./Draw";
import { Move } from "./Move";
import { Inline } from "./Inline";
import type { RecursivePartial } from "../../../../Types";
import type { ICoordinates } from "../../../../Core/Interfaces/ICoordinates";
import { LocalSvg } from "./LocalSvg";
import type { IOptionLoader } from "../../../../Options/Interfaces/IOptionLoader";
import { deepExtend } from "../../../../Utils";

/**
 * [[include:Options/Plugins/PolygonMask.md]]
 * @category Polygon Mask Plugin
 */
export class PolygonMask implements IPolygonMask, IOptionLoader<IPolygonMask> {
    /**
     * @deprecated the property inlineArrangement is deprecated, please use the new inline.arrangement
     */
    get inlineArrangement(): InlineArrangement | keyof typeof InlineArrangement | InlineArrangementAlt {
        return this.inline.arrangement;
    }

    /**
     * @deprecated the property inlineArrangement is deprecated, please use the new inline.arrangement
     */
    set inlineArrangement(value: InlineArrangement | keyof typeof InlineArrangement | InlineArrangementAlt) {
        this.inline.arrangement = value;
    }

    draw;
    enable;
    inline;
    move;
    position?: ICoordinates;
    scale;
    type;
    url?: string;
    data?: string | LocalSvg;

    constructor() {
        this.draw = new Draw();
        this.enable = false;
        this.inline = new Inline();
        this.move = new Move();
        this.scale = 1;
        this.type = Type.none;
    }

    load(data?: RecursivePartial<IPolygonMask>): void {
        if (data !== undefined) {
            this.draw.load(data.draw);

            const inline = data.inline ?? {
                arrangement: data.inlineArrangement,
            };

            if (inline !== undefined) {
                this.inline.load(inline);
            }

            this.move.load(data.move);

            if (data.scale !== undefined) {
                this.scale = data.scale;
            }

            if (data.type !== undefined) {
                this.type = data.type;
            }

            if (data.enable !== undefined) {
                this.enable = data.enable;
            } else {
                this.enable = this.type !== Type.none;
            }

            if (data.url !== undefined) {
                this.url = data.url;
            }

            if (data.data !== undefined) {
                if (typeof data.data === "string") {
                    this.data = data.data;
                } else {
                    this.data = new LocalSvg();

                    this.data.load(data.data);
                }
            }

            if (data.position !== undefined) {
                this.position = deepExtend({}, data.position) as ICoordinates;
            }
        }
    }
}
