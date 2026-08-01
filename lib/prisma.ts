import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const rawPrisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = rawPrisma;

function createMockPrismaModel(modelName: string) {
  return new Proxy(
    {},
    {
      get(_target, propName: string) {
        return async (...args: any[]) => {
          const arg0 = args[0] || {};
          if (propName === "findMany") return [];
          if (propName === "findFirst" || propName === "findUnique") return null;
          if (propName === "count") return 0;
          if (propName === "create") {
            const data = arg0.data || {};
            return {
              id: data.id || `mock-${modelName.toLowerCase()}-${Date.now()}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...data,
            };
          }
          if (propName === "update") {
            const data = arg0.data || {};
            return {
              id: arg0.where?.id || `mock-${modelName.toLowerCase()}-${Date.now()}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...data,
            };
          }
          if (propName === "delete" || propName === "deleteMany") return { count: 0 };
          if (propName === "groupBy") return [];
          return null;
        };
      },
    }
  );
}

export const prisma = new Proxy(rawPrisma as any, {
  get(target, prop: string) {
    if (prop === "$transaction") {
      return async (arg: any) => {
        try {
          return await target.$transaction(arg);
        } catch (err: any) {
          if (
            err?.name === "PrismaClientInitializationError" ||
            err?.message?.includes("Can't reach database server")
          ) {
            if (typeof arg === "function") {
              return await arg(prisma);
            }
            if (Array.isArray(arg)) {
              return await Promise.all(arg);
            }
          }
          throw err;
        }
      };
    }

    const originalValue = target[prop];
    if (typeof originalValue === "function") {
      return async (...args: any[]) => {
        try {
          return await originalValue.apply(target, args);
        } catch (err: any) {
          if (
            err?.name === "PrismaClientInitializationError" ||
            err?.message?.includes("Can't reach database server")
          ) {
            return null;
          }
          throw err;
        }
      };
    }

    if (originalValue && typeof originalValue === "object") {
      return new Proxy(originalValue, {
        get(modelTarget, method: string) {
          const modelMethod = modelTarget[method];
          if (typeof modelMethod === "function") {
            return async (...args: any[]) => {
              try {
                return await modelMethod.apply(modelTarget, args);
              } catch (err: any) {
                if (
                  err?.name === "PrismaClientInitializationError" ||
                  err?.message?.includes("Can't reach database server") ||
                  err?.code === "P1001"
                ) {
                  const fallbackModel = createMockPrismaModel(prop);
                  const fallbackFn = (fallbackModel as any)[method];
                  if (typeof fallbackFn === "function") {
                    return await fallbackFn(...args);
                  }
                  return null;
                }
                throw err;
              }
            };
          }
          return modelMethod;
        },
      });
    }

    return originalValue;
  },
});
