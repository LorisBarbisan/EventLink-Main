declare global {
  namespace Express {
    interface User {
      id: number;
      role: 'freelancer' | 'recruiter' | 'admin';
      email: string;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};