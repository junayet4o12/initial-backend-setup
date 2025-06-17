import { User } from '@prisma/client';
import QueryBuilder from '../../builder/QueryBuilder';
import prisma from '../../utils/prisma';


interface UserWithOptionalPassword extends Omit<User, 'password'> {
  password?: string;
}
// Function to get the keys of a model
async function getModelKeys(modelName: string): Promise<string[]> {
  try {
    // Dynamically access the model from the Prisma client
    const model = (prisma as any)[modelName];  // Type assertion to 'any'

    if (!model) {
      console.warn(`Model '${modelName}' not found on Prisma client.`);
      return [];
    }

    // Attempt to find the first record of the model
    const sampleRecord = await model.findFirst();

    if (!sampleRecord) {
      console.warn(`No records found for model '${modelName}'. Ensure your database has at least one record to correctly retrieve model keys.`);
      return [];
    }

    // Extract the keys from the sample record object
    const keys = Object.keys(sampleRecord);
    return keys;

  } catch (error) {
    console.error(`Error getting model keys for '${modelName}':`, error);
    return [];
  } finally {
    await prisma.$disconnect();
  }
}
const getAllUsersFromDB = async (query: any) => {
  const keys = await getModelKeys('user');
  const usersQuery = new QueryBuilder(prisma.user, query, keys);
  const result = await usersQuery
    .search(['firstName', 'lastName', 'email'])
    .filter()
    .sort()
    .fields()
    .exclude()
    .paginate()
    .execute();
  const pagination = await usersQuery.countTotal();

  return {
    meta: pagination,
    result,
  };
};

const getMyProfileFromDB = async (id: string) => {
  const Profile = await prisma.user.findUniqueOrThrow({
    where: {
      id: id,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Profile;
};

const getUserDetailsFromDB = async (id: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return user;
};

const updateMyProfileIntoDB = async (id: string, payload: any) => {
  const userProfileData = payload.Profile;
  delete payload.Profile;

  const userData = payload;

  // update user data
  await prisma.$transaction(async (transactionClient: any) => {
    // Update user data
    const updatedUser = await transactionClient.user.update({
      where: { id },
      data: userData,
    });

    // Update user profile data
    const updatedUserProfile = await transactionClient.Profile.update({
      where: { userId: id },
      data: userProfileData,
    });

    return { updatedUser, updatedUserProfile };
  });

  // Fetch and return the updated user including the profile
  const updatedUser = await prisma.user.findUniqueOrThrow({
    where: { id },
  });

  const userWithOptionalPassword = updatedUser as UserWithOptionalPassword;
  delete userWithOptionalPassword.password;

  return userWithOptionalPassword;
};

const updateUserRoleStatusIntoDB = async (id: string, payload: any) => {
  const result = await prisma.user.update({
    where: {
      id: id,
    },
    data: payload,
  });
  return result;
};



export const UserServices = {
  getAllUsersFromDB,
  getMyProfileFromDB,
  getUserDetailsFromDB,
  updateMyProfileIntoDB,
  updateUserRoleStatusIntoDB,
};








