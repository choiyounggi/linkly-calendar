import crypto from "node:crypto";
import {
  AuthProvider,
  ChatMessageKind,
  CoupleMemberRole,
  CoupleStatus,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

function getEncryptionKey(): { key: Buffer; version: number } {
  const keysEnv = process.env.CHAT_ENCRYPTION_KEYS?.trim();
  const legacyKey = process.env.CHAT_ENCRYPTION_KEY?.trim();
  const activeVersion = Number.parseInt(
    process.env.CHAT_ENCRYPTION_KEY_VERSION ?? "1",
    10,
  );

  if (keysEnv) {
    for (const entry of keysEnv.split(",").map((v) => v.trim())) {
      if (!entry) continue;
      const [versionRaw, keyRaw] = entry.split(":");
      if (!versionRaw || !keyRaw) continue;
      const version = Number.parseInt(versionRaw, 10);
      if (version !== activeVersion) continue;
      const trimmed = keyRaw.trim();
      const isHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === 64;
      const normalized =
        isHex || /[+/=]/.test(trimmed)
          ? trimmed
          : trimmed.replace(/-/g, "+").replace(/_/g, "/");
      return {
        key: Buffer.from(normalized, isHex ? "hex" : "base64"),
        version,
      };
    }
  }

  if (legacyKey) {
    const trimmed = legacyKey.trim();
    const isHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === 64;
    const normalized =
      isHex || /[+/=]/.test(trimmed)
        ? trimmed
        : trimmed.replace(/-/g, "+").replace(/_/g, "/");
    return {
      key: Buffer.from(normalized, isHex ? "hex" : "base64"),
      version: activeVersion,
    };
  }

  throw new Error(
    "CHAT_ENCRYPTION_KEYS 또는 CHAT_ENCRYPTION_KEY 환경변수가 필요합니다. `pnpm init:env`를 실행하세요.",
  );
}

function encryptPayload(
  plaintext: Record<string, unknown>,
  encKey: Buffer,
  keyVersion: number,
) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey, iv);
  const data = Buffer.from(JSON.stringify(plaintext), "utf8");
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    keyVersion,
  };
}

