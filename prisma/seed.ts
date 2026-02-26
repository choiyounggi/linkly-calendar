import {
  AuthProvider,
  ChatMessageKind,
  CoupleMemberRole,
  CoupleStatus,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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
      },
      create: {
        displayName: "링클리",
        email: "linkly.one@example.com",
        avatarUrl: "https://i.pravatar.cc/150?img=32",
        authProvider: AuthProvider.LOCAL,
        providerUserId: "seed_user_1",
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
      },
      create: {
        displayName: "캘린",
        email: "linkly.two@example.com",
        avatarUrl: "https://i.pravatar.cc/150?img=47",
        authProvider: AuthProvider.LOCAL,
        providerUserId: "seed_user_2",
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
    await prisma.chatMessage.createMany({
      data: [
        {
          coupleId,
          senderUserId: user1.id,
          kind: ChatMessageKind.TEXT,
          text: "안녕! 오늘 일정 공유할까?",
          sentAtMs: base,
        },
        {
          coupleId,
          senderUserId: user2.id,
          kind: ChatMessageKind.TEXT,
          text: "좋아! 저녁 7시에 만나자 💛",
          sentAtMs: base + 1_000n,
        },
        {
          coupleId,
          senderUserId: user1.id,
          kind: ChatMessageKind.IMAGE,
          imageUrl: "https://picsum.photos/seed/linkly-chat-1/800/600",
          thumbnailUrl: "https://picsum.photos/seed/linkly-chat-1/240/180",
          sentAtMs: base + 2_000n,
        },
        {
          coupleId,
          senderUserId: user2.id,
          kind: ChatMessageKind.TEXT,
          text: "사진 너무 예쁘다!",
          sentAtMs: base + 3_000n,
        },
      ],
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
