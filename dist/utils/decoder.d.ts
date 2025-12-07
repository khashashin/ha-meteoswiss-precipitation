export interface RadarFrame {
    timestamp: number;
    data: MeteoSwissRadarJSON;
}
export interface MeteoSwissRadarJSON {
    coords: {
        system: string;
        x_min: number;
        x_max: number;
        x_count: number;
        y_min: number;
        y_max: number;
        y_count: number;
    };
    areas: Array<{
        color: string;
        shapes: Array<Array<{
            i: number;
            j: number;
            d: string;
            o: string;
            l: number;
        }>>;
    }>;
}
export interface GridConfig {
    x_min: number;
    x_max: number;
    x_count: number;
    y_min: number;
    y_max: number;
    y_count: number;
}
export declare function CHToWGS(y: number, x: number): [number, number];
export declare function decodeShape(shape: {
    i: number;
    j: number;
    d: string;
    o: string;
}, coords: GridConfig): Array<[number, number]>;
//# sourceMappingURL=decoder.d.ts.map