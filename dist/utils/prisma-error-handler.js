"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPrismaError = isPrismaError;
exports.handlePrismaError = handlePrismaError;
exports.getErrorMessage = getErrorMessage;
// utils/prisma-error-handler.ts
const client_1 = require("@prisma/client");
function isPrismaError(error) {
    return error instanceof client_1.Prisma.PrismaClientKnownRequestError;
}
function handlePrismaError(error) {
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
function getErrorMessage(error) {
    if (error instanceof Error)
        return error.message;
    return String(error);
}
