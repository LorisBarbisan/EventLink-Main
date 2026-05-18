declare global {
  namespace Express {
    interface User {
      id: number;
      role: "freelancer" | "recruiter" | "admin";
      email: string;
    }

    interface Request {
      user?: User;
      companyId?: number;
      teamRole?: "owner" | "admin" | "manager" | "viewer";
    }
  }
}

export {};
