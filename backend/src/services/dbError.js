export const isSchemaMissingDbError = (err) => {
  const code = String(err?.code || "");
  const message = String(err?.message || "").toLowerCase();

  return code === "P2021" || code === "P2022" || message.includes("does not exist");
};
