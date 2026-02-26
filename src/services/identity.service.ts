import { ContactRepository } from "../repositories/contact.repository";
import { LinkPrecedence, Contact } from "@prisma/client";

interface IdentifyInput {
  email?: string;
  phoneNumber?: string;
}

interface IdentifyResponse {
  contact: {
    primaryContactId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}

export class IdentityService {
  private contactRepo = new ContactRepository();

  async reconcile(input: IdentifyInput): Promise<IdentifyResponse> {
    if (!input.email && !input.phoneNumber) {
      throw new Error("Either email or phoneNumber must be provided");
    }

    return this.contactRepo.runTransaction(async (tx) => {
      const repo = new ContactRepository();

      // Step 1: Find initial matches
      const matches = await repo.findByEmailOrPhone(
        input.email,
        input.phoneNumber
      );

      // Step 2: If no matches → create primary
      if (matches.length === 0) {
        const newPrimary = await repo.createContact({
          email: input.email,
          phoneNumber: input.phoneNumber,
          linkedId: null,
          linkPrecedence: LinkPrecedence.primary
        });

        return this.buildResponse([newPrimary]);
      }

      // Step 3: Collect all root primary IDs
      const primaryIds = new Set<number>();

      for (const contact of matches) {
        if (contact.linkPrecedence === LinkPrecedence.primary) {
          primaryIds.add(contact.id);
        } else if (contact.linkedId) {
          primaryIds.add(contact.linkedId);
        }
      }

      // Step 4: Fetch full cluster
      let cluster: Contact[] = [];

      for (const pid of primaryIds) {
        const group = await repo.findAllByPrimaryId(pid);
        cluster = cluster.concat(group);
      }

      // Remove duplicates
      const uniqueClusterMap = new Map<number, Contact>();
      cluster.forEach((c) => uniqueClusterMap.set(c.id, c));
      cluster = Array.from(uniqueClusterMap.values());

      // Step 5: Determine final primary (oldest createdAt)
      const primaries = cluster.filter(
        (c) => c.linkPrecedence === LinkPrecedence.primary
      );

      primaries.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      const finalPrimary = primaries[0];

      // Step 6: Merge other primaries if needed
      const otherPrimaries = primaries.filter(
        (p) => p.id !== finalPrimary.id
      );

      if (otherPrimaries.length > 0) {
        await repo.bulkUpdateToSecondary(
          otherPrimaries.map((p) => p.id),
          finalPrimary.id
        );
      }

      // Refresh cluster after merge
      cluster = await repo.findAllByPrimaryId(finalPrimary.id);

      const existingEmails = new Set(
        cluster.map((c) => c.email).filter(Boolean) as string[]
      );

      const existingPhones = new Set(
        cluster.map((c) => c.phoneNumber).filter(Boolean) as string[]
      );

      // Step 7: Create new secondary if needed
      const needsNewContact =
        (input.email && !existingEmails.has(input.email)) ||
        (input.phoneNumber && !existingPhones.has(input.phoneNumber));

      if (needsNewContact) {
        await repo.createContact({
          email: input.email,
          phoneNumber: input.phoneNumber,
          linkedId: finalPrimary.id,
          linkPrecedence: LinkPrecedence.secondary
        });

        cluster = await repo.findAllByPrimaryId(finalPrimary.id);
      }

      return this.buildResponse(cluster);
    });
  }

  private buildResponse(cluster: Contact[]): IdentifyResponse {
    const primary = cluster.find(
      (c) => c.linkPrecedence === LinkPrecedence.primary
    )!;

    const secondaryIds = cluster
      .filter((c) => c.linkPrecedence === LinkPrecedence.secondary)
      .map((c) => c.id);

    const emails = Array.from(
      new Set(cluster.map((c) => c.email).filter(Boolean))
    ) as string[];

    const phones = Array.from(
      new Set(cluster.map((c) => c.phoneNumber).filter(Boolean))
    ) as string[];

    // Primary first ordering
    emails.sort((a) => (a === primary.email ? -1 : 1));
    phones.sort((a) => (a === primary.phoneNumber ? -1 : 1));

    return {
      contact: {
        primaryContactId: primary.id,
        emails,
        phoneNumbers: phones,
        secondaryContactIds: secondaryIds
      }
    };
  }
}
