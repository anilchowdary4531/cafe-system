export const reserveStockForOrder = async ({ tx, restaurantId, items } = {}) => {
  const rid = Number(restaurantId || 0);
  if (!tx || !rid) return;

  const normalizedItems = Array.isArray(items) ? items : [];
  const ids = [...new Set(normalizedItems.map((i) => Number(i.menuItemId || 0)).filter((id) => id > 0))];
  if (!ids.length) return;

  const stocks = await tx.inventoryStock.findMany({
    where: { restaurantId: rid, menuItemId: { in: ids } },
    select: { id: true, menuItemId: true, stockQuantity: true },
  });

  const byMenuItemId = new Map(stocks.map((s) => [Number(s.menuItemId), s]));

  for (const item of normalizedItems) {
    const menuItemId = Number(item.menuItemId || 0);
    const qty = Math.max(1, Number(item.qty || 1));
    const stock = byMenuItemId.get(menuItemId);
    if (!stock) continue; // not tracked => unlimited
    if (Number(stock.stockQuantity || 0) < qty) {
      const err = new Error("insufficient_stock");
      err.code = "insufficient_stock";
      err.menuItemId = menuItemId;
      throw err;
    }
  }

  await Promise.all(
    normalizedItems.map(async (item) => {
      const menuItemId = Number(item.menuItemId || 0);
      const qty = Math.max(1, Number(item.qty || 1));
      const stock = byMenuItemId.get(menuItemId);
      if (!stock) return;
      await tx.inventoryStock.update({
        where: { id: stock.id },
        data: { stockQuantity: { decrement: qty } },
      });
    })
  );
};

export const restoreStockForOrder = async ({ tx, restaurantId, items } = {}) => {
  const rid = Number(restaurantId || 0);
  if (!tx || !rid) return;

  const normalizedItems = Array.isArray(items) ? items : [];
  const ids = [...new Set(normalizedItems.map((i) => Number(i.menuItemId || 0)).filter((id) => id > 0))];
  if (!ids.length) return;

  const stocks = await tx.inventoryStock.findMany({
    where: { restaurantId: rid, menuItemId: { in: ids } },
    select: { id: true, menuItemId: true },
  });

  const byMenuItemId = new Map(stocks.map((s) => [Number(s.menuItemId), s]));

  await Promise.all(
    normalizedItems.map(async (item) => {
      const menuItemId = Number(item.menuItemId || 0);
      const qty = Math.max(1, Number(item.qty || 1));
      const stock = byMenuItemId.get(menuItemId);
      if (!stock) return;
      await tx.inventoryStock.update({
        where: { id: stock.id },
        data: { stockQuantity: { increment: qty } },
      });
    })
  );
};

