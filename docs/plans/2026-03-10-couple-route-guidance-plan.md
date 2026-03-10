# Couple Route Guidance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** TMAP API 기반 커플 대중교통 경로 안내 — 각자 집에서 약속 장소까지 경로 계산, 합류 지점 자동 추천

**Architecture:** NestJS 백엔드에 Event CRUD, User Profile, POI Search, Couple Route Analysis 모듈 추가. TransitService를 확장하여 TMAP 대중교통 API 호출 + 2단계 캐시(Redis → DB RouteCache). 프론트엔드는 EventModal 개편 + POI 검색 자동완성 + 경로 상세 화면 추가.

**Tech Stack:** NestJS, Prisma (PostgreSQL), Redis (ioredis), TMAP API (POI + Transit), Next.js 16, React 19, FullCalendar, class-validator

**Design doc:** `docs/plans/2026-03-10-couple-route-guidance-design.md`

---

## Task 1: Prisma Schema Migration

CalendarEvent 모델 재설계 + RouteCache 모델 신규 추가.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_couple_route_guidance/migration.sql` (auto-generated)

**Step 1: Update CalendarEvent model in schema**

`prisma/schema.prisma` — CalendarEvent 모델을 아래로 교체:

```prisma
model CalendarEvent {
  id               String    @id @default(cuid())
  coupleId         String
  title            String
  placeName        String?
  placeAddress     String?
  placeLat         Float?
  placeLng         Float?
  appointmentAt    DateTime?
  detail           String?
  createdByUserId  String
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  couple      Couple       @relation(fields: [coupleId], references: [id], onDelete: Cascade)
  createdBy   User         @relation(fields: [createdByUserId], references: [id], onDelete: Cascade)
  routeCaches RouteCache[]

  @@index([coupleId])
  @@index([createdByUserId])
}
```

제거 필드: `description`, `place`, `expectedSchedule`, `startAt`, `endAt`, `allDay`, `meetupLat`, `meetupLng`, `meetupName`, `meetupNote`.

**Step 2: Add RouteCache model**

CalendarEvent 모델 아래에 추가:

```prisma
model RouteCache {
  id        String   @id @default(cuid())
  eventId   String
  userId    String
  cacheKey  String   @unique
  routeData Json
  createdAt DateTime @default(now())
  expiresAt DateTime

  event CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  user  User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([eventId, userId])
  @@index([expiresAt])
}
```

**Step 3: Add RouteCache relation to User model**

User 모델의 relations에 추가:

```prisma
routeCaches RouteCache[]
```

**Step 4: Generate and apply migration**

Run:
```bash
npx prisma migrate dev --name couple_route_guidance
```

Expected: Migration 생성 + 적용 성공. `prisma/migrations/` 디렉토리에 SQL 파일 생성됨.

**Step 5: Regenerate Prisma client**

Run:
```bash
npx prisma generate
```

Expected: `@prisma/client`에 CalendarEvent (신규 필드), RouteCache 타입 추가됨.

**Step 6: Commit**

```bash
git add prisma/
git commit -m "feat: CalendarEvent 재설계 + RouteCache 모델 추가"
```

---

## Task 2: Event Module — DTOs

캘린더 일정 CRUD를 위한 DTO 정의.

**Files:**
- Create: `apps/api/src/event/dto/create-event.dto.ts`
- Create: `apps/api/src/event/dto/update-event.dto.ts`
- Create: `apps/api/src/event/dto/event-query.dto.ts`

**Step 1: Create CreateEventDto**

`apps/api/src/event/dto/create-event.dto.ts`:

```typescript
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  coupleId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  placeName?: string;

  @IsOptional()
  @IsString()
  placeAddress?: string;

  @IsOptional()
  @IsNumber()
  placeLat?: number;

  @IsOptional()
  @IsNumber()
  placeLng?: number;

  @IsOptional()
  @IsDateString()
  appointmentAt?: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsString()
  @IsNotEmpty()
  createdByUserId!: string;
}
```

**Step 2: Create UpdateEventDto**

`apps/api/src/event/dto/update-event.dto.ts`:

```typescript
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  placeName?: string | null;

  @IsOptional()
  @IsString()
  placeAddress?: string | null;

  @IsOptional()
  @IsNumber()
  placeLat?: number | null;

  @IsOptional()
  @IsNumber()
  placeLng?: number | null;

  @IsOptional()
  @IsDateString()
  appointmentAt?: string | null;

  @IsOptional()
  @IsString()
  detail?: string | null;
}
```

**Step 3: Create EventQueryDto**

`apps/api/src/event/dto/event-query.dto.ts`:

```typescript
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class EventQueryDto {
  @IsString()
  @IsNotEmpty()
  coupleId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be YYYY-MM format' })
  month?: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;
}
```

**Step 4: Commit**

```bash
git add apps/api/src/event/
git commit -m "feat: Event CRUD DTO 정의"
```

---

## Task 3: Event Module — Service

캘린더 일정 CRUD 비즈니스 로직. 일정 수정 시 RouteCache 무효화 포함.

**Files:**
- Create: `apps/api/src/event/event.service.ts`

**Step 1: Create EventService**

`apps/api/src/event/event.service.ts`:

```typescript
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEventDto) {
    await this.ensureCoupleMember(dto.coupleId, dto.createdByUserId);

    return this.prisma.calendarEvent.create({
      data: {
        coupleId: dto.coupleId,
        title: dto.title,
        placeName: dto.placeName,
        placeAddress: dto.placeAddress,
        placeLat: dto.placeLat,
        placeLng: dto.placeLng,
        appointmentAt: dto.appointmentAt ? new Date(dto.appointmentAt) : null,
        detail: dto.detail,
        createdByUserId: dto.createdByUserId,
      },
    });
  }

  async findByMonth(query: EventQueryDto) {
    await this.ensureCoupleMember(query.coupleId, query.userId);

    const where: Record<string, unknown> = { coupleId: query.coupleId };

    if (query.month) {
      const [year, month] = query.month.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      where.appointmentAt = { gte: start, lt: end };
    }

    return this.prisma.calendarEvent.findMany({
      where,
      orderBy: { appointmentAt: 'asc' },
    });
  }

  async findById(id: string, userId: string) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    await this.ensureCoupleMember(event.coupleId, userId);
    return event;
  }

  async update(id: string, userId: string, dto: UpdateEventDto) {
    const event = await this.findById(id, userId);

    const placeOrTimeChanged =
      dto.placeLat !== undefined ||
      dto.placeLng !== undefined ||
      dto.appointmentAt !== undefined;

    const updated = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.placeName !== undefined && { placeName: dto.placeName }),
        ...(dto.placeAddress !== undefined && { placeAddress: dto.placeAddress }),
        ...(dto.placeLat !== undefined && { placeLat: dto.placeLat }),
        ...(dto.placeLng !== undefined && { placeLng: dto.placeLng }),
        ...(dto.appointmentAt !== undefined && {
          appointmentAt: dto.appointmentAt ? new Date(dto.appointmentAt) : null,
        }),
        ...(dto.detail !== undefined && { detail: dto.detail }),
      },
    });

    if (placeOrTimeChanged) {
      await this.invalidateRouteCaches(id);
    }

    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findById(id, userId);
    await this.prisma.calendarEvent.delete({ where: { id } });
  }

  private async invalidateRouteCaches(eventId: string) {
    try {
      const { count } = await this.prisma.routeCache.deleteMany({
        where: { eventId },
      });
      if (count > 0) {
        this.logger.log(`Invalidated ${count} route caches for event ${eventId}`);
      }
    } catch (error) {
      this.logger.error('Failed to invalidate route caches', error);
    }
  }

  private async ensureCoupleMember(coupleId: string, userId: string) {
    const member = await this.prisma.coupleMember.findUnique({
      where: { coupleId_userId: { coupleId, userId } },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException('User is not a member of this couple.');
    }
  }
}
```

**Step 2: Commit**

```bash
git add apps/api/src/event/event.service.ts
git commit -m "feat: EventService CRUD + RouteCache 무효화"
```

---

## Task 4: Event Module — Controller

REST API 엔드포인트 구현.

**Files:**
- Create: `apps/api/src/event/event.controller.ts`

**Step 1: Create EventController**

`apps/api/src/event/event.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventService } from './event.service';

