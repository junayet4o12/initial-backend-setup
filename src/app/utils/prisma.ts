import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
    omit: {
        user: {
            password: true,
            otp: true,
            otpExpiry: true,
            isEmailVerified: true,
            emailVerificationToken: true,
            emailVerificationTokenExpires: true,
            isAgreeWithTerms: true
        },
    }
});

export const insecurePrisma = new PrismaClient()

