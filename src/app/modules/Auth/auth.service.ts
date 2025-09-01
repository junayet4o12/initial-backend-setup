import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import config from '../../../config';
import AppError from '../../errors/AppError';
import { generateToken } from '../../utils/generateToken';
import { insecurePrisma, prisma } from '../../utils/prisma';
import { User } from '@prisma/client';
import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../../utils/verifyToken';
import sendResponse from '../../utils/sendResponse';
import { sendLinkViaMail } from '../../utils/sendMail';

const loginUserFromDB = async (res: Response, payload: {
  email: string;
  password: string;
}) => {
  const userData = await insecurePrisma.user.findUniqueOrThrow({
    where: {
      email: payload.email,
    },
  });

  const isCorrectPassword: boolean = await bcrypt.compare(
    payload.password,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect');
  }

  if (userData.role !== 'SUPERADMIN' && !userData.isEmailVerified) {
    const verificationToken = generateToken(
      {
        id: 'email-verification-token',
        name: userData.firstName + ' ' + userData.lastName,
        email: userData.email,
        role: userData.role,
      },
      config.jwt.access_secret as Secret,
      '24h', // 24 hours expiry for email verification
    );

    const verificationLink = `${config.base_url_client}/auth/verify-email?token=${verificationToken}`;

    await prisma.user.update({
      where: { email: userData.email },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    try {
      sendLinkViaMail(userData.email, verificationLink);
      sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Please check your email for the verification link.',
        data: '',
      });
    } catch {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to send verification email');
    }
  } else {
    const accessToken = await generateToken(
      {
        id: userData.id,
        name: userData.firstName + ' ' + userData.lastName,
        email: userData.email,
        role: userData.role,
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as SignOptions['expiresIn'],
    );

    return {
      id: userData.id,
      name: userData.firstName + ' ' + userData.lastName,
      email: userData.email,
      role: userData.role,
      accessToken: accessToken,
    };
  }
};

const registerUserIntoDB = async (payload: User) => {
  const hashedPassword: string = await bcrypt.hash(payload.password, 12);

  const isUserExistWithTheGmail = await prisma.user.findFirst({
    where: {
      OR: [
        { email: payload.email },
        { phoneNumber: payload.phoneNumber }
      ]
    },
    select: {
      id: true,
      email: true,
      phoneNumber: true
    },
  });

  if (isUserExistWithTheGmail?.email === payload.email) {
    throw new AppError(httpStatus.CONFLICT, 'User already exists with the email');
  }
  if (isUserExistWithTheGmail?.phoneNumber === payload.phoneNumber) {
    throw new AppError(httpStatus.CONFLICT, 'User already exists with the Phone Number');
  }

  const verificationToken = generateToken(
    {
      id: 'email-verification-token',
      name: payload.firstName + ' ' + payload.lastName,
      email: payload.email,
      role: payload.role,
    },
    config.jwt.access_secret as Secret,
    '24h', // 24 hours expiry for email verification
  );

  const userData: User = {
    ...payload,
    password: hashedPassword,
    emailVerificationToken: verificationToken,
    emailVerificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };

  await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: userData,
    });

    const verificationLink = `${config.base_url_client}/auth/verify-email?token=${verificationToken}`;

    try {
      sendLinkViaMail(newUser.email, verificationLink);
    } catch {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to send verification email');
    }
  });
};

const verifyEmail = async (payload: { token: string }) => {
  if (!payload.token) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Verification token is required');
  }

  const verifyUserToken = verifyToken(
    payload.token,
    config.jwt.access_secret as Secret,
  );

  if (verifyUserToken.id !== 'email-verification-token') {
    throw new AppError(httpStatus.FORBIDDEN, 'Invalid verification token');
  }

  const user = await insecurePrisma.user.findUniqueOrThrow({
    where: {
      email: verifyUserToken.email,
    },
  });

  if (user.status === 'BLOCKED') {
    throw new AppError(httpStatus.FORBIDDEN, 'User account is blocked');
  }

  if (user.isEmailVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Email is already verified');
  }

  if (!user.emailVerificationToken || user.emailVerificationToken !== payload.token) {
    throw new AppError(httpStatus.FORBIDDEN, 'Invalid verification token');
  }

  if (!user.emailVerificationTokenExpires || new Date() > user.emailVerificationTokenExpires) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Verification token has expired');
  }

  await prisma.user.update({
    where: {
      email: user.email,
    },
    data: {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpires: null,
    },
  });

  const accessToken = await generateToken(
    {
      id: user.id,
      name: user.firstName + ' ' + user.lastName,
      email: user.email,
      role: user.role,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as SignOptions['expiresIn'],
  );

  return {
    id: user.id,
    name: user.firstName + ' ' + user.lastName,
    email: user.email,
    role: user.role,
    accessToken: accessToken,
  };
};

