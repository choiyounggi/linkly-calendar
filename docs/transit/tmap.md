# Tmap 대중교통 라우팅 명세

> **상태:** 초안 (실제 Tmap API 응답과 대조 검증 필요)

이 문서는 **Tmap Transit** 호출 방식(도착 기준 포함)과 내부에서 사용하는 필드를 정의합니다.

## 1) 외부 API (Tmap Transit)

### 엔드포인트
- **POST** `https://apis.openapi.sk.com/transit/routes`
- 쿼리 파라미터
  - `version=1`
  - `format=json`

예시:
`https://apis.openapi.sk.com/transit/routes?version=1&format=json`

### 인증 / 헤더
- `appKey: <TMAP_APP_KEY>` (**필수**)
- `Content-Type: application/json`

### 요청 파라미터 (사용 예정)

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

필드 메모(공식 문서 대조 필요):
- `startX/startY`, `endX/endY`: 경도/위도(WGS84)
- `reqCoordType`, `resCoordType`: 모두 `WGS84GEO` 사용
- `searchType`
  - `ARRIVAL`: `arrivalTime` 제공 시(도착 기준)
  - `DEPARTURE`: `departureTime` 제공 시(출발 기준)
- `arrivalTime` / `departureTime`: ISO-8601 문자열, 둘 중 하나만 설정
- `transportType`
  - `BUS_SUBWAY` (버스+지하철 우선)
  - `BUS` (버스 전용, 지원 시)
  - `SUBWAY` (지하철 전용, 지원 시)
- `count`: 경로 후보 개수
- `lang`: 응답 언어(기본 `ko`)

> ⚠️ 검증 필요: 파라미터명/enum이 공식 문서와 정확히 일치하는지 확인해야 합니다. 문자열 대신 숫자 코드(`searchType=0/1`)를 쓰는 버전이면 문서를 업데이트하세요.

### 사용하는 응답 필드
첫 번째 경로(최적 경로)에서 아래 값을 사용합니다.

- 총 소요 시간(분 또는 초)
  - 도보
  - 대기
  - 환승 포함
- 환승 횟수
- 총 도보 시간
- 요금(가능한 경우)

예시(버전에 따라 스키마 상이):

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

내부 응답 매핑:
- `totalTime` → `totalTimeSec`
- `transferCount` → `transfers`
- `totalWalkTime` → `walkTimeSec`
- `fare.regular.totalFare` → `fare.amount` (KRW)

### 오류 처리 / 레이트 리밋
- 2xx가 아닌 응답은 **UPSTREAM_FAILED**로 처리
- Tmap 오류 페이로드가 있으면 `error.code` / `error.message` 로깅 후 매핑
  - `400` → `INVALID_ARGUMENT`
  - `401/403` → `AUTH_FAILED`
  - `429` → `RATE_LIMITED`
  - `5xx` → `UPSTREAM_FAILED`
- 레이트 리밋은 appKey 단위로 가정하고, `429` 시 지수 백오프 적용

---

## 2) 내부 REST 계약 (초안)

### POST `/v1/transit/departures:compute`

목적: 출발지 A/B에서 목적지까지 **도착 기준**으로 여러 출발 옵션 계산

#### 요청
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

#### 응답
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

목적: 단일 출발지/목적지 경로 계산(도착 기준 또는 출발 기준)

#### 요청
```json
{
  "origin": { "lat": 37.4979, "lng": 127.0276 },
  "destination": { "lat": 37.4012, "lng": 127.1086 },
  "arrivalTime": "2026-02-27T19:00:00+09:00",
  "preference": "BUS_SUBWAY"
}
```

#### 응답
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

### 공통 규칙
- `arrivalTime` 또는 `departureTime` 중 **하나만** 필수
- `arrivalTime`이 있으면 Tmap 도착 기준 모드 사용
- `preference`는 Tmap `transportType`으로 매핑
- 경로가 없으면 `404` + `{"error":"NO_ROUTE"}` 반환

---

## 3) TODO / 검증 체크리스트
- Tmap Transit 엔드포인트 경로와 파라미터명 재확인
- `searchType`이 문자열인지 숫자인지 확인
- 시간 포맷(ISO-8601 vs `yyyyMMddHHmm`) 확인
- 교통수단 선호 옵션 지원 범위 확인
