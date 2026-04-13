export type AuthenticatedUser = {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
};

export type VerifyIdToken = (
  idToken: string,
  projectId?: string
) => Promise<AuthenticatedUser>;
