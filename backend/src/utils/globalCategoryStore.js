const DEFAULT_CATEGORY_IMAGES = {
  biryani: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
  coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80",
  "fast food": "https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=600&q=80",
  desserts: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80",
  beverages: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=600&q=80",
  "ice cream": "https://images.unsplash.com/photo-1567206563064-6f60f4006501?auto=format&fit=crop&w=600&q=80",
  food: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
  sweet: "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=600&q=80",
};

const DEFAULT_NAMES = ["Food", "Coffee", "Desserts", "Sweet", "Biryani", "Pizza", "Burger", "Fast Food", "Beverages", "Ice Cream"];

let inMemoryCategories = DEFAULT_NAMES.map((name, idx) => ({
  id: idx + 1,
  name,
  imageUrl: DEFAULT_CATEGORY_IMAGES[name.toLowerCase()] || DEFAULT_CATEGORY_IMAGES.food,
  priority: 100 - idx * 5,
  isActive: true,
}));

let isInitializedWithDb = false;

export const getGlobalCategoriesStore = async (prisma) => {
  if (prisma?.globalCategory && !isInitializedWithDb) {
    isInitializedWithDb = true;
    try {
      let dbCats = await prisma.globalCategory.findMany({ orderBy: { priority: "desc" } });
      if (dbCats.length === 0) {
        const toInsert = inMemoryCategories.map((c) => ({
          name: c.name,
          imageUrl: c.imageUrl,
          priority: c.priority,
          isActive: c.isActive,
        }));
        await prisma.globalCategory.createMany({ data: toInsert, skipDuplicates: true }).catch(() => {});
        dbCats = await prisma.globalCategory.findMany({ orderBy: { priority: "desc" } }).catch(() => []);
      }

      if (dbCats.length > 0) {
        inMemoryCategories = dbCats.map((c) => ({
          id: c.id,
          name: c.name,
          imageUrl: c.imageUrl || DEFAULT_CATEGORY_IMAGES[c.name.toLowerCase()] || DEFAULT_CATEGORY_IMAGES.food,
          priority: c.priority,
          isActive: Boolean(c.isActive),
        }));
      }
    } catch (err) {
      console.warn("[GlobalCategoryStore] DB fetch warning:", err.message);
    }
  }

  return inMemoryCategories;
};

export const getPublicGlobalCategoriesStore = async (prisma) => {
  const all = await getGlobalCategoriesStore(prisma);
  return all.filter((c) => c.isActive);
};

export const updateGlobalCategoryStore = async (prisma, { id, name, isActive, imageUrl, priority }) => {
  const numericId = Number(id);
  const cleanName = name ? String(name).trim() : null;

  // 1. Update In-Memory Store
  let target = inMemoryCategories.find((c) => c.id === numericId);
  if (!target && cleanName) {
    target = inMemoryCategories.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());
  }

  if (target) {
    if (isActive !== undefined) target.isActive = Boolean(isActive);
    if (cleanName) target.name = cleanName;
    if (imageUrl !== undefined) target.imageUrl = imageUrl;
    if (priority !== undefined) target.priority = Number(priority);
  } else {
    target = {
      id: numericId || Date.now(),
      name: cleanName || `Category ${id}`,
      imageUrl: imageUrl || DEFAULT_CATEGORY_IMAGES.food,
      priority: priority !== undefined ? Number(priority) : 50,
      isActive: isActive !== undefined ? Boolean(isActive) : false,
    };
    inMemoryCategories.push(target);
  }

  // 2. Persist to DB if available
  if (prisma?.globalCategory) {
    try {
      let dbRecord = await prisma.globalCategory.findUnique({ where: { id: target.id } }).catch(() => null);
      if (!dbRecord && cleanName) {
        dbRecord = await prisma.globalCategory.findFirst({
          where: { name: { equals: cleanName, mode: "insensitive" } },
        }).catch(() => null);
      }

      if (dbRecord) {
        await prisma.globalCategory.update({
          where: { id: dbRecord.id },
          data: {
            name: cleanName || undefined,
            imageUrl: imageUrl !== undefined ? (imageUrl ? String(imageUrl).trim() : null) : undefined,
            priority: priority !== undefined ? Number(priority) : undefined,
            isActive: isActive !== undefined ? Boolean(isActive) : undefined,
          },
        }).catch(() => {});
      } else {
        await prisma.globalCategory.create({
          data: {
            name: target.name,
            imageUrl: target.imageUrl,
            priority: target.priority,
            isActive: target.isActive,
          },
        }).catch(() => {});
      }
    } catch (err) {
      console.warn("[GlobalCategoryStore] DB update warning:", err.message);
    }
  }

  return target;
};

export const deleteGlobalCategoryStore = async (prisma, { id, name }) => {
  const numericId = Number(id);
  const cleanName = name ? String(name).trim().toLowerCase() : null;

  // 1. Remove from In-Memory Store
  inMemoryCategories = inMemoryCategories.filter((c) => {
    if (c.id === numericId) return false;
    if (cleanName && c.name.toLowerCase() === cleanName) return false;
    return true;
  });

  // 2. Remove from DB if available
  if (prisma?.globalCategory) {
    try {
      await prisma.globalCategory.delete({ where: { id: numericId } }).catch(() => {});
      if (name) {
        await prisma.globalCategory.deleteMany({
          where: { name: { equals: String(name).trim(), mode: "insensitive" } },
        }).catch(() => {});
      }
    } catch (err) {
      console.warn("[GlobalCategoryStore] DB delete warning:", err.message);
    }
  }

  return { success: true };
};

export const createGlobalCategoryStore = async (prisma, { name, imageUrl, priority, isActive }) => {
  const cleanName = String(name).trim();
  const newCat = {
    id: Date.now(),
    name: cleanName,
    imageUrl: imageUrl || DEFAULT_CATEGORY_IMAGES[cleanName.toLowerCase()] || DEFAULT_CATEGORY_IMAGES.food,
    priority: Number(priority) || 0,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
  };

  inMemoryCategories.push(newCat);

  if (prisma?.globalCategory) {
    try {
      const dbCat = await prisma.globalCategory.create({
        data: {
          name: cleanName,
          imageUrl: newCat.imageUrl,
          priority: newCat.priority,
          isActive: newCat.isActive,
        },
      }).catch(() => null);

      if (dbCat) {
        newCat.id = dbCat.id;
      }
    } catch (err) {
      console.warn("[GlobalCategoryStore] DB create warning:", err.message);
    }
  }

  return newCat;
};