@Controller('v1/events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  async create(@Body() body: CreateEventDto) {
    return this.eventService.create(body);
  }

  @Get()
  async findByMonth(@Query() query: EventQueryDto) {
    return this.eventService.findByMonth(query);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    return this.eventService.findById(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() body: UpdateEventDto,
  ) {
    return this.eventService.update(id, userId, body);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    await this.eventService.remove(id, userId);
  }
}
```

**Step 2: Commit**

```bash
git add apps/api/src/event/event.controller.ts
git commit -m "feat: EventController REST API 엔드포인트"
```

---

## Task 5: Event Module — Module Registration

Event 모듈 생성 + AppModule에 등록.

**Files:**
- Create: `apps/api/src/event/event.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: Create EventModule**

`apps/api/src/event/event.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventController } from './event.controller';
import { EventService } from './event.service';

@Module({
  imports: [PrismaModule],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
```

**Step 2: Register in AppModule**

`apps/api/src/app.module.ts` — imports 배열에 `EventModule` 추가:

```typescript
import { EventModule } from './event/event.module';

// imports: [..., EventModule]
```

**Step 3: Verify build**

Run:
```bash
cd apps/api && npx nest build
```

Expected: Build success, no errors.

**Step 4: Commit**

```bash
git add apps/api/src/event/ apps/api/src/app.module.ts
git commit -m "feat: EventModule 등록"
```

---

## Task 6: User Profile Module — DTO + Service + Controller

사용자 프로필 조회/수정 (집 위치 등록). 집 위치 변경 시 RouteCache 무효화.

