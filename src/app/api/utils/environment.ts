import "server-only";

const normalizedBranch = () => process.env.NEXT_PUBLIC_BRANCH?.trim().toLowerCase();

export const isDevelopmentDeployment = () => normalizedBranch() === "dev";

