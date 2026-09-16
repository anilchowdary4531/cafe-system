export const getStoredAccessForUser = (userId) => {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`owner_staff_access_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredAccessForUser = (userId, accessObj) => {
  if (!userId) return;
  try {
    localStorage.setItem(`owner_staff_access_${userId}`, JSON.stringify(accessObj));
  } catch (e) {
    console.error('Failed to store access for user', userId, e);
  }
};
