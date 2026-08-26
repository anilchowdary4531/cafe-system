import test from "node:test";
import assert from "node:assert/strict";
import {
  getGlobalCategoriesStore,
  getPublicGlobalCategoriesStore,
  updateGlobalCategoryStore,
  deleteGlobalCategoryStore,
  createGlobalCategoryStore,
} from "../utils/globalCategoryStore.js";

test("Global Category Store Audit - Pause, Delete, and Public Filtering", async () => {
  // 1. Initial fetch contains categories
  const initial = await getGlobalCategoriesStore(null);
  assert.ok(initial.length > 0, "Initial categories should not be empty");

  const biryani = initial.find((c) => c.name.toLowerCase() === "biryani");
  assert.ok(biryani, "Biryani should exist initially");

  // 2. Pause Biryani
  await updateGlobalCategoryStore(null, { id: biryani.id, name: "Biryani", isActive: false });

  // 3. Super admin fetch should show Biryani as paused (isActive: false)
  const afterPauseAdmin = await getGlobalCategoriesStore(null);
  const pausedBiryani = afterPauseAdmin.find((c) => c.name.toLowerCase() === "biryani");
  assert.equal(pausedBiryani?.isActive, false, "Biryani should be marked inactive in admin store");

  // 4. Public customer fetch should EXCLUDE Biryani
  const publicAfterPause = await getPublicGlobalCategoriesStore(null);
  const publicBiryani = publicAfterPause.find((c) => c.name.toLowerCase() === "biryani");
  assert.equal(publicBiryani, undefined, "Biryani must be hidden from public customer store when paused");

  // 5. Delete Biryani
  await deleteGlobalCategoryStore(null, { id: biryani.id, name: "Biryani" });

  // 6. Super admin fetch should NO LONGER contain Biryani
  const afterDeleteAdmin = await getGlobalCategoriesStore(null);
  const deletedBiryani = afterDeleteAdmin.find((c) => c.name.toLowerCase() === "biryani");
  assert.equal(deletedBiryani, undefined, "Biryani must be completely removed after delete");

  // 7. Public customer fetch should ALSO NO LONGER contain Biryani
  const publicAfterDelete = await getPublicGlobalCategoriesStore(null);
  const publicDeletedBiryani = publicAfterDelete.find((c) => c.name.toLowerCase() === "biryani");
  assert.equal(publicDeletedBiryani, undefined, "Biryani must remain hidden from public customer store after delete");
});
