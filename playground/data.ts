import { faker } from "@faker-js/faker/locale/vi";

export interface FeedItem {
  id: string;
  title: string;
  image: string;
  description: string;
}

faker.seed(20260727);

export const feedItems: FeedItem[] = Array.from(
  { length: 2_000 },
  (_, index) => {
    const imageHeights = [320, 420, 540];

    return {
      id: faker.string.uuid(),
      title: faker.lorem.sentence({ min: 3, max: 9 }),
      image: faker.image.url({
        width: 720,
        height: imageHeights[index % imageHeights.length],
      }),
      description: faker.lorem.paragraph({ min: 1, max: 20 }),
    };
  },
);
