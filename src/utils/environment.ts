const normalizedBranch = () => process.env.NEXT_PUBLIC_BRANCH?.trim().toLowerCase();

// Keep this aligned with the existing Customizer application contract.
export const isDevelopment = () => normalizedBranch() === "dev";

export const isLocalDevelopment = () => process.env.NODE_ENV === "development";
