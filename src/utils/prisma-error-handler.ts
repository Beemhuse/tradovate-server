// utils/prisma-error-handler.ts
import { Prisma } from '@prisma/client';

export function isPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export function handlePrismaError(error: Prisma.PrismaClientKnownRequestError) {
  switch (error.code) {
    case 'P2002':
      return {
        status: 409,
        message: 'Unique constraint violation',
        details: error.meta
      };
    case 'P2003':
      return {
        status: 400,
        message: 'Foreign key constraint failed',
        details: 'Record cannot be deleted due to foreign key constraints'
      };
    case 'P2025':
      return {
        status: 404,
        message: 'Record not found',
        details: 'The record you are trying to update or delete does not exist'
      };
    case 'P2016':
      return {
        status: 400,
        message: 'Query interpretation error',
        details: error.message
      };
    default:
      return {
        status: 500,
        message: 'Database error',
        details: `Prisma error code: ${error.code}`
      };
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}