async function main() {
  const { key: encKey, version: keyVersion } = getEncryptionKey();

  const [user1, user2] = await Promise.all([
    prisma.user.upsert({
      where: {
        authProvider_providerUserId: {
          authProvider: AuthProvider.LOCAL,
          providerUserId: "seed_user_1",
        },
      },
      update: {
        displayName: "링클리",
        email: "linkly.one@example.com",
        avatarUrl: "https://i.pravatar.cc/150?img=32",
        homeLat: 37.5563,
        homeLng: 126.9237,
        homeAddress: "서울 마포구 와우산로 94",
      },
      create: {
        displayName: "링클리",
        email: "linkly.one@example.com",
        avatarUrl: "https://i.pravatar.cc/150?img=32",
        authProvider: AuthProvider.LOCAL,
        providerUserId: "seed_user_1",
        homeLat: 37.5563,
        homeLng: 126.9237,
        homeAddress: "서울 마포구 와우산로 94",
      },
    }),
    prisma.user.upsert({
      where: {
        authProvider_providerUserId: {
          authProvider: AuthProvider.LOCAL,
          providerUserId: "seed_user_2",
        },
      },
      update: {
        displayName: "캘린",
        email: "linkly.two@example.com",
        avatarUrl: "https://i.pravatar.cc/150?img=47",
        homeLat: 37.5045,
        homeLng: 127.0490,
        homeAddress: "서울 강남구 선릉로 지하 396",
      },
      create: {
        displayName: "캘린",
        email: "linkly.two@example.com",
        avatarUrl: "https://i.pravatar.cc/150?img=47",
        authProvider: AuthProvider.LOCAL,
        providerUserId: "seed_user_2",
        homeLat: 37.5045,
        homeLng: 127.0490,
        homeAddress: "서울 강남구 선릉로 지하 396",
      },
    }),
  ]);

  const members = await prisma.coupleMember.findMany({
    where: {
      userId: {
        in: [user1.id, user2.id],
      },
    },
  });

  const member1 = members.find((member) => member.userId === user1.id);
  const member2 = members.find((member) => member.userId === user2.id);

  let coupleId: string;

  if (member1 && member2) {
    coupleId = member1.coupleId;
  } else if (member1 || member2) {
    coupleId = (member1 ?? member2)!.coupleId;
    if (!member1) {
      await prisma.coupleMember.create({
        data: {
          coupleId,
          userId: user1.id,
          role: CoupleMemberRole.OWNER,
        },
      });
    }
    if (!member2) {
      await prisma.coupleMember.create({
        data: {
          coupleId,
          userId: user2.id,
          role: CoupleMemberRole.MEMBER,
        },
      });
    }
  } else {
    const couple = await prisma.couple.create({
      data: {
        status: CoupleStatus.ACTIVE,
        members: {
          create: [
            {
              userId: user1.id,
              role: CoupleMemberRole.OWNER,
            },
            {
              userId: user2.id,
              role: CoupleMemberRole.MEMBER,
            },
          ],
        },
      },
    });
    coupleId = couple.id;
  }

  await prisma.couple.update({
    where: { id: coupleId },
    data: { status: CoupleStatus.ACTIVE },
  });

  const existingMessages = await prisma.chatMessage.count({
    where: { coupleId },
  });

  if (existingMessages === 0) {
    const base = BigInt(Date.now() - 12_000);
    const seedMessages = [
      {
        text: "안녕! 오늘 일정 공유할까?",
        imageUrl: null,
        senderUserId: user1.id,
        kind: ChatMessageKind.TEXT,
        offset: 0n,
      },
      {
        text: "좋아! 저녁 7시에 만나자 💛",
        imageUrl: null,
        senderUserId: user2.id,
        kind: ChatMessageKind.TEXT,
        offset: 1_000n,
      },
      {
        text: null,
        imageUrl: "https://picsum.photos/seed/linkly-chat-1/800/600",
        senderUserId: user1.id,
        kind: ChatMessageKind.IMAGE,
        offset: 2_000n,
      },
      {
        text: "사진 너무 예쁘다!",
        imageUrl: null,
        senderUserId: user2.id,
        kind: ChatMessageKind.TEXT,
        offset: 3_000n,
      },
    ];

    await prisma.chatMessage.createMany({
      data: seedMessages.map((msg) => {
        const encrypted = encryptPayload(
          { text: msg.text, imageUrl: msg.imageUrl },
          encKey,
          keyVersion,
        );
        return {
          coupleId,
          senderUserId: msg.senderUserId,
          kind: msg.kind,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          tag: encrypted.tag,
          keyVersion: encrypted.keyVersion,
          thumbnailUrl:
            msg.kind === ChatMessageKind.IMAGE
              ? "https://picsum.photos/seed/linkly-chat-1/240/180"
              : null,
          sentAtMs: base + msg.offset,
        };
      }),
    });
  }

  const existingPhotos = await prisma.galleryPhoto.count({
    where: { coupleId },
  });

  if (existingPhotos === 0) {
    await prisma.galleryPhoto.createMany({
      data: [
        {
          coupleId,
          uploadedByUserId: user1.id,
          url: "https://picsum.photos/seed/linkly-gallery-1/1000/750",
          thumbnailUrl: "https://picsum.photos/seed/linkly-gallery-1/320/240",
          caption: "첫 여행 사진 📸",
        },
        {
          coupleId,
          uploadedByUserId: user2.id,
          url: "https://picsum.photos/seed/linkly-gallery-2/1000/750",
          thumbnailUrl: "https://picsum.photos/seed/linkly-gallery-2/320/240",
          caption: "우리의 추억",
        },
      ],
    });
  }

  const existingEvents = await prisma.calendarEvent.count({
    where: { coupleId },
  });

  if (existingEvents === 0) {
    const now = new Date();

    await prisma.calendarEvent.createMany({
      data: [
        {
          coupleId,
          createdByUserId: user1.id,
          title: "카페에서 만남",
          placeName: "스타벅스 강남역점",
          placeAddress: "서울 강남구 강남대로 390",
          placeLat: 37.4979,
          placeLng: 127.0276,
          appointmentAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        },
        {
          coupleId,
          createdByUserId: user2.id,
          title: "영화 보기",
          placeName: "CGV 용산아이파크몰",
          placeAddress: "서울 용산구 한강대로23길 55",
          placeLat: 37.5298,
          placeLng: 126.9654,
          appointmentAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        {
          coupleId,
          createdByUserId: user1.id,
          title: "기념일 디너",
          placeName: "라미띠에",
          placeAddress: "서울 강남구 선릉로158길 7",
          placeLat: 37.5244,
          placeLng: 127.0400,
          appointmentAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
