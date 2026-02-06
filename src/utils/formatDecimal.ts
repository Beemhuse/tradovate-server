import { Prisma } from "@prisma/client";

export const D = (v: Prisma.Decimal | number | string) =>
  new Prisma.Decimal(v);

export const N = (v?: Prisma.Decimal | null) =>
  v ? Number(v) : 0;
