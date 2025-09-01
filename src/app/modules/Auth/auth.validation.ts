import z from "zod";

const loginUser = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required!",
      })
      .email({
        message: "Invalid email format!",
      }),
    password: z.string({
      required_error: "Password is required!",
    }),
  }),
});

const registerUser = z.object({
  body: z.object({
    firstName: z.string({
      required_error: 'First Name is required!',
    }),
    lastName: z.string({
      required_error: 'Last Name is required!',
    }),
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    phoneNumber: z.string({ required_error: 'Phone Number is required' }),
    isAgreeWithTerms: z.boolean().refine(val => val === true, {
      message: "You must agree to the terms"
    }),
    password: z.string({
      required_error: 'Password is required!',
    }),
  }),
});

const verifyEmailValidationSchema = z.object({
  body: z.object({
    token: z.string({
      required_error: 'Verification token is required'
    }).min(1, {
      message: 'Token cannot be empty'
    })
  })
});

const resendVerificationEmailValidationSchema = z.object({
  body: z.object({
    email: z.string({
      required_error: 'Email is required'
    }).email({
      message: 'Use a valid email format'
    }),
  })
});

const changePasswordValidationSchema = z.object({
  body: z.object({
    oldPassword: z.string({
      required_error: 'Current password is required!'
    }),
    newPassword: z.string({
      required_error: 'New password is required!'
    }).min(6, {
      message: 'Password must be at least 6 characters long'
    }),
  })
});

const forgetPasswordValidationSchema = z.object({
  body: z.object({
    email: z.string({
      required_error: 'Email is required'
    }).email({
      message: 'Use a valid email format'
    }),

  })
});

const resetPasswordValidationSchema = z.object({
  body: z.object({
    newPassword: z.string({
      required_error: 'New password is required!'
    }).min(6, {
      message: 'Password must be at least 6 characters long'
    }),
    token: z.string({
      required_error: 'Verification token is required'
    }).min(1, {
      message: 'Token cannot be empty'
    })
  })
});

export const authValidation = {
  loginUser,
  registerUser,
  verifyEmailValidationSchema,
  resendVerificationEmailValidationSchema,
  changePasswordValidationSchema,
  forgetPasswordValidationSchema,
  resetPasswordValidationSchema
};