**Files:**
- Create: `apps/api/src/user/dto/update-user.dto.ts`
- Create: `apps/api/src/user/user.service.ts`
- Create: `apps/api/src/user/user.controller.ts`
- Create: `apps/api/src/user/user.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: Create UpdateUserDto**

`apps/api/src/user/dto/update-user.dto.ts`:

```typescript
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsNumber()
  homeLat?: number;

  @IsOptional()
  @IsNumber()
  homeLng?: number;

  @IsOptional()
  @IsString()
  homeAddress?: string;
}
```

**Step 2: Create UserService**

`apps/api/src/user/user.service.ts`:

```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        homeLat: true,
        homeLng: true,
        homeAddress: true,
        homeUpdatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const homeChanged = dto.homeLat !== undefined || dto.homeLng !== undefined;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.homeLat !== undefined && { homeLat: dto.homeLat }),
        ...(dto.homeLng !== undefined && { homeLng: dto.homeLng }),
        ...(dto.homeAddress !== undefined && { homeAddress: dto.homeAddress }),
        ...(homeChanged && { homeUpdatedAt: new Date() }),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        homeLat: true,
        homeLng: true,
        homeAddress: true,
        homeUpdatedAt: true,
      },
    });

    if (homeChanged) {
      await this.invalidateCoupleRouteCaches(userId);
    }

    return updated;
  }

  private async invalidateCoupleRouteCaches(userId: string) {
    try {
      const memberships = await this.prisma.coupleMember.findMany({
        where: { userId },
        select: { coupleId: true },
      });

      for (const { coupleId } of memberships) {
        const events = await this.prisma.calendarEvent.findMany({
          where: { coupleId },
          select: { id: true },
        });
        const eventIds = events.map((e) => e.id);
        if (eventIds.length > 0) {
          const { count } = await this.prisma.routeCache.deleteMany({
            where: { eventId: { in: eventIds } },
          });
          if (count > 0) {
            this.logger.log(
              `Invalidated ${count} route caches for couple ${coupleId} (home changed)`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to invalidate couple route caches', error);
    }
  }
}
```

**Step 3: Create UserController**

`apps/api/src/user/user.controller.ts`:

```typescript
import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@Controller('v1/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@Query('userId') userId: string) {
    return this.userService.findMe(userId);
  }

  @Patch('me')
  async updateMe(
    @Query('userId') userId: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.userService.updateMe(userId, body);
  }
}
```

**Step 4: Create UserModule + register in AppModule**

`apps/api/src/user/user.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

`apps/api/src/app.module.ts` — imports에 `UserModule` 추가.

**Step 5: Verify build**

Run:
```bash
cd apps/api && npx nest build
```

Expected: Build success.

**Step 6: Commit**

```bash
git add apps/api/src/user/ apps/api/src/app.module.ts
git commit -m "feat: UserModule - 프로필 조회/수정 + 집 위치 변경 시 캐시 무효화"
```

---

## Task 7: POI Search — DTO + Service + Controller

TMAP POI API 프록시 엔드포인트. API 키 프론트 노출 방지.

**Files:**
- Create: `apps/api/src/transit/dto/poi-search.dto.ts`
- Modify: `apps/api/src/transit/transit.service.ts`
- Modify: `apps/api/src/transit/transit.controller.ts`

**Step 1: Create POI Search DTO**

`apps/api/src/transit/dto/poi-search.dto.ts`:

```typescript
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PoiSearchDto {
  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
```

**Step 2: Add POI search method to TransitService**

`apps/api/src/transit/transit.service.ts`에 아래 상수 및 메서드 추가:

상수 (파일 상단, 기존 상수들 아래에):
```typescript
const TMAP_POI_URL = 'https://apis.openapi.sk.com/tmap/pois';
```

메서드 (`computeRoute` 메서드 위에):
```typescript
async searchPoi(keyword: string, page = 1) {
  const params = new URLSearchParams({
    version: '1',
    searchKeyword: keyword,
    page: String(page),
    count: '10',
    resCoordType: 'WGS84GEO',
    searchType: 'all',
  });

  let response: Response;
  try {
    response = await fetch(`${TMAP_POI_URL}?${params}`, {
      headers: {
        accept: 'application/json',
        appKey: this.appKey,
      },
      signal: AbortSignal.timeout(this.httpTimeoutMs),
    });
  } catch (error) {
    this.logger.error('TMAP POI API request failed', error as Error);
    throw new BadGatewayException('TMAP POI API request failed');
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    this.logger.error(`TMAP POI API failed (${response.status}) ${errorBody}`);
    throw new BadGatewayException('TMAP POI API request failed');
  }

  const body = (await response.json()) as Record<string, unknown>;
  return this.sanitizePoiResponse(body);
}

private sanitizePoiResponse(body: Record<string, unknown>) {
  const searchPoiInfo = body.searchPoiInfo as Record<string, unknown> | undefined;
  const pois = searchPoiInfo?.pois as Record<string, unknown> | undefined;
  const poiList = pois?.poi;
  if (!Array.isArray(poiList)) return { results: [] };

  const results = poiList.map((poi: Record<string, unknown>) => ({
    name: poi.name as string,
    address: [poi.upperAddrName, poi.middleAddrName, poi.lowerAddrName, poi.detailAddrName]
      .filter(Boolean)
      .join(' '),
    lat: parseFloat(poi.frontLat as string),
    lng: parseFloat(poi.frontLon as string),
  }));

  return { results };
}
```

**Step 3: Add POI endpoint to TransitController**

`apps/api/src/transit/transit.controller.ts`에 추가:

```typescript
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PoiSearchDto } from './dto/poi-search.dto';

// 기존 메서드 위에:
@Get('poi/search')
async searchPoi(@Query() query: PoiSearchDto) {
  return this.transitService.searchPoi(query.keyword, query.page);
}
```

**Step 4: Verify build**

Run:
```bash
cd apps/api && npx nest build
```

**Step 5: Commit**

```bash
git add apps/api/src/transit/
git commit -m "feat: TMAP POI 검색 프록시 API"
```

---

## Task 8: Route Overlap Algorithm

경로 겹침 분석 순수 함수. TMAP 경로 응답에서 역 추출 → 교집합 → 합류 지점 결정.

**Files:**
- Create: `apps/api/src/transit/route-overlap.ts`
- Create: `apps/api/src/transit/route-overlap.spec.ts`

**Step 1: Write tests for route overlap algorithm**

`apps/api/src/transit/route-overlap.spec.ts`:

```typescript
import {
  normalizeStationName,
  extractStations,
  findOverlapStations,
  findMeetupStation,
} from './route-overlap';

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
  });

  it('returns empty array for walk-only route', () => {
    const legs = [{ mode: 'WALK', sectionTime: 600 }];
    expect(extractStations(legs)).toEqual([]);
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
  });

  it('returns empty when no overlap', () => {
    const stationsA = [
      { name: '강남', normalized: '강남역', lat: 37.497, lng: 127.027, order: 0 },
    ];
    const stationsB = [
      { name: '홍대입구', normalized: '홍대입구역', lat: 37.557, lng: 126.924, order: 0 },
    ];

    expect(findOverlapStations(stationsA, stationsB)).toEqual([]);
  });

  it('falls back to lat/lng proximity within 50m', () => {
    const stationsA = [
      { name: '시청역', normalized: '시청역', lat: 37.56400, lng: 126.97700, order: 0 },
    ];
    const stationsB = [
      { name: '서울시청', normalized: '서울시청역', lat: 37.56403, lng: 126.97702, order: 0 },
    ];

    const overlap = findOverlapStations(stationsA, stationsB);
    expect(overlap).toHaveLength(1);
  });
});

describe('findMeetupStation', () => {
  it('picks the earliest common station by combined order', () => {
    const overlap = [
      { name: '시청', normalized: '시청역', lat: 37.564, lng: 126.977, orderA: 2, orderB: 0 },
      { name: '강남', normalized: '강남역', lat: 37.497, lng: 127.027, orderA: 0, orderB: 3 },
    ];

    const meetup = findMeetupStation(overlap);
    expect(meetup?.name).toBe('시청');
  });

  it('returns null for empty overlap', () => {
    expect(findMeetupStation([])).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd apps/api && npx jest route-overlap --verbose
```

Expected: FAIL — module `./route-overlap` not found.

**Step 3: Implement route overlap algorithm**

`apps/api/src/transit/route-overlap.ts`:

```typescript
export interface Station {
  name: string;
  normalized: string;
  lat: number;
  lng: number;
  order: number;
}

export interface OverlapStation extends Station {
  orderA: number;
  orderB: number;
}

export function normalizeStationName(name: string): string {
  const cleaned = name.replace(/[\s()（）\[\]0-9호선]/g, '');
  return cleaned.endsWith('역') ? cleaned : `${cleaned}역`;
}

export function extractStations(legs: Record<string, unknown>[]): Station[] {
  const stations: Station[] = [];
  let order = 0;

  for (const leg of legs) {
    const mode = leg.mode as string;
    if (mode === 'WALK' || mode === 'TRANSFER') continue;

    const passStopList = leg.passStopList as Record<string, unknown> | undefined;
    const stationList = passStopList?.stationList;
    if (!Array.isArray(stationList)) continue;

    for (const stop of stationList) {
      const s = stop as Record<string, unknown>;
      const name = s.stationName as string;
      stations.push({
        name,
        normalized: normalizeStationName(name),
        lat: parseFloat(s.lat as string),
        lng: parseFloat(s.lon as string),
        order: order++,
      });
    }
  }

  return stations;
}

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PROXIMITY_THRESHOLD_METERS = 50;

export function findOverlapStations(
  stationsA: Station[],
  stationsB: Station[],
): OverlapStation[] {
  const overlap: OverlapStation[] = [];
  const matchedB = new Set<number>();

  for (const a of stationsA) {
    // 1차: 이름 매칭
    const nameMatch = stationsB.find(
      (b, i) => !matchedB.has(i) && a.normalized === b.normalized,
    );

    if (nameMatch) {
      const idx = stationsB.indexOf(nameMatch);
      matchedB.add(idx);
      overlap.push({ ...a, orderA: a.order, orderB: nameMatch.order });
      continue;
    }

    // 2차: 위경도 근접 매칭
    const proximityMatch = stationsB.find(
      (b, i) =>
        !matchedB.has(i) &&
        haversineMeters(a.lat, a.lng, b.lat, b.lng) <= PROXIMITY_THRESHOLD_METERS,
    );

    if (proximityMatch) {
      const idx = stationsB.indexOf(proximityMatch);
      matchedB.add(idx);
      overlap.push({ ...a, orderA: a.order, orderB: proximityMatch.order });
    }
  }

  return overlap;
}

export function findMeetupStation(
  overlap: OverlapStation[],
): OverlapStation | null {
  if (overlap.length === 0) return null;

  return overlap.reduce((best, current) => {
    const bestSum = best.orderA + best.orderB;
    const currentSum = current.orderA + current.orderB;
    return currentSum < bestSum ? current : best;
  });
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd apps/api && npx jest route-overlap --verbose
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add apps/api/src/transit/route-overlap.ts apps/api/src/transit/route-overlap.spec.ts
git commit -m "feat: 경로 겹침 알고리즘 + 단위 테스트"
```

---

## Task 9: Couple Route Analysis — Service

커플 경로 분석 핵심 로직. 2단계 캐시 + TMAP 호출 + 겹침 분석.

**Files:**
- Create: `apps/api/src/transit/dto/couple-route.dto.ts`
- Create: `apps/api/src/transit/couple-route.service.ts`

**Step 1: Create CoupleRouteDto**

`apps/api/src/transit/dto/couple-route.dto.ts`:

```typescript
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CoupleRouteDto {
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @IsString()
  forceRefresh?: string;
}
```

**Step 2: Create CoupleRouteService**

`apps/api/src/transit/couple-route.service.ts`:

```typescript
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  extractStations,
  findMeetupStation,
  findOverlapStations,
} from './route-overlap';
import { TransitService } from './transit.service';

const REDIS_TTL_SECONDS = 3600; // 1시간
const DB_TTL_HOURS = 24;

interface RouteResult {
  departureTime: string;
  totalTime: number;
  transferCount: number;
  legs: unknown[];
}

interface CoupleRouteResponse {
  type: 'meetup' | 'individual';
  meetupStation?: { name: string; lat: number; lng: number };
  myRoute: RouteResult;
  partnerDepartureTime?: string;
  noOverlapReason?: string;
  cachedAt: string;
}

@Injectable()
export class CoupleRouteService {
  private readonly logger = new Logger(CoupleRouteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transitService: TransitService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async analyze(
    eventId: string,
    userId: string,
    forceRefresh = false,
  ): Promise<CoupleRouteResponse> {
    // 1. 일정 조회
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (!event.placeLat || !event.placeLng) {
      throw new BadRequestException('Event has no place coordinates');
    }
    if (!event.appointmentAt) {
      throw new BadRequestException('Event has no appointment time');
    }

    // 2. 커플 멤버 2명 조회
    const members = await this.prisma.coupleMember.findMany({
      where: { coupleId: event.coupleId },
      include: { user: { select: { id: true, homeLat: true, homeLng: true, displayName: true } } },
    });

    const me = members.find((m) => m.userId === userId);
    const partner = members.find((m) => m.userId !== userId);
    if (!me) throw new BadRequestException('User is not a member of this couple');
    if (!me.user.homeLat || !me.user.homeLng) {
      throw new BadRequestException('Your home location is not set');
    }
    if (!partner?.user.homeLat || !partner?.user.homeLng) {
      throw new BadRequestException("Partner's home location is not set");
    }

    // 3. 캐시 키 생성
    const cacheKey = this.buildCacheKey(
      eventId,
      event.appointmentAt.toISOString(),
      me.user.homeLat, me.user.homeLng,
      partner.user.homeLat, partner.user.homeLng,
      event.placeLat, event.placeLng,
    );

    // 4. 캐시 확인 (강제 갱신이 아닌 경우)
    if (!forceRefresh) {
      const cached = await this.checkCache(cacheKey, eventId, userId);
      if (cached) return cached;
    }

    // 5. TMAP 대중교통 API 2회 호출
    const arrivalTime = this.formatTmapDateTime(event.appointmentAt);

    const [myRouteRaw, partnerRouteRaw] = await Promise.all([
      this.transitService.computeRoute({
        origin: { lat: me.user.homeLat, lon: me.user.homeLng },
        destination: { lat: event.placeLat, lon: event.placeLng },
        arrivalTime,
      }),
      this.transitService.computeRoute({
        origin: { lat: partner.user.homeLat, lon: partner.user.homeLng },
        destination: { lat: event.placeLat, lon: event.placeLng },
        arrivalTime,
      }),
    ]);

    // 6. 경로 파싱 + 겹침 분석
    const myItinerary = this.extractBestItinerary(myRouteRaw);
    const partnerItinerary = this.extractBestItinerary(partnerRouteRaw);

    const myStations = extractStations(myItinerary.legs);
    const partnerStations = extractStations(partnerItinerary.legs);
    const overlapStations = findOverlapStations(myStations, partnerStations);
    const meetup = findMeetupStation(overlapStations);

    const myRoute: RouteResult = {
      departureTime: this.calculateDepartureTime(
        event.appointmentAt,
        myItinerary.totalTime,
      ),
      totalTime: myItinerary.totalTime,
      transferCount: myItinerary.transferCount,
      legs: myItinerary.legs,
    };

    let result: CoupleRouteResponse;

    if (meetup) {
      result = {
        type: 'meetup',
        meetupStation: { name: meetup.name, lat: meetup.lat, lng: meetup.lng },
        myRoute,
        partnerDepartureTime: this.calculateDepartureTime(
          event.appointmentAt,
          partnerItinerary.totalTime,
        ),
        cachedAt: new Date().toISOString(),
      };
    } else {
      result = {
        type: 'individual',
        noOverlapReason: '겹치는 경로가 없어 각자 이동합니다.',
        myRoute,
        cachedAt: new Date().toISOString(),
      };
    }

    // 7. 캐시 저장
    await this.saveCache(cacheKey, eventId, userId, result);

    return result;
  }

  private buildCacheKey(...parts: (string | number)[]): string {
    const raw = parts.join(':');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return `transit:couple-route:${hash}`;
  }

  private async checkCache(
    cacheKey: string,
    eventId: string,
    userId: string,
  ): Promise<CoupleRouteResponse | null> {
    // Redis 1차
    try {
      const redisData = await this.redis.get(cacheKey);
      if (redisData) {
        return JSON.parse(redisData) as CoupleRouteResponse;
      }
    } catch (error) {
      this.logger.warn('Redis cache read failed', error);
    }

    // DB RouteCache 2차
    try {
      const dbCache = await this.prisma.routeCache.findFirst({
        where: { eventId, userId, cacheKey, expiresAt: { gt: new Date() } },
      });
      if (dbCache) {
        const data = dbCache.routeData as unknown as CoupleRouteResponse;
        // Redis에 복원
        try {
          await this.redis.set(cacheKey, JSON.stringify(data), 'EX', REDIS_TTL_SECONDS);
        } catch { /* ignore */ }
        return data;
      }
    } catch (error) {
      this.logger.warn('DB cache read failed', error);
    }

    return null;
  }

  private async saveCache(
    cacheKey: string,
    eventId: string,
    userId: string,
    data: CoupleRouteResponse,
  ): Promise<void> {
    const json = JSON.stringify(data);

    // Redis
    try {
      await this.redis.set(cacheKey, json, 'EX', REDIS_TTL_SECONDS);
    } catch (error) {
      this.logger.warn('Redis cache write failed', error);
    }

    // DB RouteCache (upsert)
    try {
      const expiresAt = new Date(Date.now() + DB_TTL_HOURS * 3600_000);
      await this.prisma.routeCache.upsert({
        where: { cacheKey },
        create: { eventId, userId, cacheKey, routeData: data as never, expiresAt },
        update: { routeData: data as never, expiresAt },
      });
    } catch (error) {
      this.logger.warn('DB cache write failed', error);
    }
  }

  private formatTmapDateTime(date: Date): string {
    const kst = new Date(date.getTime() + 9 * 60 * 60_000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    const h = String(kst.getUTCHours()).padStart(2, '0');
    const min = String(kst.getUTCMinutes()).padStart(2, '0');
    return `${y}${m}${d}${h}${min}`;
  }

  private calculateDepartureTime(
    appointmentAt: Date,
    totalTimeMinutes: number,
  ): string {
    const departure = new Date(
      appointmentAt.getTime() - totalTimeMinutes * 60_000,
    );
    return departure.toISOString();
  }

  private extractBestItinerary(routeData: unknown): {
    totalTime: number;
    totalWalkTime: number;
    transferCount: number;
    legs: Record<string, unknown>[];
  } {
    const data = routeData as Record<string, unknown>;
    const metaData = data?.metaData as Record<string, unknown> | undefined;
    const plan = metaData?.plan as Record<string, unknown> | undefined;
    const itineraries = plan?.itineraries;

    if (!Array.isArray(itineraries) || itineraries.length === 0) {
      throw new BadRequestException('No transit route found');
    }

    const best = itineraries[0] as Record<string, unknown>;
    return {
      totalTime: (best.totalTime as number) ?? 0,
      totalWalkTime: (best.totalWalkTime as number) ?? 0,
      transferCount: (best.transferCount as number) ?? 0,
      legs: (best.legs as Record<string, unknown>[]) ?? [],
    };
  }
}
```

**Step 3: Commit**

```bash
git add apps/api/src/transit/dto/couple-route.dto.ts apps/api/src/transit/couple-route.service.ts
git commit -m "feat: CoupleRouteService - 2단계 캐시 + TMAP 호출 + 겹침 분석"
```

---

## Task 10: Couple Route Analysis — Controller + Module Wiring

TransitController에 couple-route 엔드포인트 추가 + TransitModule에 의존성 등록.

**Files:**
- Modify: `apps/api/src/transit/transit.controller.ts`
- Modify: `apps/api/src/transit/transit.module.ts`
- Modify: `apps/api/src/transit/transit.service.ts` (sanitize 제거하여 legs 포함)

**Step 1: Update TransitService to preserve legs in response**

`apps/api/src/transit/transit.service.ts`의 `sanitizeTmapResponse` 메서드를 수정하여 legs 데이터 보존:

```typescript
private sanitizeTmapResponse(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;

  const metaData = (body as Record<string, unknown>).metaData as
    | Record<string, unknown>
    | undefined;
  const plan = metaData?.plan as Record<string, unknown> | undefined;
  const itineraries = plan?.itineraries;
  if (!Array.isArray(itineraries)) return body;

  const safeItineraries = itineraries.map((itinerary) => {
    if (!itinerary || typeof itinerary !== 'object') return null;
    const typed = itinerary as Record<string, unknown>;
    return {
      totalTime: typed.totalTime,
      totalWalkTime: typed.totalWalkTime,
      transferCount: typed.transferCount,
      legs: typed.legs,
    };
  });

  return {
    metaData: {
      plan: {
        itineraries: safeItineraries,
      },
    },
  };
}
```

**Step 2: Add couple-route endpoint to TransitController**

`apps/api/src/transit/transit.controller.ts`에 추가:

```typescript
import { CoupleRouteDto } from './dto/couple-route.dto';
import { CoupleRouteService } from './couple-route.service';

// constructor에 coupleRouteService 추가:
constructor(
  private readonly transitService: TransitService,
  private readonly coupleRouteService: CoupleRouteService,
) {}

@Post('couple-route')
async coupleRoute(@Body() body: CoupleRouteDto) {
  return this.coupleRouteService.analyze(
    body.eventId,
    body.userId,
    body.forceRefresh === 'true',
  );
}
```

**Step 3: Update TransitModule**

`apps/api/src/transit/transit.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CoupleRouteService } from './couple-route.service';
import { TransitController } from './transit.controller';
import { TransitService } from './transit.service';

@Module({
  imports: [RedisModule, PrismaModule],
  controllers: [TransitController],
  providers: [TransitService, CoupleRouteService],
})
export class TransitModule {}
```

**Step 4: Verify build**

Run:
```bash
cd apps/api && npx nest build
```

Expected: Build success.

**Step 5: Commit**

```bash
git add apps/api/src/transit/
git commit -m "feat: couple-route 엔드포인트 + TransitModule 의존성 등록"
```

---

## Task 11: Frontend — POI Search Hook

TMAP POI 검색 자동완성을 위한 커스텀 훅.

**Files:**
- Create: `apps/web/src/hooks/usePoiSearch.ts`

**Step 1: Create usePoiSearch hook**

`apps/web/src/hooks/usePoiSearch.ts`:

```typescript
import { useCallback, useRef, useState } from 'react';

export interface PoiResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const DEBOUNCE_MS = 300;

export function usePoiSearch() {
  const [results, setResults] = useState<PoiResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  const search = useCallback((keyword: string) => {
    clearTimeout(timerRef.current);
    abortRef.current?.abort();

    if (!keyword.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const params = new URLSearchParams({ keyword: keyword.trim() });
        const res = await fetch(`${API_URL}/v1/transit/poi/search?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('POI search failed');
        const data = (await res.json()) as { results: PoiResult[] };
        setResults(data.results);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const clear = useCallback(() => {
    clearTimeout(timerRef.current);
    abortRef.current?.abort();
    setResults([]);
    setLoading(false);
  }, []);

  return { results, loading, search, clear };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/hooks/
git commit -m "feat: usePoiSearch 훅 — TMAP POI 검색 자동완성"
```

---

## Task 12: Frontend — POI Search Component

POI 검색 입력 + 드롭다운 결과 목록 UI 컴포넌트.

**Files:**
- Create: `apps/web/src/app/main/components/PoiSearchInput.tsx`
- Create: `apps/web/src/app/main/components/PoiSearchInput.module.css`

**Step 1: Create PoiSearchInput component**

`apps/web/src/app/main/components/PoiSearchInput.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePoiSearch, type PoiResult } from "../../../hooks/usePoiSearch";
import styles from "./PoiSearchInput.module.css";

interface PoiSearchInputProps {
  value: string;
  onSelect: (poi: PoiResult) => void;
  onClear: () => void;
  placeholder?: string;
}

export default function PoiSearchInput({
  value,
  onSelect,
  onClear,
  placeholder = "장소 검색",
}: PoiSearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const { results, loading, search, clear } = usePoiSearch();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (text: string) => {
    setInputValue(text);
    if (text.trim()) {
      search(text);
      setIsOpen(true);
    } else {
      clear();
      onClear();
      setIsOpen(false);
    }
  };

  const handleSelect = (poi: PoiResult) => {
    setInputValue(poi.name);
    setIsOpen(false);
    clear();
    onSelect(poi);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder={placeholder}
        className={styles.input}
      />
      {isOpen && (results.length > 0 || loading) && (
        <ul className={styles.dropdown}>
          {loading && <li className={styles.loading}>검색 중...</li>}
          {results.map((poi, idx) => (
            <li
              key={`${poi.name}-${idx}`}
              className={styles.item}
              onClick={() => handleSelect(poi)}
            >
              <span className={styles.name}>{poi.name}</span>
              <span className={styles.address}>{poi.address}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Step 2: Create CSS module**

`apps/web/src/app/main/components/PoiSearchInput.module.css`:

```css
.container {
  position: relative;
  width: 100%;
}

.input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  background: white;
  border: 1px solid #ddd;
  border-radius: 0 0 6px 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  list-style: none;
  padding: 0;
  margin: 0;
  z-index: 100;
}

.item {
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item:hover {
  background: #f5f5f5;
}

.name {
  font-size: 14px;
  font-weight: 500;
}

.address {
  font-size: 12px;
  color: #888;
}

.loading {
  padding: 10px 12px;
  color: #888;
  font-size: 13px;
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/main/components/PoiSearchInput.tsx apps/web/src/app/main/components/PoiSearchInput.module.css
git commit -m "feat: PoiSearchInput 컴포넌트 — POI 검색 자동완성 UI"
```

---

## Task 13: Frontend — EventModal Overhaul

EventModal을 설계에 맞게 재구현: 제목, 약속시간 (datetime picker), 장소 (POI 검색), 메모.

**Files:**
- Modify: `apps/web/src/app/main/components/EventModal.tsx`

**Step 1: Update EventFormData interface and EventModal**

`EventFormData` 인터페이스를 변경하고 모달 내용 재구성:

```typescript
export interface EventFormData {
  title: string;
  appointmentAt: string;       // ISO datetime string
  placeName: string;
  placeAddress: string;
  placeLat: number | null;
  placeLng: number | null;
  detail: string;
}

const emptyEvent: EventFormData = {
  title: "",
  appointmentAt: "",
  placeName: "",
  placeAddress: "",
  placeLat: null,
  placeLng: null,
  detail: "",
};
```

모달 body를 다음 필드로 교체:
1. 제목 (텍스트, 필수)
2. 약속 시간 (`<input type="datetime-local">`, 필수)
3. 장소 (`<PoiSearchInput>`, 선택)
4. 메모 (`<textarea>`, 선택)

검증: `isTitleValid && appointmentAt !== ""`

**주의:** CalendarTab.tsx의 `eventsByDate`, seed data, `handleCreate`/`handleUpdate`/`handleDelete` 콜백도 새 EventFormData 인터페이스에 맞게 업데이트 필요.

**Step 2: Update CalendarTab**

- seed data 제거 (빈 객체로 시작)
- API 연동은 다음 Task에서 진행, 여기서는 로컬 상태만 새 인터페이스에 맞춤

**Step 3: Verify TypeScript**

Run:
```bash
cd apps/web && npx tsc --noEmit
```

Expected: No type errors.

**Step 4: Commit**

```bash
git add apps/web/src/app/main/components/EventModal.tsx apps/web/src/app/main/components/CalendarTab.tsx
git commit -m "feat: EventModal 개편 — datetime picker + POI 검색 자동완성"
```

---

## Task 14: Frontend — Event API Integration

CalendarTab에 서버 API 연동. 로컬 상태 대신 서버 데이터 사용.

**Files:**
- Create: `apps/web/src/hooks/useEvents.ts`
- Modify: `apps/web/src/app/main/components/CalendarTab.tsx`

**Step 1: Create useEvents hook**

`apps/web/src/hooks/useEvents.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface CalendarEventData {
  id: string;
  coupleId: string;
  title: string;
  placeName: string | null;
  placeAddress: string | null;
  placeLat: number | null;
  placeLng: number | null;
  appointmentAt: string | null;
  detail: string | null;
  createdByUserId: string;
}

export function useEvents(coupleId: string, userId: string) {
  const [events, setEvents] = useState<CalendarEventData[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchEvents = useCallback(async (month: string) => {
    try {
      const params = new URLSearchParams({ coupleId, userId, month });
      const res = await fetch(`${API_URL}/v1/events?${params}`);
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = (await res.json()) as CalendarEventData[];
      setEvents(data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  }, [coupleId, userId]);

  useEffect(() => {
    if (coupleId && userId) {
      fetchEvents(currentMonth);
    }
  }, [coupleId, userId, currentMonth, fetchEvents]);

  const createEvent = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, coupleId, createdByUserId: userId }),
    });
    if (!res.ok) throw new Error('Failed to create event');
    const created = (await res.json()) as CalendarEventData;
    setEvents((prev) => [...prev, created]);
    return created;
  }, [coupleId, userId]);

  const updateEvent = useCallback(async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/v1/events/${id}?userId=${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to update event');
    const updated = (await res.json()) as CalendarEventData;
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }, [userId]);

  const deleteEvent = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/v1/events/${id}?userId=${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete event');
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, [userId]);

  return {
    events,
    currentMonth,
    setCurrentMonth,
    createEvent,
    updateEvent,
    deleteEvent,
    refetch: () => fetchEvents(currentMonth),
  };
}
```

**Step 2: Integrate useEvents in CalendarTab**

CalendarTab에서 seed data를 제거하고 `useEvents` 훅 사용. FullCalendar의 `datesSet` 콜백으로 월 변경 감지.

**Step 3: Commit**

```bash
git add apps/web/src/hooks/useEvents.ts apps/web/src/app/main/components/CalendarTab.tsx
git commit -m "feat: Event API 연동 — useEvents 훅 + CalendarTab 서버 데이터 사용"
```

---

## Task 15: Frontend — Route Summary in Event Detail

일정 상세 모달에 경로 요약 표시 (출발 시간, 소요 시간, 합류역 정보).

**Files:**
- Create: `apps/web/src/hooks/useCoupleRoute.ts`
- Create: `apps/web/src/app/main/components/RouteSummary.tsx`
- Create: `apps/web/src/app/main/components/RouteSummary.module.css`
- Modify: `apps/web/src/app/main/components/EventModal.tsx` (경로 요약 섹션 추가)

**Step 1: Create useCoupleRoute hook**

`apps/web/src/hooks/useCoupleRoute.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface CoupleRouteData {
  type: 'meetup' | 'individual';
  meetupStation?: { name: string; lat: number; lng: number };
  myRoute: {
    departureTime: string;
    totalTime: number;
    transferCount: number;
    legs: unknown[];
  };
  partnerDepartureTime?: string;
  noOverlapReason?: string;
  cachedAt: string;
}

export function useCoupleRoute(eventId: string | null, userId: string) {
  const [route, setRoute] = useState<CoupleRouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoute = useCallback(async (forceRefresh = false) => {
    if (!eventId || !userId) return;
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { eventId, userId };
      if (forceRefresh) body.forceRefresh = 'true';

      const res = await fetch(`${API_URL}/v1/transit/couple-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(errData.message ?? 'Route analysis failed');
      }

      const data = (await res.json()) as CoupleRouteData;
      setRoute(data);
    } catch (err) {
      setError((err as Error).message);
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }, [eventId, userId]);

  useEffect(() => {
    if (eventId) fetchRoute();
  }, [eventId, fetchRoute]);

  return { route, loading, error, refresh: () => fetchRoute(true) };
}
```

**Step 2: Create RouteSummary component**

`apps/web/src/app/main/components/RouteSummary.tsx`:

```tsx
"use client";

import type { CoupleRouteData } from "../../../hooks/useCoupleRoute";
import styles from "./RouteSummary.module.css";

interface RouteSummaryProps {
  route: CoupleRouteData;
  partnerName?: string;
  onDetailClick: () => void;
  onRefresh: () => void;
}

export default function RouteSummary({
  route,
  partnerName = "상대방",
  onDetailClick,
  onRefresh,
}: RouteSummaryProps) {
  const departure = new Date(route.myRoute.departureTime);
  const departureStr = departure.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={styles.container}>
      <div className={styles.summary}>
        <div className={styles.row}>
          <span className={styles.label}>출발</span>
          <span className={styles.value}>{departureStr}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>소요</span>
          <span className={styles.value}>{route.myRoute.totalTime}분</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>환승</span>
          <span className={styles.value}>{route.myRoute.transferCount}회</span>
        </div>
        {route.type === "meetup" && route.meetupStation && (
          <div className={styles.meetup}>
            {route.meetupStation.name}에서 {partnerName}과(와) 만남
          </div>
        )}
        {route.type === "individual" && (
          <div className={styles.noOverlap}>{route.noOverlapReason}</div>
        )}
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={onDetailClick} className={styles.detailBtn}>
          상세 경로 보기
        </button>
        <button type="button" onClick={onRefresh} className={styles.refreshBtn}>
          새로고침
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Create CSS + integrate in EventModal**

장소와 집 위치가 모두 있는 경우에만 경로 요약 섹션을 EventModal 하단에 표시. `useCoupleRoute` 훅 사용.

**Step 4: Commit**

```bash
git add apps/web/src/hooks/useCoupleRoute.ts apps/web/src/app/main/components/RouteSummary.tsx apps/web/src/app/main/components/RouteSummary.module.css apps/web/src/app/main/components/EventModal.tsx
git commit -m "feat: 경로 요약 UI — 일정 상세에 출발시간/소요시간/합류역 표시"
```

---

## Task 16: Frontend — Route Detail View

스텝별 상세 경로 화면 (도보/버스/지하철 구간별 표시).

**Files:**
- Create: `apps/web/src/app/main/components/RouteDetail.tsx`
- Create: `apps/web/src/app/main/components/RouteDetail.module.css`

**Step 1: Create RouteDetail component**

`apps/web/src/app/main/components/RouteDetail.tsx`:

```tsx
"use client";

import styles from "./RouteDetail.module.css";

interface RouteDetailProps {
  legs: Record<string, unknown>[];
  meetupStationName?: string;
  partnerName?: string;
  partnerDepartureTime?: string;
  onBack: () => void;
}

const MODE_LABELS: Record<string, string> = {
  WALK: "도보",
  BUS: "버스",
  SUBWAY: "지하철",
  EXPRESSBUS: "고속버스",
  TRAIN: "기차",
};

const MODE_COLORS: Record<string, string> = {
  WALK: "#888",
  BUS: "#39b54a",
  SUBWAY: "#0052a4",
};

export default function RouteDetail({
  legs,
  meetupStationName,
  partnerName = "상대방",
  partnerDepartureTime,
  onBack,
}: RouteDetailProps) {
  return (
    <div className={styles.container}>
      <button type="button" onClick={onBack} className={styles.backBtn}>
        ← 뒤로
      </button>
      <div className={styles.steps}>
        {legs.map((leg, idx) => {
          const mode = leg.mode as string;
          const sectionTime = leg.sectionTime as number;
          const startName = (leg.start as Record<string, unknown>)?.name as string | undefined;
          const endName = (leg.end as Record<string, unknown>)?.name as string | undefined;
          const color = MODE_COLORS[mode] ?? "#555";
          const label = MODE_LABELS[mode] ?? mode;
          const minutes = Math.ceil((sectionTime ?? 0) / 60);

          const passStopList = leg.passStopList as Record<string, unknown> | undefined;
          const stationList = passStopList?.stationList as Record<string, unknown>[] | undefined;

          const isMeetupLeg = stationList?.some(
            (s) => meetupStationName && (s.stationName as string) === meetupStationName,
          );

          return (
            <div key={idx} className={styles.step}>
              <div className={styles.indicator} style={{ backgroundColor: color }} />
              <div className={styles.content}>
                <div className={styles.modeRow}>
                  <span className={styles.mode} style={{ color }}>{label}</span>
                  <span className={styles.time}>{minutes}분</span>
                </div>
                {startName && <div className={styles.station}>{startName}</div>}
                {endName && <div className={styles.station}>→ {endName}</div>}
                {isMeetupLeg && meetupStationName && (
                  <div className={styles.meetupBadge}>
                    여기서 {partnerName} 만남
                    {partnerDepartureTime && (
                      <span className={styles.partnerTime}>
                        ({partnerName} 출발: {new Date(partnerDepartureTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Create CSS module**

기본 스타일: step indicator bar (colored line), mode label, time, station names, meetup badge.

**Step 3: Integrate RouteDetail into EventModal**

"상세 경로 보기" 버튼 클릭 시 RouteDetail 컴포넌트 토글 표시.

**Step 4: Commit**

```bash
git add apps/web/src/app/main/components/RouteDetail.tsx apps/web/src/app/main/components/RouteDetail.module.css apps/web/src/app/main/components/EventModal.tsx
git commit -m "feat: RouteDetail — 스텝별 상세 경로 화면 + 합류역 표시"
```

---

## Task 17: Frontend — Settings Home Location

Settings 탭에 내 정보 섹션 추가. 집 위치 POI 검색으로 등록/수정.

**Files:**
- Modify: `apps/web/src/app/main/page.tsx` (Settings 탭 추가 또는 기존 수정)
- Create: `apps/web/src/app/main/components/SettingsTab.tsx`
- Create: `apps/web/src/app/main/components/SettingsTab.module.css`

**Step 1: Create SettingsTab component**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import PoiSearchInput from "./PoiSearchInput";
import type { PoiResult } from "../../../hooks/usePoiSearch";
import styles from "./SettingsTab.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface UserProfile {
  id: string;
  displayName: string;
  homeAddress: string | null;
  homeLat: number | null;
  homeLng: number | null;
}

interface SettingsTabProps {
  userId: string;
}

export default function SettingsTab({ userId }: SettingsTabProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`${API_URL}/v1/users/me?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => setProfile(data as UserProfile))
      .catch(console.error);
  }, [userId]);

  const handleHomeSelect = useCallback(async (poi: PoiResult) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/v1/users/me?userId=${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeLat: poi.lat,
          homeLng: poi.lng,
          homeAddress: `${poi.name} (${poi.address})`,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = (await res.json()) as UserProfile;
      setProfile(updated);
    } catch (error) {
      console.error("Failed to update home location:", error);
    } finally {
      setSaving(false);
    }
  }, [userId]);

  if (!profile) return <div className={styles.loading}>로딩 중...</div>;

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>내 정보</h3>
      <div className={styles.section}>
        <label className={styles.label}>이름</label>
        <p className={styles.value}>{profile.displayName}</p>
      </div>
      <div className={styles.section}>
        <label className={styles.label}>집 위치</label>
        {profile.homeAddress && (
          <p className={styles.currentHome}>{profile.homeAddress}</p>
        )}
        <PoiSearchInput
          value=""
          onSelect={handleHomeSelect}
          onClear={() => {}}
          placeholder="새 집 위치 검색"
        />
        {saving && <p className={styles.saving}>저장 중...</p>}
      </div>
    </div>
  );
}
```

**Step 2: Add Settings tab to main page navigation**

메인 페이지의 탭 목록에 "설정" 탭 추가, `SettingsTab` 컴포넌트 렌더링.

**Step 3: Commit**

```bash
git add apps/web/src/app/main/
git commit -m "feat: SettingsTab — 집 위치 POI 검색 등록/수정"
```

---

## Task 18: Build Verification + Final Commit

전체 빌드 검증 및 최종 정리.

**Step 1: Run API build**

```bash
cd apps/api && npx nest build
```

Expected: No errors.

**Step 2: Run frontend type check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No type errors.

**Step 3: Run tests**

```bash
cd apps/api && npx jest --verbose
```

Expected: route-overlap tests + app controller test 모두 통과.

**Step 4: Verify Prisma migration**

```bash
npx prisma migrate status
```

Expected: All migrations applied.

**Step 5: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "chore: 빌드 검증 및 최종 정리"
```

---

## Dependency Graph

```
Task 1 (Schema)
  ├→ Task 2 (Event DTOs)
  │    └→ Task 3 (Event Service)
  │         └→ Task 4 (Event Controller)
  │              └→ Task 5 (Event Module)
  ├→ Task 6 (User Profile Module)
  ├→ Task 7 (POI Search)
  ├→ Task 8 (Overlap Algorithm) ←— independent, can run in parallel
  └→ Task 9 (Couple Route Service)
       └→ Task 10 (Couple Route Controller + Module)

Task 7 → Task 11 (POI Hook) → Task 12 (POI Component)
Task 5 + Task 12 → Task 13 (EventModal Overhaul)
Task 13 → Task 14 (Event API Integration)
Task 10 → Task 15 (Route Summary) → Task 16 (Route Detail)
Task 12 → Task 17 (Settings Tab)
All → Task 18 (Build Verification)
```

**Parallel groups:**
- **Group A (backend core):** Tasks 2-5 (sequential)
- **Group B (backend independent):** Task 6, Task 7, Task 8 (parallel with each other, after Task 1)
- **Group C (backend route):** Tasks 9-10 (after Task 8)
- **Group D (frontend):** Tasks 11-17 (after backend APIs ready)
