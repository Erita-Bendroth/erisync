// Input validation utilities for security

export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  // Basic XSS prevention - remove script tags and dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>'"]/g, '')
    .trim();
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const sanitizeCSVInput = (input: string): string => {
  if (!input) return '';
  
  // Prevent CSV injection attacks
  const dangerousChars = /^[\=\+\-\@]/;
  if (dangerousChars.test(input.trim())) {
    return `'${input}`;
  }
  
  return sanitizeInput(input);
};

export const validateRole = (role: string): boolean => {
  const validRoles = ['admin', 'planner', 'manager', 'teammember'];
  return validRoles.includes(role.toLowerCase());
};