import { normalizeStationName, extractStations, findOverlapStations, findMeetupStation } from './route-overlap';

describe('normalizeStationName', () => {
  it('removes whitespace and special characters', () => {
    expect(normalizeStationName('강남 역')).toBe('강남역');
    expect(normalizeStationName('시청(1호선)')).toBe('시청역');
  });

  it('appends 역 suffix if missing', () => {
    expect(normalizeStationName('강남')).toBe('강남역');
  });

  it('keeps 역 suffix as-is', () => {
    expect(normalizeStationName('강남역')).toBe('강남역');
  });

  it('preserves 호/선 characters in station names', () => {
    expect(normalizeStationName('선릉')).toBe('선릉역');
    expect(normalizeStationName('호계')).toBe('호계역');
    expect(normalizeStationName('선릉(2호선)')).toBe('선릉역');
  });
});

describe('extractStations', () => {
  it('extracts stations from TMAP itinerary legs', () => {
    const legs = [
      { mode: 'WALK', sectionTime: 300 },
      {
        mode: 'SUBWAY',
        sectionTime: 600,
        passStopList: {
          stationList: [
            { stationName: '강남', lat: '37.497', lon: '127.027' },
            { stationName: '역삼', lat: '37.500', lon: '127.036' },
            { stationName: '선릉', lat: '37.504', lon: '127.048' },
          ],
        },
      },
      { mode: 'WALK', sectionTime: 120 },
    ];

    const stations = extractStations(legs);
    expect(stations).toHaveLength(3);
    expect(stations[0].name).toBe('강남');
    expect(stations[0].normalized).toBe('강남역');
    expect(stations[0].order).toBe(0);
    expect(stations[2].order).toBe(2);
  });

  it('returns empty array for walk-only route', () => {
    const legs = [{ mode: 'WALK', sectionTime: 600 }];
    expect(extractStations(legs)).toEqual([]);
  });

  it('extracts from multiple transit legs', () => {
    const legs = [
      { mode: 'SUBWAY', passStopList: { stationList: [{ stationName: 'A', lat: '37.5', lon: '127.0' }] } },
      { mode: 'TRANSFER', sectionTime: 180 },
      { mode: 'BUS', passStopList: { stationList: [{ stationName: 'B', lat: '37.6', lon: '127.1' }] } },
    ];
    const stations = extractStations(legs);
    expect(stations).toHaveLength(2);
    expect(stations[1].order).toBe(1);
  });
});

describe('findOverlapStations', () => {
  it('finds common stations by normalized name', () => {
    const stationsA = [
      { name: '강남', normalized: '강남역', lat: 37.497, lng: 127.027, order: 0 },
      { name: '역삼', normalized: '역삼역', lat: 37.500, lng: 127.036, order: 1 },
      { name: '시청', normalized: '시청역', lat: 37.564, lng: 126.977, order: 2 },
    ];
    const stationsB = [
      { name: '시청', normalized: '시청역', lat: 37.564, lng: 126.977, order: 0 },
      { name: '을지로입구', normalized: '을지로입구역', lat: 37.566, lng: 126.982, order: 1 },
    ];

    const overlap = findOverlapStations(stationsA, stationsB);
    expect(overlap).toHaveLength(1);
    expect(overlap[0].name).toBe('시청');
    expect(overlap[0].orderA).toBe(2);
    expect(overlap[0].orderB).toBe(0);
  });

  it('returns empty when no overlap', () => {
    const stationsA = [{ name: '강남', normalized: '강남역', lat: 37.497, lng: 127.027, order: 0 }];
    const stationsB = [{ name: '홍대입구', normalized: '홍대입구역', lat: 37.557, lng: 126.924, order: 0 }];
    expect(findOverlapStations(stationsA, stationsB)).toEqual([]);
  });

  it('falls back to lat/lng proximity within 50m', () => {
    const stationsA = [{ name: '시청역', normalized: '시청역', lat: 37.56400, lng: 126.97700, order: 0 }];
    const stationsB = [{ name: '서울시청', normalized: '서울시청역', lat: 37.56403, lng: 126.97702, order: 0 }];
    const overlap = findOverlapStations(stationsA, stationsB);
    expect(overlap).toHaveLength(1);
  });
});

describe('findMeetupStation', () => {
  it('picks the station with the smallest combined order', () => {
    const overlap = [
      { name: '시청', normalized: '시청역', lat: 37.564, lng: 126.977, order: 2, orderA: 2, orderB: 0 },
      { name: '강남', normalized: '강남역', lat: 37.497, lng: 127.027, order: 0, orderA: 0, orderB: 3 },
    ];
    const meetup = findMeetupStation(overlap);
    expect(meetup?.name).toBe('시청');
  });

  it('returns null for empty overlap', () => {
    expect(findMeetupStation([])).toBeNull();
  });
});
