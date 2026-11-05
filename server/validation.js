/**
 * Request schemas and validation helpers (zod).
 */

const { z } = require('zod');

const userId = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'User ID must be at least 3 characters.')
  .max(64, 'User ID must be at most 64 characters.')
  .regex(/^[a-z0-9@._-]+$/, 'User ID may only contain letters, numbers and @ . _ -');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[A-Za-z]/, 'Password must contain a letter.')
  .regex(/[0-9]/, 'Password must contain a number.');

const fullName = z.string().trim().min(2, 'Full name is too short.').max(80);

const question = z.string().trim().min(3, 'Security question is too short.').max(200);

const answer = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Security answer is too short.')
  .max(200);

const step1Schema = z.object({
  userId,
  password: z.string().min(1).max(128)
});

const step2Schema = z.object({
  challengeToken: z.string().min(10).max(4096),
  answer: z.string().trim().toLowerCase().min(1).max(200)
});

const registerSchema = z.object({
  inviteCode: z.string().trim().min(1).max(200),
  fullName,
  userId,
  password,
  question,
  answer
});

const updateSecuritySchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: password.optional(),
    question: question.optional(),
    answer: answer.optional()
  })
  .refine((data) => data.newPassword || data.question || data.answer, {
    message: 'Provide at least one field to update.'
  });

const creatorPinSchema = z.object({
  creatorPin: z.string().trim().min(1).max(200)
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request payload.',
        details: result.error.issues.map((i) => ({
          field: i.path.join('.') || 'body',
          message: i.message
        }))
      });
    }
    req.validated = result.data;
    return next();
  };
}

module.exports = {
  validate,
  step1Schema,
  step2Schema,
  registerSchema,
  updateSecuritySchema,
  creatorPinSchema
};
