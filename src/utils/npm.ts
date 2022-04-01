export type NpmTokenResponse = {
  ok: boolean;
  id: string;
  rev: string;
  token: string;
};

export type NpmCredentials = {
  name: string;
  password: string;
  email: string;
};
