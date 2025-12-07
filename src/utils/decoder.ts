
// MeteoSwiss Radar Data Decoder
// Based on reverse-engineered logic:
// - d: Chain code string where charCode - 77 gives delta
// - Coordinates are in Swiss LV95 (CH1903+) system

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
            o: string; // "o" string seems to be related to offsets or smoothing, but "d" is the primary shape
            l: number; // level/intensity index often matching color groups
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

// Convert CH1903+ / LV95 to WGS84 (Lat/Lng)
// Source: Federal Office of Topography swisstopo
// https://www.swisstopo.admin.ch/en/knowledge-facts/surveying-geodesy/reference-frames/transformations-position.html
export function CHToWGS(y: number, x: number): [number, number] {
    // Convert to civil system (Bern = 0 / 0)
    // Input y (Easting) and x (Northing) are in meters
    // y_aux = (E - 2600000) / 1000000
    // x_aux = (N - 1200000) / 1000000
    // Convert to civil system (Bern = 0 / 0)
    // Input y (Easting) and x (Northing) are in meters
    // Standard LV95: y ~ 2,600,000, x ~ 1,200,000
    // Standard LV03: y ~ 600,000, x ~ 200,000
    // The Input data seems to be LV03-like or shifted LV95 (e.g. y=200k-800k, x=-160k-480k)
    // We strictly need LV95 inputs (2.6M) for this specific formula?
    // Actually the formula below `(y - 2600000)` implies it expects LV95.

    // Heuristic: If values are "small", add the LV95 offset.
    // Bern LV95 is 2,600,000 / 1,200,000.
    // If y < 2,000,000, assume it needs +2,000,000.
    // If x < 1,000,000, assume it needs +1,000,000.

    let y_eff = y;
    let x_eff = x;

    if (y_eff < 2000000) y_eff += 2000000;
    if (x_eff < 1000000) x_eff += 1000000;

    const y_aux = (y_eff - 2600000) / 1000000;
    const x_aux = (x_eff - 1200000) / 1000000;

    // Calculate Latitude (Phi)
    let lat = 16.9023892 +
        3.238272 * x_aux -
        0.270978 * Math.pow(y_aux, 2) -
        0.002528 * Math.pow(x_aux, 2) -
        0.0447 * Math.pow(y_aux, 2) * x_aux -
        0.0140 * Math.pow(x_aux, 3);

    // Calculate Longitude (Lambda)
    let lng = 2.6779094 +
        4.728982 * y_aux +
        0.791484 * y_aux * x_aux +
        0.1306 * y_aux * Math.pow(x_aux, 2) -
        0.0436 * Math.pow(y_aux, 3);

    // Convert to 100/36 unit to degrees? No, the formula returns 10000 seconds unit?
    // Let's use the standard approximation (meters to degrees) if that's safer, 
    // or verifying the output unit.

    // Standard approximation (Input: E, N in meters)
    // https://github.com/valentin/ch1903-wgs84/blob/mist/js/ch1903_wgs84.js

    // Re-implementing standard JS version to be safe:
    // Re-implementing standard JS version to be safe:
    let y_in = y;
    let x_in = x;

    if (y_in < 2000000) y_in += 2000000;
    if (x_in < 1000000) x_in += 1000000;

    const y_ = (y_in - 2600000) / 1000000;
    const x_ = (x_in - 1200000) / 1000000;

    const lambda_ = 2.6779094 + 4.728982 * y_ + 0.791484 * y_ * x_ + 0.1306 * y_ * Math.pow(x_, 2) - 0.0436 * Math.pow(y_, 3);
    const phi_ = 16.9023892 + 3.238272 * x_ - 0.270978 * Math.pow(y_, 2) - 0.002528 * Math.pow(x_, 2) - 0.0447 * Math.pow(y_, 2) * x_ - 0.0140 * Math.pow(x_, 3);

    return [phi_ * 100 / 36, lambda_ * 100 / 36];
}

export function decodeShape(shape: { i: number, j: number, d: string, o: string }, coords: GridConfig): Array<[number, number]> {
    let r = shape.i;
    let o = shape.j;
    const result: Array<[number, number]> = [];

    // Iterate through the 'o' string? 
    // The snippet: `for (; i < e.o.length; )` ... `if (2 * i < e.d.length)`
    // It seems 'o' contains the fine-grained offsets and 'd' contains the coarse grid moves.

    let idx = 0;
    while (idx < shape.o.length) {
        let n = 0; // Easting
        let l = 0; // Northing

        // Parse offset from 'o' string
        // "o": "4499045555" -> char '4' -> 0.4 + 0.05 = 0.45
        const d_val = parseInt(shape.o.charAt(idx)) / 10 + 0.05;

        // Calculate coordinate in Swiss Grid (LV95)
        // NOTE: coords.x_min etc are in Kilometers in the JSON (e.g. 255.5). multiply by 1000 for meters.

        if (r % 2 === 0) {
            // Even row/col index (X-axis index 'i')
            // Formula from snippet: n uses r/2 (Clean), l uses (o-1)/2 + d (Tweaked)
            n = coords.x_min + (coords.x_max - coords.x_min) * (r / 2) / coords.x_count;
            l = coords.y_min + (coords.y_max - coords.y_min) * ((o - 1) / 2 + d_val) / coords.y_count;
        } else {
            // Odd row/col index (X-axis index 'i')
            // Formula from snippet: n uses (r-1)/2 + d (Tweaked), l uses o/2 (Clean)
            n = coords.x_min + (coords.x_max - coords.x_min) * ((r - 1) / 2 + d_val) / coords.x_count;
            l = coords.y_min + (coords.y_max - coords.y_min) * (o / 2) / coords.y_count;
        }

        // Convert to WGS84
        // Multiply by 1000 to get meters for the projection formula
        const [lat, lng] = CHToWGS(n * 1000, l * 1000);

        if (result.length === 0 && idx === 0) {
            console.debug(`Decoder Sample: Grid[${r},${o}] -> Meters[${n * 1000},${l * 1000}] -> WGS[${lat},${lng}]`);
        }

        result.push([lat, lng]);

        // Update grid position using 'd' string
        // 2 * idx < d.length checks validity
        // "d": "NLNL..."
        // r += charCode - 77 ('M')
        // o += charCode - 77 ('M')

        if (2 * idx < shape.d.length) {
            // First char of pair updates r (i)
            r += shape.d.charCodeAt(2 * idx) - 77;
            // Second char of pair updates o (j)
            o += shape.d.charCodeAt(2 * idx + 1) - 77;
        }

        idx++;
    }

    return result;
}
