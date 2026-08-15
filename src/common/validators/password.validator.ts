import { Matches } from 'class-validator';

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const PASSWORD_RULE = {
  regex: PASSWORD_REGEX,
  message:
    'Password must be at least 8 characters with an uppercase, lowercase, number, and special character',
};

export const IsStrongPassword = () =>
  Matches(PASSWORD_RULE.regex, { message: PASSWORD_RULE.message });
