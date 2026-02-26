import { prisma } from "../prisma/client";
import { Contact, LinkPrecedence, Prisma } from "@prisma/client";

export class ContactRepository {
  async findByEmailOrPhone(
    email?: string,
    phoneNumber?: string
  ): Promise<Contact[]> {
    return prisma.contact.findMany({
      where: {
        deletedAt: null,
        OR: [
          email ? { email } : undefined,
          phoneNumber ? { phoneNumber } : undefined
        ].filter(Boolean) as Prisma.ContactWhereInput[]
      }
    });
  }

  async findByIds(ids: number[]): Promise<Contact[]> {
    return prisma.contact.findMany({
      where: {
        id: { in: ids },
        deletedAt: null
      }
    });
  }

  async findAllByPrimaryId(primaryId: number): Promise<Contact[]> {
    return prisma.contact.findMany({
      where: {
        deletedAt: null,
        OR: [
          { id: primaryId },
          { linkedId: primaryId }
        ]
      }
    });
  }

  async createContact(data: {
    email?: string;
    phoneNumber?: string;
    linkedId?: number | null;
    linkPrecedence: LinkPrecedence;
  }): Promise<Contact> {
    return prisma.contact.create({
      data
    });
  }

  async updateContact(
    id: number,
    data: Prisma.ContactUpdateInput
  ): Promise<Contact> {
    return prisma.contact.update({
      where: { id },
      data
    });
  }

  async bulkUpdateToSecondary(
    ids: number[],
    primaryId: number
  ): Promise<void> {
    await prisma.contact.updateMany({
      where: {
        id: { in: ids }
      },
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
