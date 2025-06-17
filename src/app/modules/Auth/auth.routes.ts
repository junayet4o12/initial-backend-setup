import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { AuthControllers } from './auth.controller';
import { authValidation } from './auth.validation';
import auth from '../../middlewares/auth';
const router = express.Router();

router.post(
  '/login',
  validateRequest(authValidation.loginUser),
  AuthControllers.loginUser,
);

router.post(
  '/register',
  validateRequest(authValidation.registerUser),
  AuthControllers.registerUser,
);
router.post(
  '/verify-email',
  validateRequest(authValidation.verifyOtpValidationSchema),
  AuthControllers.verifyMail,
);

router.post(
  '/resend-verification-email',
  AuthControllers.resendUserVerificationEmail,
);



router.post(
  '/change-password',
  auth('USER', 'ADMIN'),
  AuthControllers.changePassword,
);
router.post(
  '/forget-password',
  validateRequest(authValidation.forgetPasswordValidationSchema),
  AuthControllers.forgetPassword,
);
router.post(
  '/forget-password/verify-otp',
  validateRequest(authValidation.verifyOtpValidationSchema),
  AuthControllers.verifyForgotPassOtp,
);
router.post(
  '/reset-password',
  validateRequest(authValidation.resetPasswordValidationSchema),
  AuthControllers.resetPassword,
);

export const AuthRouters = router;
