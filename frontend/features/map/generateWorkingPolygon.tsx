import * as turf from '@turf/turf';

export default function generateWorkingPolygon(coords: number[][], workingWidthInMeters: number) {

    const polygon = turf.polygon([coords]);
    const larguraImplemento = workingWidthInMeters;

    console.log("---", turf)

    const buffered: any = turf.buffer(polygon, -larguraImplemento, {
        units: 'meters',
    });

    return buffered.geometry.coordinates[0];
}