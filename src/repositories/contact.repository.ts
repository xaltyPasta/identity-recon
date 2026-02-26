import { prisma } from "../prisma/client";
import {
  Contact,
  LinkPrecedence,
  Prisma,
  PrismaClient
} from "@prisma/client";

export class ContactRepository {
  private db: PrismaClient | Prisma.TransactionClient;

  constructor(dbClient?: Prisma.TransactionClient) {
    this.db = dbClient ?? prisma;
  }

  async findByEmailOrPhone(
    email?: string,
    phoneNumber?: string
  ): Promise<Contact[]> {
    return this.db.contact.findMany({
      where: {
        deletedAt: null,
        OR: [
          email ? { email } : undefined,
          phoneNumber ? { phoneNumber } : undefined
        ].filter(Boolean) as Prisma.ContactWhereInput[]
      }
    });
  }

  async findAllByPrimaryId(primaryId: number): Promise<Contact[]> {
    return this.db.contact.findMany({
      where: {
        deletedAt: null,
        OR: [{ id: primaryId }, { linkedId: primaryId }]
      }
    });
  }

  async createContact(data: {
    email?: string;
    phoneNumber?: string;
    linkedId?: number | null;
    linkPrecedence: LinkPrecedence;
  }): Promise<Contact> {
    return this.db.contact.create({ data });
  }

  async bulkUpdateToSecondary(
    ids: number[],
    primaryId: number
  ): Promise<void> {
    await this.db.contact.updateMany({
      where: { id: { in: ids } },
      data: {
        linkPrecedence: LinkPrecedence.secondary,
        linkedId: primaryId
      }
    });
  }

  async runTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return prisma.$transaction(fn);
  }
}