const changePassword = async (user: any, payload: any) => {
  const userData = await insecurePrisma.user.findUniqueOrThrow({
    where: {
      email: user.email,
      status: 'ACTIVE',
    },
  });

  const isCorrectPassword: boolean = await bcrypt.compare(
    payload.oldPassword,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Current password is incorrect');
  }

  const hashedPassword: string = await bcrypt.hash(payload.newPassword, 12);

  await prisma.user.update({
    where: {
      id: userData.id,
    },
    data: {
      password: hashedPassword,
    },
  });

  return {
    message: 'Password changed successfully!',
  };
};

const resendUserVerificationEmail = async (email: string) => {
  const user = await insecurePrisma.user.findUniqueOrThrow({
    where: { email: email },
  });

  if (user.status === 'BLOCKED') {
    throw new AppError(httpStatus.FORBIDDEN, 'User account is blocked');
  }

  if (user.isEmailVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Email is already verified');
  }

  const verificationToken = generateToken(
    {
      id: 'email-verification-token',
      name: user.firstName + ' ' + user.lastName,
      email: user.email,
      role: user.role,
    },
    config.jwt.access_secret as Secret,
    '24h', // 24 hours expiry for email verification
  );

  const verificationLink = `${config.base_url_client}/auth/verify-email?token=${verificationToken}`;

  await prisma.user.update({
    where: { email: email },
    data: {
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  try {
    await sendLinkViaMail(email, verificationLink);
  } catch {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to send verification email');
  }

  return { message: 'Verification link sent successfully. Please check your inbox.' };
};

const forgetPassword = async (email: string) => {
  const userData = await prisma.user.findUniqueOrThrow({
    where: {
      email
    },
    select: {
      status: true,
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      emailVerificationTokenExpires: true
    }
  });

  if (userData.status === 'BLOCKED') {
    throw new AppError(httpStatus.BAD_REQUEST, 'User account is blocked');
  }


  const resetToken = generateToken(
    {
      id: 'password-reset-token',
      name: userData.firstName + ' ' + userData.lastName,
      email: email,
      role: userData.role,
    },
    config.jwt.access_secret as Secret,
    '15m', // 15 minutes expiry for password reset
  );

  const resetLink = `${config.base_url_client}/auth/reset-password?token=${resetToken}`;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { email },
        data: {
          emailVerificationToken: resetToken,
          emailVerificationTokenExpires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        }
      });

      try {
        sendLinkViaMail(email, resetLink);
      } catch (emailErr) {
        // Rollback the token if email fails
        await tx.user.update({
          where: { email },
          data: {
            emailVerificationToken: null,
            emailVerificationTokenExpires: null,
          },
        });
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to send password reset email');
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to process password reset request');
  }

  return { message: 'Password reset link sent successfully. Please check your inbox.' };
};

const resetPassword = async (payload: {
  newPassword: string;
  token: string
}) => {
  const token = payload.token
  if (!token) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Reset token is required');
  }

  const decoded = jwt.verify(token, config.jwt.access_secret as string) as JwtPayload;

  if (decoded.id !== 'password-reset-token') {
    throw new AppError(httpStatus.FORBIDDEN, 'Invalid reset token');
  }

  const userData = await insecurePrisma.user.findFirstOrThrow({
    where: {
      email: decoded.email,
    },
  });

  if (userData.status === 'BLOCKED') {
    throw new AppError(httpStatus.FORBIDDEN, 'User account is blocked');
  }

  if (!userData.emailVerificationToken || userData.emailVerificationToken !== token) {
    throw new AppError(httpStatus.FORBIDDEN, 'Invalid or expired reset token');
  }

  if (!userData.emailVerificationTokenExpires || new Date() > userData.emailVerificationTokenExpires) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Reset token has expired');
  }

  const newHashedPassword = await bcrypt.hash(payload.newPassword, 12);

  await prisma.user.update({
    where: {
      email: decoded.email
    },
    data: {
      password: newHashedPassword,
      emailVerificationToken: null,
      emailVerificationTokenExpires: null,
    }
  });

  return { message: 'Password reset successfully!' };
};

export const AuthServices = {
  loginUserFromDB,
  registerUserIntoDB,
  verifyEmail,
  changePassword,
  resendUserVerificationEmail,
  forgetPassword,
  resetPassword,
};