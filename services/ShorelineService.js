/**
 * ShorelineService.js - LIGHTWEIGHT VERSION
 * Regional shoreline polygons for probability zone clipping
 * No external API calls - uses pre-defined regional data
 */

class ShorelineService {
  constructor() {
    // Pre-defined shoreline polygons by region
    this.regions = {
      'gulf-tx': [
        { name: 'Galveston Island', coords: [[-94.92,29.20],[-94.72,29.28],[-94.68,29.32],[-94.75,29.35],[-94.95,29.30],[-94.98,29.22],[-94.92,29.20]] },
        { name: 'Bolivar Peninsula', coords: [[-94.72,29.38],[-94.45,29.48],[-94.40,29.52],[-94.48,29.55],[-94.75,29.42],[-94.72,29.38]] },
        { name: 'Texas City', coords: [[-95.05,29.35],[-94.88,29.40],[-94.85,29.48],[-94.90,29.55],[-95.10,29.52],[-95.15,29.42],[-95.05,29.35]] },
        { name: 'Mainland', coords: [[-95.15,29.30],[-95.05,29.35],[-95.10,29.52],[-95.20,29.75],[-95.40,29.80],[-95.45,29.50],[-95.30,29.30],[-95.15,29.30]] }
      ],
      'gulf-la': [
        { name: 'Louisiana Coast', coords: [[-93.0,29.5],[-91.5,29.3],[-90.0,29.0],[-89.0,29.1],[-89.0,30.0],[-93.0,30.5],[-93.0,29.5]] }
      ],
      'gulf-fl': [
        { name: 'Florida West', coords: [[-87.5,30.2],[-86.0,29.8],[-85.0,29.5],[-84.0,28.5],[-83.0,27.0],[-82.5,25.5],[-81.5,26.5],[-82.0,28.0],[-83.5,29.5],[-85.5,30.5],[-87.5,30.2]] },
        { name: 'Florida Keys', coords: [[-82.0,24.5],[-81.0,24.6],[-80.3,25.0],[-80.5,25.3],[-81.5,25.0],[-82.0,24.5]] }
      ],
      'atlantic-se': [
        { name: 'Southeast Coast', coords: [[-81.5,30.0],[-80.5,31.5],[-79.5,33.0],[-78.5,34.0],[-77.5,35.0],[-82.0,35.0],[-82.0,30.0],[-81.5,30.0]] }
      ],
      'atlantic-mid': [
        { name: 'Mid-Atlantic', coords: [[-76.5,36.5],[-75.5,37.5],[-75.0,38.5],[-74.5,39.5],[-74.0,40.0],[-77.0,40.0],[-77.0,36.5],[-76.5,36.5]] },
        { name: 'Delmarva', coords: [[-76.0,37.0],[-75.5,38.0],[-75.0,38.5],[-75.2,39.5],[-76.0,39.0],[-76.5,38.0],[-76.0,37.0]] }
      ],
      'atlantic-ne': [
        { name: 'Long Island', coords: [[-74.0,40.5],[-73.5,40.6],[-72.5,40.8],[-72.0,41.0],[-71.5,41.2],[-73.0,41.3],[-74.0,40.8],[-74.0,40.5]] },
        { name: 'New England', coords: [[-71.5,41.2],[-70.5,41.5],[-70.0,42.0],[-70.5,43.0],[-69.5,44.0],[-67.5,45.0],[-71.0,45.0],[-71.5,41.2]] }
      ],
      'pacific-ca': [
        { name: 'California', coords: [[-117.5,32.5],[-118.0,33.5],[-118.5,34.0],[-120.0,34.5],[-121.0,36.0],[-122.0,37.0],[-122.5,38.0],[-124.0,40.0],[-124.5,42.0],[-120.0,42.0],[-117.0,33.0],[-117.5,32.5]] }
      ],
      'pacific-nw': [
        { name: 'Pacific Northwest', coords: [[-124.5,42.0],[-124.0,44.0],[-124.0,46.0],[-124.5,48.0],[-123.0,49.0],[-122.0,48.0],[-122.5,46.0],[-124.0,42.0],[-124.5,42.0]] }
      ],
      'great-lakes': [
        { name: 'Great Lakes Shore', coords: [[-88.0,42.0],[-87.5,43.0],[-86.5,44.0],[-85.0,45.5],[-83.5,46.0],[-82.0,45.0],[-80.0,43.5],[-79.0,43.0],[-87.0,41.5],[-88.0,42.0]] }
      ],
      'alaska': [
        { name: 'Alaska', coords: [[-170.0,52.0],[-160.0,55.0],[-150.0,58.0],[-140.0,60.0],[-130.0,55.0],[-135.0,57.0],[-145.0,60.0],[-155.0,58.0],[-165.0,54.0],[-170.0,52.0]] }
      ],
      'hawaii': [
        { name: 'Oahu', coords: [[-158.3,21.2],[-157.7,21.3],[-157.6,21.7],[-158.0,21.7],[-158.3,21.5],[-158.3,21.2]] },
        { name: 'Maui', coords: [[-156.7,20.6],[-156.0,20.7],[-155.9,21.0],[-156.4,21.0],[-156.7,20.8],[-156.7,20.6]] }
      ]
    };
  }

  getRegion(lat, lng) {
    if (lat >= 54 && lng <= -130) return 'alaska';
    if (lat >= 18 && lat <= 23 && lng >= -162 && lng <= -154) return 'hawaii';
    if (lat >= 42 && lat <= 50 && lng >= -125 && lng <= -122) return 'pacific-nw';
    if (lat >= 32 && lat < 42 && lng >= -125 && lng <= -117) return 'pacific-ca';
    if (lat >= 41 && lat <= 49 && lng >= -93 && lng <= -76) return 'great-lakes';
    if (lat >= 25 && lat <= 31 && lng >= -98 && lng <= -93) return 'gulf-tx';
    if (lat >= 28 && lat <= 31 && lng > -93 && lng <= -88) return 'gulf-la';
    if (lat >= 24 && lat <= 31 && lng > -88 && lng <= -79) return 'gulf-fl';
    if (lat >= 30 && lat <= 36 && lng > -82 && lng <= -75) return 'atlantic-se';
    if (lat >= 36 && lat < 40 && lng > -77 && lng <= -73) return 'atlantic-mid';
    if (lat >= 40 && lat <= 45 && lng > -74 && lng <= -66) return 'atlantic-ne';
    return 'gulf-tx';
  }

  getShorelineData(lat, lng, radiusKm = 50) {
    const region = this.getRegion(lat, lng);
    const polygons = this.regions[region] || this.regions['gulf-tx'];
    
    return {
      type: 'FeatureCollection',
      region,
      features: polygons.map(p => ({
        type: 'Feature',
        properties: { name: p.name, type: 'land' },
        geometry: { type: 'Polygon', coordinates: [p.coords] }
      })),
      fetchedAt: new Date().toISOString()
    };
  }

  isPointOnLand(lat, lng, shorelineData) {
    if (!shorelineData?.features) return false;
    for (const f of shorelineData.features) {
      if (f.geometry?.type === 'Polygon' && this.pointInPolygon([lng, lat], f.geometry.coordinates[0])) {
        return true;
      }
    }
    return false;
  }

  pointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  clipPolygonToWater(coords, shorelineData) {
    if (!shorelineData?.features) return coords;
    return coords.filter(c => !this.isPointOnLand(c.lat || c[1], c.lng || c[0], shorelineData));
  }
}

module.exports = ShorelineService;
