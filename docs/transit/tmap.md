# Tmap Transit Routing Spec

> **Status:** Draft (needs validation against live Tmap API)

This document defines how we call **Tmap Transit** for public transportation routing (arrival‑by) and what fields we consume.

## 1) External API (Tmap Transit)

### Endpoint
- **POST** `https://apis.openapi.sk.com/transit/routes`
- Query params:
  - `version=1`
  - `format=json`

> ✅ Example: `https://apis.openapi.sk.com/transit/routes?version=1&format=json`

### Authentication / Headers
- `appKey: <TMAP_APP_KEY>` (**required**)
- `Content-Type: application/json`

### Request Parameters (we will use)

We will send a JSON body with the following fields:

```json
{
  "startX": 127.0276,
  "startY": 37.4979,
  "endX": 127.1086,
  "endY": 37.4012,
  "reqCoordType": "WGS84GEO",
  "resCoordType": "WGS84GEO",
  "searchType": "ARRIVAL",
  "arrivalTime": "2026-02-27T19:00:00+09:00",
  "count": 3,
  "lang": "ko",
  "transportType": "BUS_SUBWAY"
}
```

**Field notes** (confirm against Tmap docs):
- `startX/startY`, `endX/endY`: longitude/latitude (WGS84).
- `reqCoordType`, `resCoordType`: we use `WGS84GEO` for both.
- `searchType`:
  - `ARRIVAL` (arrival‑by) when `arrivalTime` is provided.
  - `DEPARTURE` (default) when `departureTime` is provided.
- `arrivalTime` / `departureTime`: ISO‑8601 string. Only one should be set.
- `transportType`:
  - `BUS_SUBWAY` (prefer bus+subway)
  - `BUS` (bus only) **if supported**
  - `SUBWAY` (subway only) **if supported**
- `count`: number of route candidates to return.
- `lang`: response language (default: `ko`).

> ⚠️ **Validation needed:** Parameter names / enums must be verified against official Tmap Transit API docs. If the API uses numeric codes instead of strings (e.g., `searchType=0/1`), update this document accordingly.

### Response Fields We Consume

We will parse the first route (best option) and use:

- **Total travel time** (minutes or seconds) including:
  - walk
  - wait
  - transfers
- **Transfers count**
- **Total walk time**
- **Fare** (if available)

Example (illustrative, schema differs by Tmap version):

```json
{
  "metaData": {
    "plan": {
      "itineraries": [
        {
          "totalTime": 3200,
          "transferCount": 1,
          "totalWalkTime": 600,
          "fare": { "regular": { "totalFare": 1450 } },
          "legs": [
            { "mode": "WALK", "time": 300 },
            { "mode": "SUBWAY", "time": 1800 },
            { "mode": "WALK", "time": 300 },
            { "mode": "BUS", "time": 800 }
          ]
        }
      ]
    }
  }
}
```

**Fields mapped → internal response**
- `totalTime` → `totalTimeSec`
- `transferCount` → `transfers`
- `totalWalkTime` → `walkTimeSec`
- `fare.regular.totalFare` → `fare.amount` (KRW)

### Error Handling / Rate Limits
- Treat non‑2xx responses as **UPSTREAM_FAILED**.
- If Tmap returns an error payload, log `error.code` / `error.message` and map to:
  - `400` → `INVALID_ARGUMENT`
  - `401/403` → `AUTH_FAILED`
  - `429` → `RATE_LIMITED`
  - `5xx` → `UPSTREAM_FAILED`
- **Rate limits:** Assume per‑appKey throttling. Use exponential backoff for `429`.

---

## 2) Internal REST Contract (Draft)

### POST `/v1/transit/departures:compute`

**Purpose:** compute multiple departure options from origins A/B to a destination **arrive‑by** time.

#### Request
```json
{
  "origins": [
    { "id": "A", "lat": 37.4979, "lng": 127.0276 },
    { "id": "B", "lat": 37.4921, "lng": 127.0302 }
  ],
  "destination": { "lat": 37.4012, "lng": 127.1086 },
  "arrivalTime": "2026-02-27T19:00:00+09:00",
  "preference": "BUS_SUBWAY"
}
```

#### Response
```json
{
  "results": [
    {
      "originId": "A",
      "totalTimeSec": 3200,
      "walkTimeSec": 600,
      "transfers": 1,
      "fare": { "amount": 1450, "currency": "KRW" }
    },
    {
      "originId": "B",
      "totalTimeSec": 2800,
      "walkTimeSec": 420,
      "transfers": 0,
      "fare": { "amount": 1350, "currency": "KRW" }
    }
  ]
}
```

### POST `/v1/transit/route:compute`

**Purpose:** compute a single route between one origin and destination (arrival‑by or depart‑at).

#### Request
```json
{
  "origin": { "lat": 37.4979, "lng": 127.0276 },
  "destination": { "lat": 37.4012, "lng": 127.1086 },
  "arrivalTime": "2026-02-27T19:00:00+09:00",
  "preference": "BUS_SUBWAY"
}
```

#### Response
```json
{
  "route": {
    "totalTimeSec": 3200,
    "walkTimeSec": 600,
    "transfers": 1,
    "fare": { "amount": 1450, "currency": "KRW" }
  }
}
```

### Common Rules
- **Either** `arrivalTime` **or** `departureTime` must be provided (not both).
- If `arrivalTime` is set, the service uses Tmap’s arrival‑by mode.
- `preference` values are mapped to Tmap `transportType` (see above).
- If no route is found, return `404` with `{"error":"NO_ROUTE"}`.

---

## 3) TODO / Validation Checklist
- Confirm Tmap Transit endpoint path and parameter names.
- Verify whether `searchType` is string or numeric.
- Confirm time format (ISO‑8601 vs `yyyyMMddHHmm` string).
- Validate transport preference options supported by Tmap.
