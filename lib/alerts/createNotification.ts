import { prisma } from '../prisma';

export async function createNotification(
  alertRuleId: string, 
  organizationId: string, 
  userId: string | null, 
  itemId: string,
  reasons: string[]
) {
  // Try to find the documentVersion corresponding to the itemId to link to it
  const documentVersion = await prisma.documentVersion.findFirst({
    where: { sourceItemId: itemId }
  });

  const existingNotification = await prisma.notification.findFirst({
    where: {
      alertRuleId,
      organizationId,
      ...(userId ? { userId } : {}),
      documentVersionId: documentVersion?.id,
    }
  });

  if (existingNotification) {
    return false; // Avoid duplicates
  }

  await prisma.notification.create({
    data: {
      alertRuleId,
      organizationId,
      userId,
      documentVersionId: documentVersion?.id || null,
      channel: 'in-app',
      status: 'pending',
      payload: { reasons }
    }
  });

  return true;
}
